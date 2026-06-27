import { NextRequest } from "next/server";
import { chatStream, type LLMProvider } from "@/lib/ai-provider";
import { type SkillParameter, SKILL_GENERATE_PROMPT } from "@/lib/skill-parser";
import { requirePermission } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("skills-generate-stream-api");

// POST /api/skills/generate/stream - SSE 流式生成 Skill
// 让前端实时看到 AI 生成过程，有即时反馈
// SSE 事件：
//   thinking  - 状态提示（正在分析...）
//   delta     - AI 输出的文本片段
//   done      - 生成完成，含解析后的 skill 对象
//   error     - 错误
export async function POST(req: NextRequest) {
  const auth = await requirePermission("skill:generate");
  if (auth.error) return auth.error;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        const body = (await req.json()) as {
          workLog?: string;
          conversation?: Array<{ role: string; content: string }>;
          provider?: string;
        };
        // 输入校验：workLog 必须为字符串（长度上限 10000），conversation 必须为数组
        if (body.workLog !== undefined && body.workLog !== null && typeof body.workLog !== "string") {
          send({ type: "error", error: "workLog 必须为字符串" });
          controller.close();
          return;
        }
        if (body.workLog && body.workLog.length > 10000) {
          send({ type: "error", error: "workLog 不能超过 10000 字符" });
          controller.close();
          return;
        }
        if (body.conversation !== undefined && !Array.isArray(body.conversation)) {
          send({ type: "error", error: "conversation 必须为数组" });
          controller.close();
          return;
        }
        const workLog = body.workLog || "";
        const conversation = body.conversation || [];

        if (!workLog.trim() && conversation.length === 0) {
          send({ type: "error", error: "请提供工作记录或对话内容" });
          controller.close();
          return;
        }

        let resolvedProvider: LLMProvider | undefined;
        if (body.provider === "deepseek" || body.provider === "mimo") {
          resolvedProvider = body.provider;
        }

        const conversationText = conversation
          .map((c) => `${c.role}: ${c.content}`)
          .join("\n\n");

        const userPrompt = `请分析以下工作记录和对话，提取一个可复用的 Skill 技能模板。

工作记录：
${workLog || "(无)"}

对话历史：
${conversationText || "(无)"}

请按照系统提示的 JSON 格式输出 Skill。`;

        // 推送状态提示
        send({ type: "thinking", content: "正在分析工作记录，识别可复用模式..." });

        // 流式调用 AI，逐块推送 delta
        let fullText = "";
        try {
          for await (const evt of chatStream(
            [{ role: "user", content: userPrompt }],
            { provider: resolvedProvider, system: SKILL_GENERATE_PROMPT }
          )) {
            if (evt.type === "delta" && evt.content) {
              fullText += evt.content;
              send({ type: "delta", content: evt.content });
            } else if (evt.type === "error") {
              throw new Error(evt.message);
            }
          }
        } catch (e) {
          // AI 流式调用失败，推送 fallback
          send({
            type: "done",
            skill: fallbackSkill(workLog, conversation),
            fallback: true,
            fallbackReason: `AI 调用失败（${(e as Error).message}）。已降级为基于关键词的简单分类。`,
          });
          controller.close();
          return;
        }

        // 解析 AI 返回的 JSON
        send({ type: "thinking", content: "正在解析技能模板..." });
        let skillData: Record<string, unknown>;
        try {
          const text = fullText.trim();
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          const jsonStr = jsonMatch ? jsonMatch[1].trim() : text;
          skillData = JSON.parse(jsonStr);
        } catch {
          send({
            type: "done",
            skill: fallbackSkill(workLog, conversation),
            fallback: true,
            parseError: true,
            fallbackReason: "AI 返回的内容无法解析为 JSON。已降级为基于关键词的简单分类。建议重试。",
          });
          controller.close();
          return;
        }

        const parameters: SkillParameter[] = Array.isArray(skillData.parameters)
          ? (skillData.parameters as Array<Record<string, unknown>>)
              .map((p): SkillParameter | null => {
                if (!p || typeof p !== "object") return null;
                const key = typeof p.key === "string" ? p.key : "";
                if (!key) return null;
                return {
                  key,
                  label: typeof p.label === "string" ? p.label : key,
                  type: (typeof p.type === "string" ? p.type : "text") as SkillParameter["type"],
                  required: p.required === true,
                  placeholder: typeof p.placeholder === "string" ? p.placeholder : undefined,
                  options: Array.isArray(p.options) ? p.options.map((x) => String(x)) : undefined,
                  defaultValue: typeof p.defaultValue === "string" ? p.defaultValue : undefined,
                };
              })
              .filter((x): x is SkillParameter => x !== null)
          : [];

        const skill = {
          name: typeof skillData.name === "string" ? skillData.name : "未命名技能",
          description: typeof skillData.description === "string" ? skillData.description : "",
          category: typeof skillData.category === "string" ? skillData.category : "general",
          tags: Array.isArray(skillData.tags) ? skillData.tags.map((t) => String(t)) : [],
          parameters,
          content: typeof skillData.content === "string" ? skillData.content : "",
          promptTemplate: typeof skillData.promptTemplate === "string" ? skillData.promptTemplate : "",
          source: "ai-generated" as const,
        };

        send({ type: "done", skill, fallback: false });
      } catch (e) {
        logger.error({ err: e }, "流式生成 Skill 失败");
        send({ type: "error", error: "生成失败，请重试" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// 降级技能生成（与非流式端点逻辑一致）
function fallbackSkill(
  workLog: string,
  conversation: Array<{ role: string; content: string }> = []
) {
  const text = (workLog + " " + conversation.map((c) => c.content).join(" ")).toLowerCase();
  let category = "general";
  let name = "通用工作技能";
  let description = "从工作记录中提取的通用工作流程";
  let tags = ["工作流程"];

  if (/财务|预算|成本|收入|利润|预测/.test(text)) {
    category = "finance"; name = "财务分析技能"; description = "基于工作记录提取的财务分析流程"; tags = ["财务", "分析"];
  } else if (/周报|月报|报告|总结|汇报/.test(text)) {
    category = "report"; name = "报告生成技能"; description = "基于工作记录提取的报告生成流程"; tags = ["报告", "总结"];
  } else if (/代码|审查|review|code/.test(text)) {
    category = "review"; name = "审查技能"; description = "基于工作记录提取的审查流程"; tags = ["审查"];
  } else if (/知识|蒸馏|提取|认知/.test(text)) {
    category = "knowledge"; name = "知识处理技能"; description = "基于工作记录提取的知识处理流程"; tags = ["知识"];
  } else if (/会议|纪要|议程|meeting/.test(text)) {
    category = "meeting"; name = "会议处理技能"; description = "基于工作记录提取的会议处理流程"; tags = ["会议"];
  } else if (/产品|需求|规划|product/.test(text)) {
    category = "product"; name = "产品规划技能"; description = "基于工作记录提取的产品规划流程"; tags = ["产品"];
  }

  return {
    name,
    description,
    category,
    tags,
    parameters: [{
      key: "context",
      label: "工作上下文",
      type: "textarea" as const,
      required: true,
      placeholder: "粘贴相关工作内容或背景信息...",
    }],
    content: `# ${name}\n\n## 步骤\n1. 分析工作上下文\n2. 识别关键信息\n3. 提取可复用模式\n4. 输出结构化结果\n\n## 说明\n该技能基于工作记录自动生成，可根据实际需求调整参数和提示词。`,
    promptTemplate: `你是一个专业助手。请基于以下工作上下文完成任务：\n\n{{context}}\n\n请输出：1.关键信息提取 2.模式识别 3.可复用建议`,
    source: "ai-generated" as const,
  };
}

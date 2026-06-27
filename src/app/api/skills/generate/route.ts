import { NextRequest, NextResponse } from "next/server";
import { chat, type LLMProvider } from "@/lib/ai-provider";
import { type SkillParameter, SKILL_GENERATE_PROMPT } from "@/lib/skill-parser";
import { requirePermission } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("skills-generate-api");

interface GenerateRequestBody {
  workLog?: string;
  conversation?: Array<{ role: string; content: string }>;
  provider?: string;
}

// 降级模式：基于关键词简单分类（AI 调用失败或未配置时使用）
function fallbackGenerateSkill(
  workLog: string,
  conversation: Array<{ role: string; content: string }> = []
): {
  name: string;
  description: string;
  category: string;
  tags: string[];
  parameters: SkillParameter[];
  content: string;
  promptTemplate: string;
} {
  const text = (workLog + " " + conversation.map((c) => c.content).join(" ")).toLowerCase();

  let category = "general";
  let name = "通用工作技能";
  let description = "从工作记录中提取的通用工作流程";
  let tags: string[] = ["工作流程"];

  if (/财务|预算|成本|收入|利润|预测/.test(text)) {
    category = "finance";
    name = "财务分析技能";
    description = "基于工作记录提取的财务分析流程";
    tags = ["财务", "分析"];
  } else if (/周报|月报|报告|总结|汇报/.test(text)) {
    category = "report";
    name = "报告生成技能";
    description = "基于工作记录提取的报告生成流程";
    tags = ["报告", "总结"];
  } else if (/代码|审查|review|code/.test(text)) {
    category = "review";
    name = "审查技能";
    description = "基于工作记录提取的审查流程";
    tags = ["审查"];
  } else if (/知识|蒸馏|提取|认知/.test(text)) {
    category = "knowledge";
    name = "知识处理技能";
    description = "基于工作记录提取的知识处理流程";
    tags = ["知识"];
  } else if (/会议|纪要|议程|meeting/.test(text)) {
    category = "meeting";
    name = "会议处理技能";
    description = "基于工作记录提取的会议处理流程";
    tags = ["会议"];
  } else if (/产品|需求|规划|product/.test(text)) {
    category = "product";
    name = "产品规划技能";
    description = "基于工作记录提取的产品规划流程";
    tags = ["产品"];
  }

  return {
    name,
    description,
    category,
    tags,
    parameters: [
      {
        key: "context",
        label: "工作上下文",
        type: "textarea",
        required: true,
        placeholder: "粘贴相关工作内容或背景信息...",
      },
    ],
    content: `# ${name}\n\n## 步骤\n1. 分析工作上下文\n2. 识别关键信息\n3. 提取可复用模式\n4. 输出结构化结果\n\n## 说明\n该技能基于工作记录自动生成，可根据实际需求调整参数和提示词。`,
    promptTemplate: `你是一个专业助手。请基于以下工作上下文完成任务：\n\n{{context}}\n\n请输出：1.关键信息提取 2.模式识别 3.可复用建议`,
  };
}

// POST /api/skills/generate - AI 对话生成 Skill
// body: { conversation: [{role, content}], workLog: string, provider?: "deepseek" | "mimo" }
export async function POST(req: NextRequest) {
  const auth = await requirePermission("skill:generate");
  if (auth.error) return auth.error;
  try {
    const body = (await req.json()) as GenerateRequestBody;
    // 输入校验：workLog 必须为字符串（长度上限 10000），conversation 必须为数组
    if (typeof body.workLog !== "undefined" && body.workLog !== null && typeof body.workLog !== "string") {
      return NextResponse.json({ error: "workLog 必须为字符串" }, { status: 400 });
    }
    if (body.workLog && body.workLog.length > 10000) {
      return NextResponse.json({ error: "workLog 不能超过 10000 字符" }, { status: 400 });
    }
    if (body.conversation !== undefined && !Array.isArray(body.conversation)) {
      return NextResponse.json({ error: "conversation 必须为数组" }, { status: 400 });
    }
    const workLog = body.workLog || "";
    const conversation = body.conversation || [];

    if (!workLog.trim() && conversation.length === 0) {
      return NextResponse.json(
        { error: "请提供工作记录或对话内容" },
        { status: 400 }
      );
    }

    // 校验 provider 参数
    let resolvedProvider: LLMProvider | undefined;
    if (body.provider !== undefined && body.provider !== null) {
      if (body.provider !== "deepseek" && body.provider !== "mimo") {
        return NextResponse.json(
          { error: `不支持的 provider：${body.provider}` },
          { status: 400 }
        );
      }
      resolvedProvider = body.provider;
    }

    // 构建 AI 请求
    const conversationText = conversation
      .map((c) => `${c.role}: ${c.content}`)
      .join("\n\n");

    const userPrompt = `请分析以下工作记录和对话，提取一个可复用的 Skill 技能模板。

工作记录：
${workLog || "(无)"}

对话历史：
${conversationText || "(无)"}

请按照系统提示的 JSON 格式输出 Skill。`;

    // 调用 AI，失败时降级为 fallback
    let skillText: string;
    try {
      const result = await chat(
        [{ role: "user", content: userPrompt }],
        { provider: resolvedProvider, system: SKILL_GENERATE_PROMPT }
      );
      skillText = result.content;
    } catch (e) {
      logger.error({ err: e }, "AI 生成 Skill 失败，降级为 fallback");
      const fallback = fallbackGenerateSkill(workLog, conversation);
      const errMsg = (e as Error).message || "未知错误";
      return NextResponse.json({
        skill: { ...fallback, source: "ai-generated" },
        fallback: true,
        fallbackReason: `AI 调用失败（${errMsg}）。已降级为基于关键词的简单分类，质量较低。请检查 .env 中的 DEEPSEEK_API_KEY / MIMO_API_KEY 配置，或稍后重试。`,
      });
    }

    // 解析 AI 返回的 JSON
    let skillData: Record<string, unknown>;
    try {
      // 提取 JSON（可能被 ```json 包裹）
      const text = skillText.trim();
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : text;
      skillData = JSON.parse(jsonStr);
    } catch {
      // JSON 解析失败，回退到 fallback
      const fallback = fallbackGenerateSkill(workLog, conversation);
      return NextResponse.json({
        skill: { ...fallback, source: "ai-generated" },
        fallback: true,
        parseError: true,
        fallbackReason: "AI 返回的内容无法解析为 JSON。已降级为基于关键词的简单分类。建议重试或更换 provider。",
      });
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
              type: (typeof p.type === "string"
                ? p.type
                : "text") as SkillParameter["type"],
              required: p.required === true,
              placeholder:
                typeof p.placeholder === "string" ? p.placeholder : undefined,
              options: Array.isArray(p.options)
                ? p.options.map((x) => String(x))
                : undefined,
              defaultValue:
                typeof p.defaultValue === "string"
                  ? p.defaultValue
                  : undefined,
            };
          })
          .filter((x): x is SkillParameter => x !== null)
      : [];

    const skill = {
      name: typeof skillData.name === "string" ? skillData.name : "未命名技能",
      description:
        typeof skillData.description === "string"
          ? skillData.description
          : "",
      category:
        typeof skillData.category === "string"
          ? skillData.category
          : "general",
      tags: Array.isArray(skillData.tags)
        ? skillData.tags.map((t) => String(t))
        : [],
      parameters,
      content:
        typeof skillData.content === "string" ? skillData.content : "",
      promptTemplate:
        typeof skillData.promptTemplate === "string"
          ? skillData.promptTemplate
          : "",
      source: "ai-generated" as const,
    };

    return NextResponse.json({ skill });
  } catch (e) {
    logger.error({ err: e }, "AI 生成 Skill 失败");
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    );
  }
}

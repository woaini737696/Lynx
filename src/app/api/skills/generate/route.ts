import { NextRequest, NextResponse } from "next/server";
import { chat, type LLMProvider } from "@/lib/ai-provider";
import type { SkillParameter } from "@/lib/skill-parser";
import { requirePermission } from "@/lib/auth-utils";

// AI 生成 Skill 的系统提示词
const SKILL_GENERATE_PROMPT = `你是一个技能提取专家。用户会提供一段工作记录（可能附带与 AI 的对话历史），你的任务是：

1. 分析工作记录，识别其中可复用的工作模式/流程
2. 将其抽象为一个参数化的 Skill（技能模板），使其能在类似场景下重复使用
3. 为 Skill 设计合理的参数（用 {{param}} 占位）

请用 JSON 输出，格式如下：
{
  "name": "技能名称（简洁，2-8字）",
  "description": "技能描述（一句话说明用途）",
  "category": "general | finance | report | review | knowledge | meeting | product | custom",
  "tags": ["标签1", "标签2"],
  "parameters": [
    {
      "key": "paramKey（英文驼峰）",
      "label": "参数标签（中文）",
      "type": "text | textarea | select | date | number",
      "required": true,
      "placeholder": "输入提示（可选）",
      "options": ["选项1", "选项2"],
      "defaultValue": "默认值（可选）"
    }
  ],
  "content": "Markdown 正文，包含 # 标题、## 步骤（编号列表）、说明等",
  "promptTemplate": "AI 提示词模板，用 {{paramKey}} 引用参数"
}

分类规则：
- finance：财务相关（预测、分析、预算）
- report：报告生成（周报、月报、总结）
- review：审查类（代码审查、文档审查）
- knowledge：知识处理（蒸馏、提取、整理）
- meeting：会议相关（纪要、议程）
- product：产品相关（需求、规划）
- general：通用工作流程
- custom：无法归类的自定义技能

注意：
- parameters 可以为空数组（如果技能不需要参数）
- promptTemplate 中引用的 {{paramKey}} 必须在 parameters 中定义
- content 应包含清晰的步骤说明
- 只输出 JSON，不要其他内容`;

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
      console.error("AI 生成 Skill 失败，降级为 fallback:", e);
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
    console.error("AI 生成 Skill 失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

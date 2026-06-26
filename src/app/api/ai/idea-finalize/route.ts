import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { IDEA_FINALIZE_PROMPT } from "@/lib/ai";
import { chat, type ChatMessage, type LLMProvider } from "@/lib/ai-provider";
import { writeMemoryForIdea, writeMemoryForCognition } from "@/lib/memory-sync";
import { requireAuth } from "@/lib/auth-utils";

interface FinalizeResult {
  summary: string;
  tags: string[];
  suggestedColumn: string;
  reason: string;
  cognition: { type: string; content: string } | null;
}

// 降级模式：基于关键词的简单分类（AI 调用失败或未配置时使用）
function fallbackClassify(ideaDraft: string, messages: ChatMessage[]): FinalizeResult {
  const text = ideaDraft + " " + messages.map((m) => m.content).join(" ");
  const tags: string[] = [];

  if (/AI|人工智能|模型|GPT|大模型/.test(text)) tags.push("AI");
  if (/设计|UI|界面|交互|体验/.test(text)) tags.push("设计");
  if (/开发|代码|编程|实现|技术/.test(text)) tags.push("开发");
  if (/工作流|流程|自动化/.test(text)) tags.push("工作流");
  if (tags.length === 0) tags.push("灵感");

  let suggestedColumn = "inbox";
  if (/战略|长期|目标|愿景|北极星|1年/.test(text)) suggestedColumn = "northstar";
  else if (/战役|中期|阶段|1-3个月|季度/.test(text)) suggestedColumn = "campaign";
  else if (/任务|短期|本周|实现|开发|修复/.test(text)) suggestedColumn = "task";
  else if (/方法论|经验|提示词|模板|框架/.test(text)) suggestedColumn = "cognition";
  else if (/放弃|不可行|无价值|太难/.test(text)) suggestedColumn = "graveyard";

  const summary = `基于讨论，这个灵感的核心是：${ideaDraft.slice(0, 120)}`;
  const reason = `基于关键词匹配，建议归入${suggestedColumn}`;

  return {
    summary,
    tags,
    suggestedColumn,
    reason,
    cognition: null,
  };
}

// 从 AI 响应中解析 JSON（兼容 markdown 代码块）
function parseJSONResponse(text: string): any {
  let cleaned = text.trim();
  // 去除 markdown 代码块
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

// 灵感定稿 API（总结+分类+保存）
// Request: { messages: [{role, content}], ideaDraft: string, ideaId?: string, provider?: "deepseek" | "mimo" }
// Response: { idea, cognition?, summary, tags, suggestedColumn, reason }
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const { messages = [], ideaDraft, ideaId, provider } = await req.json();

    if (!ideaDraft || !ideaDraft.trim()) {
      return NextResponse.json(
        { error: "ideaDraft 不能为空" },
        { status: 400 }
      );
    }

    // 校验 provider 参数
    let resolvedProvider: LLMProvider | undefined;
    if (provider !== undefined && provider !== null) {
      if (provider !== "deepseek" && provider !== "mimo") {
        return NextResponse.json(
          { error: `不支持的 provider：${provider}` },
          { status: 400 }
        );
      }
      resolvedProvider = provider;
    }

    // 将前端消息转换为 ChatMessage[]
    const chatMessages: ChatMessage[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as ChatMessage["role"],
        content: m.content,
      })
    );

    let result: FinalizeResult;

    try {
      const conversation = chatMessages
        .map((m) => `${m.role === "user" ? "用户" : "AI"}: ${m.content}`)
        .join("\n");

      const prompt = IDEA_FINALIZE_PROMPT.replace("{{ideaDraft}}", ideaDraft).replace(
        "{{conversation}}",
        conversation || "(无对话记录)"
      );

      // 调用 AI 进行定稿分析
      const aiResult = await chat(
        [{ role: "user", content: prompt }],
        { provider: resolvedProvider }
      );

      const parsed = parseJSONResponse(aiResult.content);
      result = {
        summary: parsed.summary || ideaDraft,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        suggestedColumn: parsed.suggestedColumn || "inbox",
        reason: parsed.reason || "",
        cognition:
          parsed.cognition && parsed.cognition.type && parsed.cognition.content
            ? {
                type: parsed.cognition.type,
                content: parsed.cognition.content,
              }
            : null,
      };
    } catch (e) {
      console.error("AI 定稿失败，降级为 fallbackClassify:", e);
      result = fallbackClassify(ideaDraft, chatMessages);
    }

    // 保存/更新 Idea（status: inbox，添加 AI建议 标签）
    const ideaTags = [...result.tags, "AI建议"];

    let idea;
    if (ideaId) {
      // 更新已有灵感
      idea = await prisma.idea.update({
        where: { id: ideaId },
        data: {
          content: result.summary,
          tags: ideaTags,
          status: "inbox",
        },
      });
    } else {
      // 创建新灵感
      idea = await prisma.idea.create({
        data: {
          content: result.summary,
          source: "conversation",
          status: "inbox",
          tags: ideaTags,
        },
      });
      // 异步写入 Memory
      writeMemoryForIdea(idea.id, idea.content).catch(() => {});
    }

    // 生成 Cognition 记录（如有）
    let cognition = null;
    if (result.cognition && result.cognition.type && result.cognition.content) {
      try {
        cognition = await prisma.cognition.create({
          data: {
            type: result.cognition.type,
            content: result.cognition.content,
            source: "idea",
            ideaId: idea.id,
            tags: result.tags,
          },
        });
        // 异步写入 Memory
        writeMemoryForCognition(cognition.id, cognition.content).catch(() => {});
      } catch (e) {
        console.error("生成认知记录失败:", e);
      }
    }

    return NextResponse.json({
      idea,
      cognition,
      summary: result.summary,
      tags: result.tags,
      suggestedColumn: result.suggestedColumn,
      reason: result.reason,
    });
  } catch (e) {
    console.error("灵感定稿失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

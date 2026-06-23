import { NextRequest, NextResponse } from "next/server";
import { IDEA_COACH_PROMPT } from "@/lib/ai";
import { chat, type ChatMessage, type LLMProvider } from "@/lib/ai-provider";

// 降级回复（AI 调用失败或未配置时使用）
const FALLBACK_REPLY =
  "这个灵感很有意思！让我帮你梳理一下：\n1. 这个灵感的背景是什么？你是在什么场景下想到的？\n2. 你希望它最终达成什么效果？";

// 将完整文本以分块方式输出为 ReadableStream，模拟流式响应
function createTextStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      // 按字符分块输出，营造流式效果
      const chunkSize = 4;
      for (let i = 0; i < text.length; i += chunkSize) {
        controller.enqueue(encoder.encode(text.slice(i, i + chunkSize)));
        // 短暂等待，模拟网络流式延迟
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      controller.close();
    },
  });
}

// 灵感对话 API（流式响应）
// Request: { messages: [{role, content}], ideaDraft: string, provider?: "deepseek" | "mimo" }
// Response: SSE stream of AI reply
export async function POST(req: NextRequest) {
  try {
    const { messages = [], ideaDraft, provider } = await req.json();

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

    const system = IDEA_COACH_PROMPT.replace("{{ideaDraft}}", ideaDraft);

    // 构建消息列表：对话为空时添加触发消息让 AI 开始
    const allMessages: ChatMessage[] =
      messages.length === 0
        ? [{ role: "user", content: "(请根据我的灵感开始对话)" }]
        : messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

    // 调用 AI，失败时降级为 fallback 回复
    let replyText: string;
    try {
      const result = await chat(allMessages, {
        provider: resolvedProvider,
        system,
      });
      replyText = result.content;
    } catch (e) {
      console.error("灵感对话 AI 调用失败，使用降级回复:", e);
      replyText = FALLBACK_REPLY;
    }

    // 以流式格式返回
    const stream = createTextStream(replyText);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("灵感对话失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

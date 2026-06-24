import { NextRequest, NextResponse } from "next/server";
import {
  chat,
  chatStream,
  type ChatMessage,
  type MultimodalContent,
  type LLMProvider,
  type ReasoningMode,
} from "@/lib/ai-provider";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

// POST /api/ai/chat
// Request: { messages, provider?, model?, reasoningMode?, temperature?, maxTokens?, stream? }
// - messages 中 content 可为字符串或多模态数组 [{ type: "text", text }, { type: "image_url", image_url: { url } }]
// - stream 为 true 时返回 SSE 流式响应（逐字输出）
// - 否则返回完整 JSON：{ content, provider, model, usage }
// 限流：20 次/分钟
export async function POST(req: NextRequest) {
  try {
    // ============ Rate Limiting ============
    const ip = getClientKey(req);
    const rl = rateLimit(`ai-chat:${ip}`, 20, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "20",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误，需为 JSON" },
        { status: 400 }
      );
    }

    const {
      messages,
      provider,
      model,
      reasoningMode,
      temperature,
      maxTokens,
      stream,
    } = body as {
      messages?: unknown;
      provider?: string;
      model?: string;
      reasoningMode?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    };

    // 校验 messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages 必须为非空数组" },
        { status: 400 }
      );
    }

    // 校验每条消息格式（支持字符串和多模态数组两种 content）
    const validRoles = new Set(["system", "user", "assistant"]);
    const cleanMessages: ChatMessage[] = [];
    for (const m of messages) {
      if (
        !m ||
        typeof m !== "object" ||
        typeof (m as { role?: unknown }).role !== "string"
      ) {
        return NextResponse.json(
          { error: "messages 中每项需包含 role 字符串" },
          { status: 400 }
        );
      }
      const role = (m as { role: string }).role;
      if (!validRoles.has(role)) {
        return NextResponse.json(
          { error: `无效的 role：${role}` },
          { status: 400 }
        );
      }
      const rawContent = (m as { content?: unknown }).content;
      // content 可为字符串或多模态内容数组
      if (typeof rawContent === "string") {
        cleanMessages.push({
          role: role as ChatMessage["role"],
          content: rawContent,
        });
      } else if (Array.isArray(rawContent)) {
        // 校验多模态内容数组
        const parts: MultimodalContent[] = [];
        for (const part of rawContent) {
          if (!part || typeof part !== "object") continue;
          if (part.type === "text" && typeof part.text === "string") {
            parts.push({ type: "text", text: part.text });
          } else if (
            part.type === "image_url" &&
            part.image_url &&
            typeof part.image_url.url === "string"
          ) {
            parts.push({
              type: "image_url",
              image_url: { url: part.image_url.url },
            });
          }
        }
        if (parts.length === 0) {
          return NextResponse.json(
            { error: "多模态消息 content 数组不能为空" },
            { status: 400 }
          );
        }
        cleanMessages.push({
          role: role as ChatMessage["role"],
          content: parts,
        });
      } else {
        return NextResponse.json(
          { error: "messages 中 content 需为字符串或多模态数组" },
          { status: 400 }
        );
      }
    }

    // 校验 provider
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

    // 校验 reasoningMode
    let resolvedReasoningMode: ReasoningMode | undefined;
    if (reasoningMode !== undefined && reasoningMode !== null) {
      if (
        reasoningMode !== "fast" &&
        reasoningMode !== "standard" &&
        reasoningMode !== "deep"
      ) {
        return NextResponse.json(
          { error: `不支持的 reasoningMode：${reasoningMode}` },
          { status: 400 }
        );
      }
      resolvedReasoningMode = reasoningMode;
    }

    // 校验数值参数
    if (
      temperature !== undefined &&
      (typeof temperature !== "number" ||
        temperature < 0 ||
        temperature > 2)
    ) {
      return NextResponse.json(
        { error: "temperature 需为 0-2 之间的数字" },
        { status: 400 }
      );
    }
    if (
      maxTokens !== undefined &&
      (typeof maxTokens !== "number" || maxTokens <= 0)
    ) {
      return NextResponse.json(
        { error: "maxTokens 需为正整数" },
        { status: 400 }
      );
    }

    // ============ 流式响应（SSE）============
    if (stream === true) {
      const encoder = new TextEncoder();
      const streamBody = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (obj: unknown) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          };
          try {
            for await (const evt of chatStream(cleanMessages, {
              provider: resolvedProvider,
              model,
              reasoningMode: resolvedReasoningMode,
              temperature,
              maxTokens,
            })) {
              send(evt);
              // 遇到 error / done 后结束流
              if (evt.type === "error" || evt.type === "done") {
                break;
              }
            }
          } catch (e) {
            send({ type: "error", message: (e as Error).message || "流式响应异常" });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(streamBody, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // ============ 非流式响应（原有逻辑）============
    const result = await chat(cleanMessages, {
      provider: resolvedProvider,
      model,
      reasoningMode: resolvedReasoningMode,
      temperature,
      maxTokens,
    });

    return NextResponse.json({
      content: result.content,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
    });
  } catch (e) {
    const msg = (e as Error).message || "服务器错误";
    // 区分配置错误（400）和其他错误（500）
    const status =
      msg.includes("未配置") || msg.includes("不支持的 provider")
        ? 400
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

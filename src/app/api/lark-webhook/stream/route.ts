import { NextRequest, NextResponse } from "next/server";
import { subscribeWebhookEvents, getRecentEvents } from "@/lib/lark-webhook-handler";

// GET /api/lark-webhook/stream - SSE 实时事件流
// 替代 30 秒轮询，实现秒级实时推送。
// 客户端使用 EventSource 连接，收到事件后刷新任务列表。
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since") || undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 1. 先发送历史事件（回填 since 之后的事件）
      try {
        const history = await getRecentEvents(since);
        for (const evt of history) {
          send({ type: "event", ...evt });
        }
      } catch {}

      // 2. 发送 ready 标记
      send({ type: "ready", timestamp: new Date().toISOString() });

      // 3. 订阅实时事件
      const unsubscribe = subscribeWebhookEvents((evt) => {
        send({ type: "event", ...evt });
      });

      // 4. 心跳（每 30 秒发送 keepalive，防止连接超时）
      const heartbeat = setInterval(() => {
        try {
          send({ type: "ping", timestamp: new Date().toISOString() });
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // 5. 客户端断开时清理
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

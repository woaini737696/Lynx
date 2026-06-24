import { NextRequest, NextResponse } from "next/server";
import { handleWebhookEvent } from "@/lib/lark-webhook-handler";

// POST /api/lark-webhook/simulate - 模拟飞书 Webhook 事件（测试用）
// 在没有配置真实 Webhook 隧道时，可用于验证前端实时刷新链路
// body: { eventType: "task.task.created" | "task.task.updated" | ..., taskGuid?, summary? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventType, taskGuid, summary } = body as {
      eventType: string;
      taskGuid?: string;
      summary?: string;
    };

    const allowedTypes = [
      "task.task.created",
      "task.task.updated",
      "task.task.completed",
      "task.task.deleted",
      "task.task.reopened",
    ];

    if (!eventType || !allowedTypes.includes(eventType)) {
      return NextResponse.json(
        { error: "eventType 必须是: " + allowedTypes.join(", ") },
        { status: 400 }
      );
    }

    // 构造飞书事件订阅 v2 格式的事件体
    const simulatedEventId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const webhookBody = {
      schema: "2.0",
      header: {
        event_id: simulatedEventId,
        event_type: eventType,
        token: process.env.LARK_WEBHOOK_TOKEN || "simulated",
        app_id: "cli_simulated",
        tenant_key: "simulated",
      },
      event: {
        task: {
          guid: taskGuid || `sim_task_${Date.now()}`,
          summary: summary || `模拟任务 - ${eventType.split(".").pop()}`,
        },
      },
    };

    const result = await handleWebhookEvent(webhookBody);

    return NextResponse.json({
      success: true,
      eventId: simulatedEventId,
      processed: result.processed,
      deduplicated: result.deduplicated,
      message: result.processed
        ? `已模拟 ${eventType} 事件，前端将在 10 秒内自动刷新`
        : "事件未处理",
    });
  } catch (e) {
    console.error("模拟 webhook 事件失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

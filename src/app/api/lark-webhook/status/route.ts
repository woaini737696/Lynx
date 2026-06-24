import { NextResponse } from "next/server";
import { getRecentEvents } from "@/lib/lark-webhook-handler";

// GET /api/lark-webhook/status - 返回 Webhook 配置状态和统计信息
// 前端用于显示实时同步状态指示器
export async function GET() {
  try {
    const events = await getRecentEvents();
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;
    const tokenConfigured = Boolean(process.env.LARK_WEBHOOK_TOKEN);

    // 统计最近 24 小时内的事件数
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentCount = events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return !isNaN(t) && t > oneDayAgo;
    }).length;

    // 按事件类型分组统计
    const byType: Record<string, number> = {};
    for (const e of events) {
      byType[e.eventType] = (byType[e.eventType] || 0) + 1;
    }

    return NextResponse.json({
      configured: tokenConfigured,
      endpoint: "/api/lark-webhook",
      totalEvents: events.length,
      recentEvents24h: recentCount,
      lastEventAt: lastEvent?.timestamp || null,
      lastEventType: lastEvent?.eventType || null,
      lastEventSummary: lastEvent?.summary || null,
      eventsByType: byType,
      supportedTypes: [
        "task.task.created",
        "task.task.updated",
        "task.task.completed",
        "task.task.deleted",
        "task.task.reopened",
      ],
    });
  } catch (e) {
    console.error("获取 webhook 状态失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

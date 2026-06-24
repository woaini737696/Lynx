import { NextRequest, NextResponse } from "next/server";
import { getRecentEvents } from "@/lib/lark-webhook-handler";

// GET /api/lark-webhook/events - 返回最近的 webhook 事件列表
// 查询参数 since=ISO_TIMESTAMP：仅返回该时间戳之后的事件
// 前端每 10 秒轮询一次，发现新事件后刷新任务列表
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since") || undefined;
    const events = await getRecentEvents(since);
    return NextResponse.json({
      events,
      count: events.length,
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    console.error("获取 webhook 事件列表失败:", e);
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getSchedulerStatus } from "@/lib/flow-scheduler";

// GET /api/ai/flows/scheduler/status - 返回调度器状态
export async function GET() {
  try {
    const status = getSchedulerStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

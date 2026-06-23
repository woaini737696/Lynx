import { NextRequest, NextResponse } from "next/server";
import { runSync, readSyncState } from "@/lib/lark-sync";

// POST /api/lark-tasks/sync - 触发一次飞书任务同步
// 本地操作已实时推送到飞书，此接口用于主动拉取飞书侧变更并刷新同步状态。
export async function POST(_req: NextRequest) {
  try {
    const result = runSync();
    return NextResponse.json({
      success: result.ok,
      state: result.state,
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (e) {
    console.error("飞书任务同步失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// GET /api/lark-tasks/sync - 获取同步状态
export async function GET(_req: NextRequest) {
  try {
    const state = readSyncState();
    return NextResponse.json({ state });
  } catch (e) {
    console.error("获取同步状态失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { checkHermesUpdate, updateHermesAgent } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-update-api");

// GET /api/hermes/update - 检查 HermesAgent 是否有新版本
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const info = await checkHermesUpdate();
    return NextResponse.json(info);
  } catch (e) {
    logger.error({ err: e }, "检查 HermesAgent 更新失败");
    return NextResponse.json(
      {
        currentVersion: null,
        latestVersion: "unknown",
        hasUpdate: false,
        wheelFile: "",
        error: "服务器错误：" + (e as Error).message,
      },
      { status: 500 }
    );
  }
}

// POST /api/hermes/update - 执行更新（下载最新 wheel 并安装）
export async function POST() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const result = await updateHermesAgent();
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (e) {
    logger.error({ err: e }, "HermesAgent 更新失败");
    return NextResponse.json(
      {
        success: false,
        error: "服务器错误：" + (e as Error).message,
      },
      { status: 500 }
    );
  }
}

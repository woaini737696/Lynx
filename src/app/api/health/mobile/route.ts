import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";

const logger = getLogger("health-mobile-api");

/**
 * 移动端专用配置端点 - 无需鉴权
 * GET /api/health/mobile
 * 返回移动端需要的配置信息：最低版本、最新版本、维护状态等
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      minVersion: "0.1.0",
      latestVersion: "0.1.0",
      maintenance: false,
      message: null,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    logger.error({ err: e }, "移动端配置查询失败");
    return NextResponse.json(
      {
        minVersion: "0.1.0",
        latestVersion: "0.1.0",
        maintenance: false,
        message: null,
        error: "查询失败",
      },
      { status: 500 }
    );
  }
}

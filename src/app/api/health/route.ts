import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/health-monitor";
import { getLogger } from "@/lib/logger";

const logger = getLogger("health-api");

// 健康检查端点 - 无需鉴权（用于部署环境的健康探测）
// GET /api/health
// 返回 200 表示服务正常，500 表示服务降级
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await checkHealth();
    const statusCode = health.status === "ok" ? 200 : 503;
    return NextResponse.json(health, { status: statusCode });
  } catch (e) {
    logger.error({ err: e }, "健康检查失败");
    return NextResponse.json(
      {
        status: "down",
        error: "健康检查失败",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

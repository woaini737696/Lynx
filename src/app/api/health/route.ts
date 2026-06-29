// 健康检查端点 - 供部署脚本和监控系统调用
// GET /api/health → { ok: true, timestamp, uptime, memory }

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const mem = process.memoryUsage();
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
  });
}

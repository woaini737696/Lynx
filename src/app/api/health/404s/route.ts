import { NextRequest, NextResponse } from "next/server";
import {
  getRecentNotFoundLogs,
  getNotFoundStats,
  clearNotFoundLogs,
  logNotFound,
} from "@/lib/health-monitor";
import { requireAdmin } from "@/lib/auth-utils";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

// 404 监控端点
// GET    /api/health/404s?limit=50  - 获取最近的 404 日志 + 统计
// POST   /api/health/404s           - 客户端上报 404 访问（来自 not-found 页面）
// DELETE /api/health/404s           - 清空 404 日志（仅 admin）
export const dynamic = "force-dynamic";

// GET - 获取 404 日志
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50)
  );

  const logs = getRecentNotFoundLogs(limit);
  const stats = getNotFoundStats(20);

  return NextResponse.json({
    success: true,
    logs,
    stats,
    returnedAt: new Date().toISOString(),
  });
}

// POST - 客户端上报 404（来自 not-found 页面）
// body: { path, referer?, userAgent? }
// 限流：60 次/分钟（每个 IP）
export async function POST(req: NextRequest) {
  try {
    // 限流
    const ip = getClientKey(req);
    const rl = rateLimit(`health-404:${ip}`, 60, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "上报过于频繁" },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误" },
        { status: 400 }
      );
    }

    const path = typeof body.path === "string" ? body.path : "";
    if (!path || path.length > 500) {
      return NextResponse.json(
        { error: "path 字段无效" },
        { status: 400 }
      );
    }

    logNotFound({
      path,
      method: body.method || "GET",
      referer: body.referer || null,
      userAgent: body.userAgent || req.headers.get("user-agent"),
      ip,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    );
  }
}

// DELETE - 清空 404 日志（仅 admin）
export async function DELETE() {
  const auth = await requireAdmin();
  if (auth.user === null) return auth.error;

  const cleared = clearNotFoundLogs();
  return NextResponse.json({
    success: true,
    cleared,
    clearedAt: new Date().toISOString(),
  });
}


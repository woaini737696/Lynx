// Agent 操作审计日志 API
//
// 路由：
//   GET  /api/agent-audit               - 查询审计日志列表（支持分页/筛选）
//   GET  /api/agent-audit/stats          - 统计各等级/各操作次数
//   POST /api/agent-audit                - 写入审计日志（通常由 PC 端通过 WS 回传后由网关写入，本接口供调试/补录用）
//
// 审计等级：
//   L1 - 云端 CRUD 直执（无需审批）
//   L2 - 本地文件/浏览器首次授权
//   L3 - Shell/桌面 RPA 每次审批

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("agent-audit-api");

// 查询审计日志
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const url = new URL(req.url);
    const stats = url.searchParams.get("stats");

    // 统计接口
    if (stats === "1") {
      const where = { userId: auth.user.id };
      const [byLevel, byAction, byResult, total] = await Promise.all([
        prisma.agentAuditLog.groupBy({
          by: ["level"],
          where,
          _count: { _all: true },
        }),
        prisma.agentAuditLog.groupBy({
          by: ["action"],
          where,
          _count: { _all: true },
          orderBy: { _count: { action: "desc" } },
          take: 20,
        }),
        prisma.agentAuditLog.groupBy({
          by: ["result"],
          where,
          _count: { _all: true },
        }),
        prisma.agentAuditLog.count({ where }),
      ]);

      return NextResponse.json({
        total,
        byLevel: byLevel.map((g) => ({ level: g.level, count: g._count._all })),
        byAction: byAction.map((g) => ({ action: g.action, count: g._count._all })),
        byResult: byResult.map((g) => ({ result: g.result, count: g._count._all })),
      });
    }

    // 列表查询
    const page = Math.max(Number(url.searchParams.get("page") || "1"), 1);
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") || "20"), 100);
    const level = url.searchParams.get("level");
    const action = url.searchParams.get("action");
    const result = url.searchParams.get("result");
    const source = url.searchParams.get("source");

    const where: {
      userId: string;
      level?: string;
      action?: { contains: string };
      result?: string;
      source?: string;
    } = { userId: auth.user.id };
    if (level) where.level = level;
    if (action) where.action = { contains: action };
    if (result) where.result = result;
    if (source) where.source = source;

    const [logs, total] = await Promise.all([
      prisma.agentAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.agentAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    logger.error({ err: e }, "查询审计日志失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 写入审计日志（供 WS 网关或调试用）
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    if (!action) {
      return NextResponse.json({ error: "action 不能为空" }, { status: 400 });
    }

    const log = await prisma.agentAuditLog.create({
      data: {
        userId: auth.user.id,
        action,
        level: body?.level || "L1",
        detail: typeof body?.detail === "string" ? body.detail : "",
        authMode: body?.authMode || "approve",
        approved: body?.approved ?? false,
        result: body?.result || "success",
        source: body?.source || "web",
        deviceName: body?.deviceName || null,
        durationMs: body?.durationMs ?? null,
        error: body?.error || null,
      },
    });

    return NextResponse.json({ id: log.id, success: true });
  } catch (e) {
    logger.error({ err: e }, "写入审计日志失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

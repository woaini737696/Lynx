import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// 查询巡检日志
// 支持 { ruleId?, limit?, offset? } 分页
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const ruleId = searchParams.get("ruleId") || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    // 构造查询条件：通过 PatrolRule 关联过滤用户数据
    const whereClause: {
      ruleId?: string;
      rule?: { userId?: string };
    } = {};

    if (ruleId) {
      whereClause.ruleId = ruleId;
    }

    // 非 admin 只能看自己规则的日志
    if (user.role !== "admin") {
      whereClause.rule = { userId: user.id };
    }

    const [logs, total] = await Promise.all([
      prisma.patrolLog.findMany({
        where: whereClause,
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          rule: {
            select: { userId: true },
          },
        },
      }),
      prisma.patrolLog.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        ruleId: log.ruleId,
        ruleName: log.ruleName,
        scope: log.scope,
        success: log.success,
        results: log.results,
        hitCount: log.hitCount,
        durationMs: log.durationMs,
        error: log.error,
        startedAt: log.startedAt,
        finishedAt: log.finishedAt,
      })),
      total,
      limit,
      offset,
    });
  } catch (e) {
    console.error("查询巡检日志失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

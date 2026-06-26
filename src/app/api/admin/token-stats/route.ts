import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("token-stats-api");

/**
 * GET /api/admin/token-stats
 * 返回 Token 消耗统计：
 *   - summary: { today, yesterday, last7Days, total }
 *   - records: 最近 N 条 assistant 消息（含 tokens、provider、model、createdAt、sessionId、sessionTitle）
 *
 * 查询参数：
 *   - limit: records 条数，默认 50，最大 200
 *   - offset: 分页偏移，默认 0
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.user === null) return auth.error;

  try {
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
      200
    );
    const offset = Math.max(
      parseInt(url.searchParams.get("offset") || "0", 10),
      0
    );

    // 计算时间区间（本地时区，Asia/Shanghai）
    // 注意：MySQL 的 DATE() 函数基于服务器时区。这里用 JS 计算时间戳范围传给 Prisma
    const now = new Date();
    // 今日起始（00:00:00 本地）
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = todayStart;
    const last7DaysStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    // 并行查询：4 个汇总 + 记录列表
    const [
      todayAgg,
      yesterdayAgg,
      last7DaysAgg,
      totalAgg,
      records,
      totalRecordsCount,
    ] = await Promise.all([
      // 今日消耗
      prisma.chatMessage.aggregate({
        where: {
          role: "assistant",
          tokens: { gt: 0 },
          createdAt: { gte: todayStart, lte: now },
        },
        _sum: { tokens: true },
        _count: { _all: true },
      }),
      // 昨日消耗
      prisma.chatMessage.aggregate({
        where: {
          role: "assistant",
          tokens: { gt: 0 },
          createdAt: { gte: yesterdayStart, lt: yesterdayEnd },
        },
        _sum: { tokens: true },
        _count: { _all: true },
      }),
      // 近 7 天消耗
      prisma.chatMessage.aggregate({
        where: {
          role: "assistant",
          tokens: { gt: 0 },
          createdAt: { gte: last7DaysStart, lte: now },
        },
        _sum: { tokens: true },
        _count: { _all: true },
      }),
      // 累计消耗
      prisma.chatMessage.aggregate({
        where: {
          role: "assistant",
          tokens: { gt: 0 },
        },
        _sum: { tokens: true },
        _count: { _all: true },
      }),
      // 最近记录（含会话标题）
      prisma.chatMessage.findMany({
        where: {
          role: "assistant",
          tokens: { gt: 0 },
        },
        select: {
          id: true,
          tokens: true,
          provider: true,
          model: true,
          durationMs: true,
          createdAt: true,
          sessionId: true,
          session: {
            select: {
              title: true,
              userId: true,
              user: { select: { username: true, displayName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      // 总记录数（用于分页）
      prisma.chatMessage.count({
        where: {
          role: "assistant",
          tokens: { gt: 0 },
        },
      }),
    ]);

    // 按 provider 分组统计（用于详情展示）
    const byProvider = await prisma.chatMessage.groupBy({
      by: ["provider"],
      where: {
        role: "assistant",
        tokens: { gt: 0 },
        createdAt: { gte: last7DaysStart, lte: now },
      },
      _sum: { tokens: true },
      _count: { _all: true },
      orderBy: { _sum: { tokens: "desc" } },
    });

    return NextResponse.json({
      summary: {
        today: {
          tokens: todayAgg._sum.tokens || 0,
          count: todayAgg._count._all,
        },
        yesterday: {
          tokens: yesterdayAgg._sum.tokens || 0,
          count: yesterdayAgg._count._all,
        },
        last7Days: {
          tokens: last7DaysAgg._sum.tokens || 0,
          count: last7DaysAgg._count._all,
        },
        total: {
          tokens: totalAgg._sum.tokens || 0,
          count: totalAgg._count._all,
        },
      },
      byProvider: byProvider.map((r) => ({
        provider: r.provider || "unknown",
        tokens: r._sum.tokens || 0,
        count: r._count._all,
      })),
      records: records.map((r) => ({
        id: r.id,
        tokens: r.tokens || 0,
        provider: r.provider,
        model: r.model,
        durationMs: r.durationMs,
        createdAt: r.createdAt.toISOString(),
        sessionId: r.sessionId,
        sessionTitle: r.session?.title || "（已删除会话）",
        username: r.session?.user?.username || r.session?.user?.displayName || null,
      })),
      pagination: {
        offset,
        limit,
        total: totalRecordsCount,
        hasMore: offset + records.length < totalRecordsCount,
      },
    });
  } catch (e) {
    logger.error({ err: e }, "获取 Token 统计失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

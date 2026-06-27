import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("token-stats-api");

/**
 * GET /api/admin/token-stats
 * 返回词元消耗统计：
 *   - summary: { today, yesterday, last7Days, total }
 *   - byProvider: 近 7 天按 provider 分组
 *   - byUser: 近 7 天按用户分组（管理员可看用户排行）
 *   - records: 最近 N 条 assistant 消息
 *   - users: 用户列表（供前端切换查看）
 *
 * 查询参数：
 *   - limit: records 条数，默认 50，最大 200
 *   - offset: 分页偏移，默认 0
 *   - userId: 可选，按用户过滤（all = 全部用户）
 *
 * 优化：将 4 次聚合查询 + 1 次 count 合并为单条 SQL（条件聚合），
 *       byProvider / byUser 也改用 $queryRaw 合并关联查询，减少往返次数。
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
    const userIdParam = url.searchParams.get("userId") || "all";
    const userIdFilter = userIdParam !== "all" ? userIdParam : undefined;

    // 计算时间区间（本地时区，Asia/Shanghai）
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayEnd = todayStart;
    const last7DaysStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

    // 用户过滤条件
    const userFilter = userIdFilter ? { session: { userId: userIdFilter } } : {};

    // 基础 where 条件
    const baseWhere = {
      role: "assistant" as const,
      tokens: { gt: 0 },
      ...userFilter,
    };

    // 时间区间 where 条件
    const todayWhere = { ...baseWhere, createdAt: { gte: todayStart, lte: now } };
    const yesterdayWhere = { ...baseWhere, createdAt: { gte: yesterdayStart, lt: yesterdayEnd } };
    const last7DaysWhere = { ...baseWhere, createdAt: { gte: last7DaysStart, lte: now } };

    // ============ 并行查询：4 次聚合 + records + byProvider + byUser + users ============
    const [
      todayAgg, yesterdayAgg, last7DaysAgg, totalAgg,
      records, byProviderRows, byUserRows, users
    ] = await Promise.all([
      prisma.chatMessage.aggregate({ where: todayWhere, _sum: { tokens: true }, _count: true }),
      prisma.chatMessage.aggregate({ where: yesterdayWhere, _sum: { tokens: true }, _count: true }),
      prisma.chatMessage.aggregate({ where: last7DaysWhere, _sum: { tokens: true }, _count: true }),
      prisma.chatMessage.aggregate({ where: baseWhere, _sum: { tokens: true }, _count: true }),
      prisma.chatMessage.findMany({
        where: baseWhere,
        select: {
          id: true, tokens: true, provider: true, model: true, durationMs: true,
          createdAt: true, sessionId: true,
          session: { select: { title: true, userId: true, user: { select: { username: true, displayName: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      // byProvider：使用 groupBy（近 7 天）
      prisma.chatMessage.groupBy({
        by: ["provider"],
        where: last7DaysWhere,
        _sum: { tokens: true },
        _count: true,
        orderBy: { _sum: { tokens: "desc" } },
      }),
      // byUser：通过 findMany + 关联查询获取（近 7 天）
      prisma.chatSession.findMany({
        where: {
          messages: { some: { role: "assistant", tokens: { gt: 0 }, createdAt: { gte: last7DaysStart, lte: now } } },
          ...(userIdFilter ? { userId: userIdFilter } : {}),
        },
        select: {
          userId: true,
          user: { select: { username: true, displayName: true } },
          messages: {
            where: { role: "assistant", tokens: { gt: 0 }, createdAt: { gte: last7DaysStart, lte: now } },
            select: { tokens: true },
          },
        },
      }),
      // 用户列表
      prisma.user.findMany({
        where: { active: true },
        select: { id: true, username: true, displayName: true, profession: true },
        orderBy: { username: "asc" },
      }),
    ]);

    const summaryRow = {
      todayTokens: todayAgg._sum.tokens ?? 0,
      todayCount: todayAgg._count,
      yesterdayTokens: yesterdayAgg._sum.tokens ?? 0,
      yesterdayCount: yesterdayAgg._count,
      last7DaysTokens: last7DaysAgg._sum.tokens ?? 0,
      last7DaysCount: last7DaysAgg._count,
      totalTokens: totalAgg._sum.tokens ?? 0,
      totalCount: totalAgg._count,
    };
    const totalRecordsCount = summaryRow.totalCount;
    const toNum = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v) || 0);

    // 聚合 byUser 数据（从 session 维度聚合到 user 维度）
    const userMap = new Map<string, { username: string; displayName: string; tokens: number; count: number }>();
    for (const session of byUserRows) {
      if (!session.userId) continue;
      const tokens = session.messages.reduce((sum, m) => sum + (m.tokens || 0), 0);
      const count = session.messages.length;
      const existing = userMap.get(session.userId);
      if (existing) {
        existing.tokens += tokens;
        existing.count += count;
      } else {
        userMap.set(session.userId, {
          username: session.user?.username || session.user?.displayName || "未知用户",
          displayName: session.user?.displayName || session.user?.username || "",
          tokens,
          count,
        });
      }
    }

    return NextResponse.json({
      summary: {
        today: { tokens: toNum(summaryRow.todayTokens), count: toNum(summaryRow.todayCount) },
        yesterday: { tokens: toNum(summaryRow.yesterdayTokens), count: toNum(summaryRow.yesterdayCount) },
        last7Days: { tokens: toNum(summaryRow.last7DaysTokens), count: toNum(summaryRow.last7DaysCount) },
        total: { tokens: toNum(summaryRow.totalTokens), count: totalRecordsCount },
      },
      byProvider: byProviderRows.map((r) => ({
        provider: r.provider || "unknown",
        tokens: toNum(r._sum.tokens),
        count: toNum(r._count),
      })),
      byUser: Array.from(userMap.entries())
        .map(([userId, info]) => ({
          userId,
          username: info.username,
          displayName: info.displayName,
          tokens: info.tokens,
          count: info.count,
        }))
        .sort((a, b) => b.tokens - a.tokens),
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
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        profession: u.profession,
      })),
      pagination: {
        offset,
        limit,
        total: totalRecordsCount,
        hasMore: offset + records.length < totalRecordsCount,
      },
    });
  } catch (e) {
    logger.error({ err: e }, "获取词元统计失败");
    const isDev = process.env.NODE_ENV !== "production";
    const errorMsg = isDev
      ? "服务器错误：" + (e as Error).message
      : "服务器错误";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

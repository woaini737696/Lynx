import { NextRequest, NextResponse } from "next/server";
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

    // 基础 where 条件（按用户过滤）
    const baseWhere = {
      role: "assistant" as const,
      tokens: { gt: 0 },
      ...(userIdFilter
        ? { session: { userId: userIdFilter } }
        : {}),
    };

    const [
      todayAgg,
      yesterdayAgg,
      last7DaysAgg,
      totalAgg,
      records,
      totalRecordsCount,
    ] = await Promise.all([
      prisma.chatMessage.aggregate({
        where: { ...baseWhere, createdAt: { gte: todayStart, lte: now } },
        _sum: { tokens: true },
        _count: { _all: true },
      }),
      prisma.chatMessage.aggregate({
        where: { ...baseWhere, createdAt: { gte: yesterdayStart, lt: yesterdayEnd } },
        _sum: { tokens: true },
        _count: { _all: true },
      }),
      prisma.chatMessage.aggregate({
        where: { ...baseWhere, createdAt: { gte: last7DaysStart, lte: now } },
        _sum: { tokens: true },
        _count: { _all: true },
      }),
      prisma.chatMessage.aggregate({
        where: baseWhere,
        _sum: { tokens: true },
        _count: { _all: true },
      }),
      prisma.chatMessage.findMany({
        where: baseWhere,
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
      prisma.chatMessage.count({ where: baseWhere }),
    ]);

    // 按 provider 分组（近 7 天）
    const byProvider = await prisma.chatMessage.groupBy({
      by: ["provider"],
      where: { ...baseWhere, createdAt: { gte: last7DaysStart, lte: now } },
      _sum: { tokens: true },
      _count: { _all: true },
      orderBy: { _sum: { tokens: "desc" } },
    });

    // 按用户分组（近 7 天，用于排行）
    const byUserRaw = await prisma.chatMessage.groupBy({
      by: ["sessionId"],
      where: { role: "assistant", tokens: { gt: 0 }, createdAt: { gte: last7DaysStart, lte: now } },
      _sum: { tokens: true },
      _count: { _all: true },
    });

    // 查询所有会话对应的用户
    const sessionIds = byUserRaw.map((r) => r.sessionId);
    const sessions = sessionIds.length > 0
      ? await prisma.chatSession.findMany({
          where: { id: { in: sessionIds } },
          select: { id: true, userId: true, user: { select: { username: true, displayName: true } } },
        })
      : [];
    const sessionUserMap = new Map(sessions.map((s) => [s.id, s]));

    // 聚合到用户维度
    const userTokenMap = new Map<string, { username: string; displayName: string; tokens: number; count: number }>();
    for (const r of byUserRaw) {
      const session = sessionUserMap.get(r.sessionId);
      if (!session?.userId) continue;
      const existing = userTokenMap.get(session.userId);
      const username = session.user?.username || session.user?.displayName || "未知用户";
      const displayName = session.user?.displayName || session.user?.username || "";
      if (existing) {
        existing.tokens += r._sum.tokens || 0;
        existing.count += r._count._all;
      } else {
        userTokenMap.set(session.userId, { username, displayName, tokens: r._sum.tokens || 0, count: r._count._all });
      }
    }
    const byUser = Array.from(userTokenMap.entries())
      .map(([userId, info]) => ({ userId, ...info }))
      .sort((a, b) => b.tokens - a.tokens);

    // 用户列表（供前端切换查看）
    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, username: true, displayName: true, profession: true },
      orderBy: { username: "asc" },
    });

    return NextResponse.json({
      summary: {
        today: { tokens: todayAgg._sum.tokens || 0, count: todayAgg._count._all },
        yesterday: { tokens: yesterdayAgg._sum.tokens || 0, count: yesterdayAgg._count._all },
        last7Days: { tokens: last7DaysAgg._sum.tokens || 0, count: last7DaysAgg._count._all },
        total: { tokens: totalAgg._sum.tokens || 0, count: totalAgg._count._all },
      },
      byProvider: byProvider.map((r) => ({
        provider: r.provider || "unknown",
        tokens: r._sum.tokens || 0,
        count: r._count._all,
      })),
      byUser,
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

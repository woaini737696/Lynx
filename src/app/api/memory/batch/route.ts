import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildUserFilter } from "@/lib/auth-utils";
import { clearMemoryCache } from "@/lib/memory-cache";
import { getLogger } from "@/lib/logger";

const logger = getLogger("memory-batch-api");

// POST /api/memory/batch - 批量删除记忆节点
// body: { ids: string[] }（最多 100 个）
// 同步清理其他节点 connections 中对被删除节点的引用
export async function POST(req: NextRequest) {
  const { user, error } = await requirePermission("memory:delete");
  if (error) return error;
  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids
          .filter((x: unknown) => typeof x === "string" && (x as string).length >= 10 && (x as string).length <= 50)
          .slice(0, 100)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "ids 不能为空" }, { status: 400 });
    }

    // 查询这些记忆，验证归属权
    const memories = await prisma.memory.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true },
    });

    // 非 admin 仅能删除自己的记忆
    const forbidden = memories.some(
      (m) => m.userId && m.userId !== user.id
    );
    if (user.role !== "admin" && forbidden) {
      return NextResponse.json({ error: "无权删除他人的记忆" }, { status: 403 });
    }

    const validIds = memories.map((m) => m.id);
    if (validIds.length === 0) {
      return NextResponse.json({ error: "未找到可删除的记忆" }, { status: 404 });
    }

    // 收集被删 memory 的 userId 列表（admin 删他人 memory 时需清理对应缓存）
    const deletedOwners = Array.from(
      new Set(memories.map((m) => m.userId).filter((u): u is string => !!u))
    );

    // 清理其他节点对这些 Memory 的引用：缩小扫描范围到同一批 userId（per-user 图谱），避免全表扫描
    const all = await prisma.memory.findMany({
      where: {
        id: { notIn: validIds },
        ...(deletedOwners.length > 0 ? { userId: { in: deletedOwners } } : {}),
      },
      select: { id: true, connections: true, strength: true, userId: true },
    });
    const related = all.filter(
      (m) =>
        Array.isArray(m.connections) &&
        (m.connections as string[]).some((c) => validIds.includes(c))
    );

    // 批量提交：收集更新操作后用 $transaction 一次性执行（清理引用 → 批量删除）
    const result = await prisma.$transaction([
      ...related.map((r) => {
        const conns = (r.connections as string[]).filter((c) => !validIds.includes(c));
        return prisma.memory.update({
          where: { id: r.id },
          data: { connections: conns, strength: conns.length },
        });
      }),
      prisma.memory.deleteMany({
        where: { id: { in: validIds } },
      }),
    ]);

    // 清除缓存：操作者 + 被删 memory 的归属者，最后兜底清全部
    clearMemoryCache(user.id);
    for (const ownerId of deletedOwners) {
      if (ownerId !== user.id) clearMemoryCache(ownerId);
    }
    clearMemoryCache();

    // $transaction 数组形式：最后一个元素为 deleteMany 的结果
    const deleteResult = result[result.length - 1] as { count: number };
    logger.info({ deleted: deleteResult.count, userId: user.id }, "批量删除记忆完成");
    return NextResponse.json({
      success: true,
      deleted: deleteResult.count,
      requested: ids.length,
    });
  } catch (e) {
    logger.error({ err: e }, "批量删除记忆失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// GET /api/memory/batch?type=orphan - 查询孤立节点（无连边的记忆）
// 用于批量管理界面展示"可清理"的候选节点
export async function GET(req: NextRequest) {
  const { user, error } = await requirePermission("memory:read");
  if (error) return error;
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("type") || "all";

    const where = buildUserFilter(user);

    if (filter === "orphan") {
      // 孤立节点：connections 为空数组
      const orphans = await prisma.memory.findMany({
        where: { ...where, connections: { equals: "[]" } },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          id: true,
          type: true,
          content: true,
          strength: true,
          createdAt: true,
          ideaId: true,
          conversationId: true,
          cognitionId: true,
        },
      });
      return NextResponse.json({ nodes: orphans, count: orphans.length, filter: "orphan" });
    }

    // 默认返回全部节点（用于批量管理界面）
    const all = await prisma.memory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        type: true,
        content: true,
        strength: true,
        connections: true,
        createdAt: true,
        ideaId: true,
        conversationId: true,
        cognitionId: true,
      },
    });
    return NextResponse.json({ nodes: all, count: all.length, filter: "all" });
  } catch (e) {
    logger.error({ err: e }, "查询记忆节点失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

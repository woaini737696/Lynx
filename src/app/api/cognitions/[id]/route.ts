import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("cognitions-api");

// GET /api/cognitions/[id] - 查询单条认知
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requirePermission("cognition:read");
  if (error) return error;
  try {
    const { id } = params;
    const cog = await prisma.cognition.findUnique({ where: { id } });
    if (!cog) {
      return NextResponse.json({ error: "认知不存在" }, { status: 404 });
    }
    // 非 admin 仅能查看自己的认知
    if (user.role !== "admin" && cog.userId && cog.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }
    return NextResponse.json({ cognition: cog });
  } catch (e) {
    logger.error({ err: e }, "查询认知失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// DELETE /api/cognitions/[id] - 删除单条认知
// 同步清理关联的 Memory 节点，保持图谱一致
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requirePermission("cognition:delete");
  if (error) return error;
  try {
    const { id } = params;
    if (!id || typeof id !== "string" || id.length < 10 || id.length > 50) {
      return NextResponse.json({ error: "无效的 ID" }, { status: 400 });
    }
    const cog = await prisma.cognition.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!cog) {
      return NextResponse.json({ error: "认知不存在" }, { status: 404 });
    }
    // 非 admin 仅能删除自己的认知
    if (user.role !== "admin" && cog.userId && cog.userId !== user.id) {
      return NextResponse.json({ error: "无权删除他人的认知" }, { status: 403 });
    }

    // 同步删除关联 Memory 节点（若有），并清理其他节点 connections 中对该节点的引用
    const linkedMemories = await prisma.memory.findMany({
      where: { cognitionId: id },
      select: { id: true },
    });
    if (linkedMemories.length > 0) {
      const memoryIds = linkedMemories.map((m) => m.id);
      // 缩小扫描范围：仅查询同一用户的 Memory（per-user 图谱），避免全表扫描
      const all = await prisma.memory.findMany({
        where: {
          id: { notIn: memoryIds },
          ...(cog.userId ? { userId: cog.userId } : {}),
        },
        select: { id: true, connections: true, strength: true },
      });
      const related = all.filter(
        (m) =>
          Array.isArray(m.connections) &&
          (m.connections as string[]).some((c) => memoryIds.includes(c))
      );
      // 批量提交：收集更新操作后用 $transaction 一次性执行（清理引用 → 删 Memory → 删 Cognition）
      await prisma.$transaction([
        ...related.map((r) => {
          const conns = (r.connections as string[]).filter(
            (c) => !memoryIds.includes(c)
          );
          return prisma.memory.update({
            where: { id: r.id },
            data: { connections: conns, strength: conns.length },
          });
        }),
        prisma.memory.deleteMany({ where: { id: { in: memoryIds } } }),
        prisma.cognition.delete({ where: { id } }),
      ]);
    } else {
      await prisma.cognition.delete({ where: { id } });
    }
    logger.info({ cognitionId: id, userId: user.id }, "认知已删除");
    return NextResponse.json({ success: true, id });
  } catch (e) {
    logger.error({ err: e }, "删除认知失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

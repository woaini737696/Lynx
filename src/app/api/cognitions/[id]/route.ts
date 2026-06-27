import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("cognitions-api");

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
      // 清理其他节点对该 Memory 的引用
      const all = await prisma.memory.findMany({
        select: { id: true, connections: true, strength: true },
      });
      const related = all.filter(
        (m) =>
          !memoryIds.includes(m.id) &&
          Array.isArray(m.connections) &&
          (m.connections as string[]).some((c) => memoryIds.includes(c))
      );
      for (const r of related) {
        const conns = (r.connections as string[]).filter((c) => !memoryIds.includes(c));
        await prisma.memory.update({
          where: { id: r.id },
          data: { connections: conns, strength: conns.length },
        });
      }
      await prisma.memory.deleteMany({ where: { id: { in: memoryIds } } });
    }

    await prisma.cognition.delete({ where: { id } });
    logger.info({ cognitionId: id, userId: user.id }, "认知已删除");
    return NextResponse.json({ success: true, id });
  } catch (e) {
    logger.error({ err: e }, "删除认知失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

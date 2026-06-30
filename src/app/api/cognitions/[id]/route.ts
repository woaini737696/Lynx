import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { writeMemoryForCognition } from "@/lib/memory-sync";

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

// PATCH /api/cognitions/[id] - 编辑认知（内容/类型/标签）
// 内容变化时同步重算 Memory embedding，保持图谱一致
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requirePermission("cognition:extract");
  if (error) return error;
  try {
    const { id } = params;
    if (!id || typeof id !== "string" || id.length < 10 || id.length > 50) {
      return NextResponse.json({ error: "无效的 ID" }, { status: 400 });
    }
    const cog = await prisma.cognition.findUnique({
      where: { id },
      select: { id: true, userId: true, content: true, type: true, tags: true },
    });
    if (!cog) {
      return NextResponse.json({ error: "认知不存在" }, { status: 404 });
    }
    if (user.role !== "admin" && cog.userId && cog.userId !== user.id) {
      return NextResponse.json({ error: "无权编辑他人的认知" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { content, type, tags } = body as {
      content?: string;
      type?: string;
      tags?: string[];
    };

    // 校验
    if (content !== undefined && (typeof content !== "string" || content.trim().length === 0)) {
      return NextResponse.json({ error: "content 不能为空" }, { status: 400 });
    }
    if (type !== undefined && !["method", "experience", "prompt", "note"].includes(type)) {
      return NextResponse.json({ error: "type 必须是 method/experience/prompt/note" }, { status: 400 });
    }
    if (tags !== undefined && !Array.isArray(tags)) {
      return NextResponse.json({ error: "tags 必须是数组" }, { status: 400 });
    }

    const contentChanged = content !== undefined && content.trim() !== cog.content;
    const updated = await prisma.cognition.update({
      where: { id },
      data: {
        ...(content !== undefined && { content: content.trim() }),
        ...(type !== undefined && { type }),
        ...(tags !== undefined && { tags }),
      },
    });

    // 内容变化时重算 Memory embedding（先删旧 Memory 再写新 Memory）
    if (contentChanged) {
      try {
        await prisma.memory.deleteMany({ where: { cognitionId: id } });
        await writeMemoryForCognition(id, updated.content);
      } catch (e) {
        // embedding 失败不阻塞编辑，仅记日志
        logger.warn({ err: e, cognitionId: id }, "编辑后重算 embedding 失败（不阻塞）");
      }
    }

    logger.info({ cognitionId: id, userId: user.id, contentChanged }, "认知已编辑");
    return NextResponse.json({ success: true, cognition: updated });
  } catch (e) {
    logger.error({ err: e }, "编辑认知失败");
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-utils";
import { clearMemoryCache } from "@/lib/memory-cache";
import { getLogger } from "@/lib/logger";

const logger = getLogger("memory-api");

// 删除记忆节点：同时清理其他节点 connections 中对该节点的引用
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission("memory:delete");
  if (auth.error) return auth.error;
  try {
    const { id } = params;
    if (!id || typeof id !== "string" || id.length < 10 || id.length > 50) {
      return NextResponse.json({ error: "无效的 ID" }, { status: 400 });
    }
    const memory = await prisma.memory.findUnique({ where: { id } });
    if (!memory) {
      return NextResponse.json({ error: "记忆不存在" }, { status: 404 });
    }
    // 用户只能删除自己的 memory（admin 直通）
    if (auth.user.role !== "admin" && memory.userId && memory.userId !== auth.user.id) {
      return NextResponse.json({ error: "无权删除他人的记忆" }, { status: 403 });
    }

    // 缩小扫描范围：仅查询同一用户的 Memory（per-user 图谱），避免全表扫描
    const all = await prisma.memory.findMany({
      where: {
        id: { not: id },
        ...(memory.userId ? { userId: memory.userId } : {}),
      },
      select: { id: true, connections: true, strength: true },
    });
    const related = all.filter(
      (m) =>
        Array.isArray(m.connections) &&
        (m.connections as string[]).includes(id)
    );

    // 批量提交：收集更新操作后用 $transaction 一次性执行（清理引用 → 删节点）
    await prisma.$transaction([
      ...related.map((r) => {
        const conns = (r.connections as string[]).filter((c) => c !== id);
        return prisma.memory.update({
          where: { id: r.id },
          data: { connections: conns, strength: conns.length },
        });
      }),
      prisma.memory.delete({ where: { id } }),
    ]);

    // 清除缓存（记忆归属者 + 操作者）
    clearMemoryCache(memory.userId || auth.user.id);
    if (memory.userId && memory.userId !== auth.user.id) {
      clearMemoryCache(auth.user.id);
    }

    return NextResponse.json({ success: true, id });
  } catch (e) {
    logger.error({ err: e }, "删除记忆失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 更新记忆标签：仅更新 Memory.label 独立字段，不再覆盖源实体（Idea.content / Conversation.title / Cognition.content）
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 鉴权：修复此前遗漏的 requirePermission，避免未登录用户篡改记忆标签
  const auth = await requirePermission("memory:update");
  if (auth.error) return auth.error;
  try {
    const { id } = params;
    if (!id || typeof id !== "string" || id.length < 10 || id.length > 50) {
      return NextResponse.json({ error: "无效的 ID" }, { status: 400 });
    }
    const { label } = await req.json().catch(() => ({ label: "" }));

    if (!label || typeof label !== "string" || !label.trim()) {
      return NextResponse.json({ error: "标签不能为空" }, { status: 400 });
    }

    const memory = await prisma.memory.findUnique({ where: { id } });
    if (!memory) {
      return NextResponse.json({ error: "记忆不存在" }, { status: 404 });
    }
    // 非 admin 仅能更新自己的记忆
    if (auth.user.role !== "admin" && memory.userId && memory.userId !== auth.user.id) {
      return NextResponse.json({ error: "无权修改他人的记忆" }, { status: 403 });
    }

    const trimmed = label.trim().slice(0, 500);

    // 仅更新 Memory.label 独立字段，不再覆盖源实体内容（避免破坏 Idea.content / Conversation.title / Cognition.content）
    await prisma.memory.update({
      where: { id },
      data: { label: trimmed },
    });

    // 清除缓存
    clearMemoryCache(memory.userId || auth.user.id);

    return NextResponse.json({ success: true, id, label: trimmed });
  } catch (e) {
    logger.error({ err: e }, "更新记忆标签失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

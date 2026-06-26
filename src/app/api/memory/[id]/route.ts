import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-utils";

// 删除记忆节点：同时清理其他节点 connections 中对该节点的引用
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requirePermission("memory:delete");
  if (auth.error) return auth.error;
  try {
    const { id } = params;
    const memory = await prisma.memory.findUnique({ where: { id } });
    if (!memory) {
      return NextResponse.json({ error: "记忆不存在" }, { status: 404 });
    }
    // 用户只能删除自己的 memory（admin 直通）
    if (auth.user.role !== "admin" && memory.userId && memory.userId !== auth.user.id) {
      return NextResponse.json({ error: "无权删除他人的记忆" }, { status: 403 });
    }

    // 拉取所有记忆，在代码层过滤出 connections 中引用了该 id 的节点（Json 字段不便做数据库层过滤）
    const all = await prisma.memory.findMany({
      select: { id: true, connections: true, strength: true },
    });
    const related = all.filter(
      (m) =>
        m.id !== id &&
        Array.isArray(m.connections) &&
        (m.connections as string[]).includes(id)
    );

    // 移除其他节点对该节点的引用，并重算 strength
    for (const r of related) {
      const conns = (r.connections as string[]).filter((c) => c !== id);
      await prisma.memory.update({
        where: { id: r.id },
        data: { connections: conns, strength: conns.length },
      });
    }

    await prisma.memory.delete({ where: { id } });

    return NextResponse.json({ success: true, id });
  } catch (e) {
    console.error("删除记忆失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 更新记忆标签：同步更新源实体（Idea.content / Conversation.title / Cognition.content）与 Memory.content
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { label } = await req.json().catch(() => ({ label: "" }));

    if (!label || typeof label !== "string" || !label.trim()) {
      return NextResponse.json({ error: "标签不能为空" }, { status: 400 });
    }

    const memory = await prisma.memory.findUnique({ where: { id } });
    if (!memory) {
      return NextResponse.json({ error: "记忆不存在" }, { status: 404 });
    }

    const trimmed = label.trim();

    // 同步更新源实体，使标签在重建后仍然保持
    if (memory.ideaId) {
      await prisma.idea.update({
        where: { id: memory.ideaId },
        data: { content: trimmed },
      });
    } else if (memory.conversationId) {
      await prisma.conversation.update({
        where: { id: memory.conversationId },
        data: { title: trimmed },
      });
    } else if (memory.cognitionId) {
      await prisma.cognition.update({
        where: { id: memory.cognitionId },
        data: { content: trimmed },
      });
    }

    // 同步 Memory.content，保持缓存一致
    await prisma.memory.update({
      where: { id },
      data: { content: trimmed },
    });

    return NextResponse.json({ success: true, id, label: trimmed });
  } catch (e) {
    console.error("更新记忆标签失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

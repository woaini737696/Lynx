import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// 更新任务状态/位置
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = params;

    // 验证任务归属权
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { status, column, position } = await req.json();

    // 跨列移动 - 检查目标列满额
    if (column) {
      const col = column as "northstar" | "campaign" | "task";
      const limits = { northstar: 3, campaign: 5, task: 10 };
      const current = await prisma.task.findUnique({ where: { id } });
      if (current && current.column !== col) {
        const count = await prisma.task.count({
          where: { column: col, status: "active" },
        });
        if (count >= limits[col]) {
          return NextResponse.json(
            { error: `${col} 列已满，无法移入` },
            { status: 409 }
          );
        }
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(column && { column }),
        ...(position !== undefined && { position }),
      },
    });
    return NextResponse.json({ task, success: true });
  } catch (e) {
    console.error("更新任务失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 删除任务
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = params;

    // 验证任务归属权
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    await prisma.task.update({
      where: { id },
      data: { status: "dropped" },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("删除任务失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

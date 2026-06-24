import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";

// 获取今日聚焦
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dailyFocus = await prisma.dailyFocus.findFirst({
      where: { date: { gte: today, lt: tomorrow }, ...buildUserFilter(user) },
      include: {
        items: {
          include: { task: true },
          orderBy: { position: "asc" },
        },
      },
    });

    // 修复历史数据：如果 items 数量 > 3，截断为前 3 个
    if (dailyFocus && dailyFocus.items.length > 3) {
      const keepItems = dailyFocus.items.slice(0, 3);
      const keepIds = keepItems.map((i) => i.id);
      const keepTaskIds = keepItems.map((i) => i.taskId);

      // 删除多余的 items
      await prisma.dailyFocusItem.deleteMany({
        where: {
          dailyFocusId: dailyFocus.id,
          id: { notIn: keepIds },
        },
      });

      // 更新 cardIds
      await prisma.dailyFocus.update({
        where: { id: dailyFocus.id },
        data: { cardIds: keepTaskIds },
      });

      dailyFocus = { ...dailyFocus, items: keepItems, cardIds: keepTaskIds };
    }

    // 如果今天还没生成，自动生成
    if (!dailyFocus) {
      const activeTasks = await prisma.task.findMany({
        where: { status: "active", ...buildUserFilter(user) },
        orderBy: [{ column: "asc" }, { position: "asc" }],
        take: 3,
      });

      if (activeTasks.length > 0) {
        dailyFocus = await prisma.dailyFocus.create({
          data: {
            date: today,
            cardIds: activeTasks.map((t) => t.id),
            status: "pending",
            userId: user.id,
            items: {
              create: activeTasks.map((task, i) => ({
                taskId: task.id,
                position: i,
                completed: false,
              })),
            },
          },
          include: {
            items: { include: { task: true }, orderBy: { position: "asc" } },
          },
        });
      }
    }

    return NextResponse.json({ dailyFocus });
  } catch (e) {
    console.error("获取今日聚焦失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 完成聚焦卡片
export async function PATCH(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { itemId, completed } = await req.json();

    // 验证聚焦项归属权（通过 DailyFocus 关联）
    const item = await prisma.dailyFocusItem.findUnique({
      where: { id: itemId },
      include: { dailyFocus: { select: { userId: true } } },
    });
    if (!item) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (user.role !== "admin" && item.dailyFocus.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    await prisma.dailyFocusItem.update({
      where: { id: itemId },
      data: { completed },
    });

    // 即时同步对应 Task 的状态：完成→done，恢复→active
    await prisma.task.update({
      where: { id: item.taskId },
      data: { status: completed ? "done" : "active" },
    });

    // 检查是否全部完成
    const updatedItem = await prisma.dailyFocusItem.findUnique({
      where: { id: itemId },
      include: { dailyFocus: { include: { items: true } } },
    });
    let allDone = false;
    if (updatedItem) {
      allDone = updatedItem.dailyFocus.items.every((i) => i.completed);
      if (allDone) {
        await prisma.dailyFocus.update({
          where: { id: updatedItem.dailyFocusId },
          data: { status: "completed" },
        });
      }
    }

    return NextResponse.json({ success: true, allDone });
  } catch (e) {
    console.error("完成聚焦失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

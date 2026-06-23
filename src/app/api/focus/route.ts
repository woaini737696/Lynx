import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 获取今日聚焦
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dailyFocus = await prisma.dailyFocus.findFirst({
      where: { date: { gte: today, lt: tomorrow } },
      include: {
        items: {
          include: { task: true },
          orderBy: { position: "asc" },
        },
      },
    });

    // 如果今天还没生成，自动生成
    if (!dailyFocus) {
      const activeTasks = await prisma.task.findMany({
        where: { status: "active" },
        orderBy: [{ column: "asc" }, { position: "asc" }],
        take: 3,
      });

      if (activeTasks.length > 0) {
        dailyFocus = await prisma.dailyFocus.create({
          data: {
            date: today,
            cardIds: activeTasks.map((t) => t.id),
            status: "pending",
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
    const { itemId, completed } = await req.json();

    await prisma.dailyFocusItem.update({
      where: { id: itemId },
      data: { completed },
    });

    // 检查是否全部完成
    const item = await prisma.dailyFocusItem.findUnique({
      where: { id: itemId },
      include: { dailyFocus: { include: { items: true } } },
    });
    let allDone = false;
    if (item) {
      allDone = item.dailyFocus.items.every((i) => i.completed);
      if (allDone) {
        await prisma.dailyFocus.update({
          where: { id: item.dailyFocusId },
          data: { status: "completed" },
        });
        // 同时把对应 task 标记为 done
        const doneItems = item.dailyFocus.items;
        for (const i of doneItems) {
          await prisma.task.update({
            where: { id: i.taskId },
            data: { status: "done" },
          });
        }
      }
    }

    return NextResponse.json({ success: true, allDone });
  } catch (e) {
    console.error("完成聚焦失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

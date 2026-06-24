import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";

// 获取当前用户的任务统计
// 返回：totalCompleted / totalActive / thisWeekCompleted / byColumn
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const filter = buildUserFilter(user);

    // 已完成总数（status=done）
    const totalCompleted = await prisma.task.count({
      where: { status: "done", ...filter },
    });

    // 活跃任务总数（status=active）
    const totalActive = await prisma.task.count({
      where: { status: "active", ...filter },
    });

    // 本周完成数（本周一 00:00 至今）
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=周日, 1=周一...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + mondayOffset);

    const thisWeekCompleted = await prisma.task.count({
      where: {
        status: "done",
        updatedAt: { gte: monday },
        ...filter,
      },
    });

    // 按列统计（仅 active 任务）
    const [northstar, campaign, task] = await Promise.all([
      prisma.task.count({
        where: { column: "northstar", status: "active", ...filter },
      }),
      prisma.task.count({
        where: { column: "campaign", status: "active", ...filter },
      }),
      prisma.task.count({
        where: { column: "task", status: "active", ...filter },
      }),
    ]);

    return NextResponse.json({
      totalCompleted,
      totalActive,
      thisWeekCompleted,
      byColumn: { northstar, campaign, task },
    });
  } catch (e) {
    console.error("获取任务统计失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

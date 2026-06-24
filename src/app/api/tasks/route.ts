import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("tasks-api");

// 获取看板任务
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const tasks = await prisma.task.findMany({
      where: { status: { in: ["active", "done"] }, ...buildUserFilter(user) },
      orderBy: [{ column: "asc" }, { position: "asc" }],
    });
    return NextResponse.json({ tasks });
  } catch (e) {
    logger.error({ err: e }, "获取看板失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 新增看板任务（带满额阻断）
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { content, column } = await req.json();
    const col = column as "northstar" | "campaign" | "task";
    const limits = { northstar: 3, campaign: 5, task: 10 };

    const count = await prisma.task.count({
      where: { column: col, status: "active" },
    });
    if (count >= limits[col]) {
      return NextResponse.json(
        { error: `${col} 列已满（上限 ${limits[col]}），请先完成或降级` },
        { status: 409 }
      );
    }

    const task = await prisma.task.create({
      data: { content, column: col, position: count, status: "active", userId: user.id },
    });
    return NextResponse.json({ task, success: true });
  } catch (e) {
    logger.error({ err: e }, "新增任务失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

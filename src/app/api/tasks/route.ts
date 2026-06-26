import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { validateString, validateEnum } from "@/lib/validate";

const logger = getLogger("tasks-api");

// 看板列枚举（与 Prisma schema 注释保持一致）
const TASK_COLUMNS = ["northstar", "campaign", "task"] as const;
type TaskColumn = (typeof TASK_COLUMNS)[number];

// 获取看板任务
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const tasks = await prisma.task.findMany({
      where: { status: { in: ["active", "done"] }, ...buildUserFilter(user) },
      orderBy: [{ column: "asc" }, { position: "asc" }],
      take: 100, // 上限保护，避免数据增长后拉全表
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
    const { user, error } = await requirePermission("task:create");
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    // 输入校验：content max 5000，column 枚举
    const content = validateString(body?.content, 5000);
    if (!content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }
    const col = validateEnum<TaskColumn>(body?.column, TASK_COLUMNS);
    const limits: Record<TaskColumn, number> = { northstar: 3, campaign: 5, task: 10 };

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

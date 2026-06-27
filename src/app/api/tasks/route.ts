import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { validateString, validateEnum } from "@/lib/validate";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  decodeCursor,
  buildCursorWhereDesc,
  nextCursorFrom,
} from "@/lib/api-response";

const logger = getLogger("tasks-api");

// 看板列枚举（与 Prisma schema 注释保持一致）
const TASK_COLUMNS = ["northstar", "campaign", "task"] as const;
type TaskColumn = (typeof TASK_COLUMNS)[number];

// 获取看板任务（支持游标分页）
// GET /api/tasks?status=xxx&cursor=xxx&limit=50
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    // 支持 ?status=dropped 查询参数，返回软删除任务；默认返回 active + done 任务
    const status = searchParams.get("status");
    const statusFilter =
      status === "dropped"
        ? { status: "dropped" }
        : { status: { in: ["active", "done"] } };
    const cursorParam = searchParams.get("cursor");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);
    const cursor = decodeCursor(cursorParam);

    // 看板排序：column asc, position asc, id desc
    // 游标需匹配排序：{ column, position, id }
    let cursorWhere = {};
    if (cursor && cursor.column !== undefined && cursor.position !== undefined && cursor.id) {
      const cursorColumn = String(cursor.column);
      const cursorPosition = Number(cursor.position);
      const cursorId = String(cursor.id);
      cursorWhere = {
        OR: [
          { column: { gt: cursorColumn } },
          { AND: [{ column: cursorColumn }, { position: { gt: cursorPosition } }] },
          { AND: [{ column: cursorColumn }, { position: cursorPosition }, { id: { lt: cursorId } }] },
        ],
      };
    }

    const where = { ...statusFilter, ...buildUserFilter(user), ...cursorWhere };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [{ column: "asc" }, { position: "asc" }, { id: "desc" }],
        take: limit + 1,
      }),
      prisma.task.count({ where }),
    ]);

    const hasMore = tasks.length > limit;
    const data = hasMore ? tasks.slice(0, limit) : tasks;
    // 构建下一页游标（复合键：column, position, id）
    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({
          column: String(last.column),
          position: Number(last.position),
          id: String(last.id),
        })
      ).toString("base64url");
    }

    return paginatedResponse(data, total, hasMore, nextCursor);
  } catch (e) {
    logger.error({ err: e }, "获取看板失败");
    return errorResponse(500, "服务器错误");
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
      return errorResponse(400, "内容不能为空");
    }
    const col = validateEnum<TaskColumn>(body?.column, TASK_COLUMNS);
    const limits: Record<TaskColumn, number> = { northstar: 3, campaign: 5, task: 10 };

    const count = await prisma.task.count({
      where: { column: col, status: "active", ...buildUserFilter(user) },
    });
    if (count >= limits[col]) {
      return errorResponse(409, `${col} 列已满（上限 ${limits[col]}），请先完成或降级`);
    }

    const task = await prisma.task.create({
      data: { content, column: col, position: count, status: "active", userId: user.id },
    });
    return successResponse(task, 201);
  } catch (e) {
    logger.error({ err: e }, "新增任务失败");
    return errorResponse(500, "服务器错误");
  }
}

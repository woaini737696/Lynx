import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth-utils";
import { extractCognitionsForTask } from "@/lib/cognition-extract";
import { getLogger } from "@/lib/logger";

const logger = getLogger("tasks-api");

// 更新任务状态/位置
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission("task:manage");
    if (error) return error;

    const { id } = params;
    if (!id || typeof id !== "string" || id.length < 10 || id.length > 50) {
      return NextResponse.json({ error: "无效的 ID" }, { status: 400 });
    }

    // 验证任务归属权
    const existing = await prisma.task.findUnique({
      where: { id },
      include: { idea: { select: { content: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { status, column, position } = await req.json().catch(() => ({} as { status?: string; column?: string; position?: number }));

    // 枚举校验：避免任意字符串被强转写入数据库
    const validColumns = new Set(["northstar", "campaign", "task"]);
    if (column !== undefined && !validColumns.has(column as string)) {
      return NextResponse.json({ error: "无效的列" }, { status: 400 });
    }
    const validStatuses = new Set(["active", "done", "dropped"]);
    if (status !== undefined && !validStatuses.has(status as string)) {
      return NextResponse.json({ error: "无效的状态" }, { status: 400 });
    }

    // 跨列移动 - 检查目标列满额（复用 existing 记录，避免重复查询）
    if (column) {
      const col = column as "northstar" | "campaign" | "task";
      const limits = { northstar: 3, campaign: 5, task: 10 };
      if (existing.column !== col) {
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

    // 当状态变为 done 时，异步触发 AI 认知提取（不阻塞 PATCH 响应）
    // 提取完成后直接写入 Cognition 表，前端通过认知列表刷新查看
    if (status === "done" && existing.status !== "done") {
      // 异步执行，不 await，失败仅记日志
      extractCognitionsForTask(id, existing.content, existing.idea?.content || "", user.id).catch((e) => {
        logger.error({ err: e, taskId: id }, "异步认知提取失败");
      });
      logger.info({ taskId: id }, "任务已完成，认知提取已异步触发");
    }

    return NextResponse.json({
      task,
      success: true,
      cognitionExtracted: false,
      extractedCognitions: [],
      cognitionPending: status === "done" && existing.status !== "done",
    });
  } catch (e) {
    logger.error({ err: e }, "更新任务失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 删除任务
// 对已软删除（status=dropped）的任务执行硬删除（永久删除）；否则执行软删除
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission("task:delete");
    if (error) return error;

    const { id } = params;
    if (!id || typeof id !== "string" || id.length < 10 || id.length > 50) {
      return NextResponse.json({ error: "无效的 ID" }, { status: 400 });
    }

    // 验证任务归属权
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 已在回收站的任务执行永久删除；否则软删除送入回收站
    if (existing.status === "dropped") {
      await prisma.task.delete({ where: { id } });
    } else {
      await prisma.task.update({
        where: { id },
        data: { status: "dropped" },
      });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "删除任务失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

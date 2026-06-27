import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("tasks-cleanup");

// POST /api/tasks/cleanup-dropped - 清理 N 天前的软删除任务
// body: { retentionDays?: number }（默认取环境变量 TASK_DROPPED_RETENTION_DAYS，默认 30 天）
// 仅 admin 可调用
export async function POST(req: NextRequest) {
  const { user, error } = await requirePermission("task:delete");
  if (error) return error;
  try {
    const body = await req.json().catch(() => ({}));
    const retentionDays =
      typeof body.retentionDays === "number" && body.retentionDays > 0
        ? body.retentionDays
        : parseInt(process.env.TASK_DROPPED_RETENTION_DAYS || "30", 10);

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    // 查询符合条件的软删除任务（物理删除前先查出 sourceId，用于级联清理关联 Cognition）
    // 非 admin 仅清理自己的 dropped 任务（admin 视为全局，buildUserFilter 返回 {}）
    const userFilter = buildUserFilter(user);
    const tasksToDelete = await prisma.task.findMany({
      where: {
        status: "dropped",
        updatedAt: { lt: cutoff },
        ...userFilter,
      },
      select: { id: true, sourceId: true },
    });

    const taskIds = tasksToDelete.map((t) => t.id);
    // 收集关联的 idea id（sourceId），用于清理从该 task 提取的 auto-extract Cognition
    const ideaIds = Array.from(
      new Set(tasksToDelete.map((t) => t.sourceId).filter((s): s is string => !!s))
    );

    // 使用事务：先清理关联 Cognition，再物理删除任务，保证数据一致性
    const result = await prisma.$transaction(async (tx) => {
      if (ideaIds.length > 0) {
        await tx.cognition.deleteMany({
          where: {
            ideaId: { in: ideaIds },
            source: "auto-extract",
          },
        });
      }
      return tx.task.deleteMany({
        where: { id: { in: taskIds } },
      });
    });

    logger.info({ deleted: result.count, retentionDays, cutoff }, "清理软删除任务完成");
    return NextResponse.json({
      success: true,
      deleted: result.count,
      retentionDays,
      cutoff: cutoff.toISOString(),
    });
  } catch (e) {
    logger.error({ err: e }, "清理软删除任务失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

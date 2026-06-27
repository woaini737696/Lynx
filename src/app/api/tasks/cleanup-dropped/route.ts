import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-utils";
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

    // 查询符合条件的软删除任务
    const result = await prisma.task.deleteMany({
      where: {
        status: "dropped",
        updatedAt: { lt: cutoff },
      },
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

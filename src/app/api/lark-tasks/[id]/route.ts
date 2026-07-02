import { NextRequest, NextResponse } from "next/server";
import {
  updateTask,
  completeTask,
  reopenTask,
  assignTask,
  getTaskDetailAsync,
  getTaskFromDb,
  upsertTaskToDb,
  normalizeTask,
  enrichDetailMemberNames,
  getTasklists,
} from "@/lib/lark-sync";
import { getLogger } from "@/lib/logger";

const logger = getLogger("lark-tasks-detail-api");

// GET /api/lark-tasks/[id] - 获取单个任务详情
// 优先从 DB 缓存返回（快速），后台异步刷新 lark-cli
// db_only=true 时纯数据库读取（移动端用，不调用 lark-cli）
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const dbOnly = searchParams.get("db_only") === "true";

    // 优先从 DB 返回缓存（毫秒级）
    const dbTask = await getTaskFromDb(taskId);
    if (dbTask) {
      // 纯数据库模式不触发 lark-cli 后台刷新
      if (!dbOnly) {
        getTaskDetailAsync(taskId).then(async (detail) => {
          if (detail) {
            enrichDetailMemberNames(detail);
            const task = normalizeTask(detail);
            await upsertTaskToDb(task).catch(() => {});
          }
        }).catch(() => {});
      }
      return NextResponse.json({ task: dbTask, source: "db-cache" });
    }

    // 纯数据库模式下，DB 无数据直接返回 404，不调用 lark-cli
    if (dbOnly) {
      return NextResponse.json(
        { error: "任务不存在于本地数据库" },
        { status: 404 }
      );
    }

    // DB 无缓存时同步等待 lark-cli（首次加载）
    const detail = await getTaskDetailAsync(taskId);
    if (detail) {
      enrichDetailMemberNames(detail);
      getTasklists();
      const task = normalizeTask(detail);
      upsertTaskToDb(task).catch((e) => {
        logger.error({ err: e }, "[lark-tasks] GET 写入数据库失败");
      });
      return NextResponse.json({ task, source: "lark" });
    }

    return NextResponse.json(
      { error: "任务不存在或 lark-cli 不可用" },
      { status: 404 }
    );
  } catch (e) {
    logger.error({ err: e }, "获取飞书任务详情失败");
    const { id: taskId } = params;
    const dbTask = await getTaskFromDb(taskId);
    if (dbTask) {
      return NextResponse.json({ task: dbTask, source: "db-fallback" });
    }
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// PATCH /api/lark-tasks/[id]
// { action: "update", summary?, description?, due? }
// { action: "complete" }
// { action: "reopen" }
// { action: "assign", assignee }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "update") {
      const { summary, description, due, start, tasklistId } = body as {
        summary?: string;
        description?: string;
        due?: string;
        start?: string;
        tasklistId?: string;
      };
      const res = updateTask({
        taskId,
        summary: summary !== undefined ? summary : undefined,
        description: description !== undefined ? description : undefined,
        due: due !== undefined ? due : undefined,
        start: start !== undefined ? start : undefined,
        tasklistId: tasklistId !== undefined ? tasklistId : undefined,
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: "更新失败：" + res.error },
          { status: 502 }
        );
      }
      // 更新成功后同步到数据库
      await syncTaskToDb(taskId);
      return NextResponse.json({ success: true, task: res.task });
    }

    if (action === "complete") {
      const res = completeTask(taskId);
      if (!res.ok) {
        return NextResponse.json(
          { error: "标记完成失败：" + res.error },
          { status: 502 }
        );
      }
      // 更新数据库中的完成状态
      await syncTaskToDb(taskId);
      return NextResponse.json({ success: true });
    }

    if (action === "reopen") {
      const res = reopenTask(taskId);
      if (!res.ok) {
        return NextResponse.json(
          { error: "重开失败：" + res.error },
          { status: 502 }
        );
      }
      await syncTaskToDb(taskId);
      return NextResponse.json({ success: true });
    }

    if (action === "assign") {
      const { assignee } = body as { assignee: string };
      if (!assignee) {
        return NextResponse.json({ error: "缺少 assignee" }, { status: 400 });
      }
      const res = assignTask(taskId, assignee);
      if (!res.ok) {
        return NextResponse.json(
          { error: "分配失败：" + res.error },
          { status: 502 }
        );
      }
      await syncTaskToDb(taskId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (e) {
    logger.error({ err: e }, "飞书任务操作失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/**
 * 重新拉取任务详情并同步到数据库。
 * lark-cli 调用失败时静默忽略，不影响主流程返回。
 */
async function syncTaskToDb(taskId: string): Promise<void> {
  try {
    const detail = await getTaskDetailAsync(taskId);
    if (!detail) return;
    enrichDetailMemberNames(detail);
    const task = normalizeTask(detail);
    await upsertTaskToDb(task);
  } catch (e) {
    logger.error({ err: e }, `[lark-tasks] 同步任务到数据库失败 guid=${taskId}`);
  }
}

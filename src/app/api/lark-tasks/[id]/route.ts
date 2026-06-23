import { NextRequest, NextResponse } from "next/server";
import {
  updateTask,
  completeTask,
  reopenTask,
  assignTask,
  getTaskDetail,
  getTaskFromDb,
  upsertTaskToDb,
  normalizeTask,
  enrichDetailMemberNames,
  getTasklists,
} from "@/lib/lark-sync";

// GET /api/lark-tasks/[id] - 获取单个任务详情
// 始终优先从 lark-cli 拉取最新数据，DB 仅作为降级缓存
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }

    // 优先调用 lark-cli 获取最新详情
    const detail = getTaskDetail(taskId);
    if (detail) {
      // 解析成员昵称后归一化
      enrichDetailMemberNames(detail);
      // 获取任务清单列表以填充 tasklistNameCache
      getTasklists();
      const task = normalizeTask(detail);

      // 写入数据库缓存（后台执行不阻塞响应）
      upsertTaskToDb(task).catch((e) => {
        console.error("[lark-tasks] GET 写入数据库失败:", e);
      });

      return NextResponse.json({ task, source: "lark" });
    }

    // lark-cli 失败时回退到数据库缓存
    const dbTask = await getTaskFromDb(taskId);
    if (dbTask) {
      return NextResponse.json({ task: dbTask, source: "db-fallback" });
    }

    return NextResponse.json(
      { error: "任务不存在或 lark-cli 不可用" },
      { status: 404 }
    );
  } catch (e) {
    console.error("获取飞书任务详情失败:", e);
    // 异常时回退到数据库缓存
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
    console.error("飞书任务操作失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/**
 * 重新拉取任务详情并同步到数据库。
 * lark-cli 调用失败时静默忽略，不影响主流程返回。
 */
async function syncTaskToDb(taskId: string): Promise<void> {
  try {
    const detail = getTaskDetail(taskId);
    if (!detail) return;
    // 解析成员昵称后归一化写入数据库
    enrichDetailMemberNames(detail);
    const task = normalizeTask(detail);
    await upsertTaskToDb(task);
  } catch (e) {
    console.error(`[lark-tasks] 同步任务到数据库失败 guid=${taskId}:`, e);
  }
}

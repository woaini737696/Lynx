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
import {
  getFeishuToken,
  feishuUpdateTask,
  feishuCompleteTask,
  feishuUncompleteTask,
  feishuDeleteTask,
  feishuGetTask,
} from "@/lib/feishu-api";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
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

    // ===== 飞书 OAuth 路径：优先用用户自己的飞书账号拉取详情 =====
    if (!dbOnly) {
      const oauthUser = await getCurrentUser();
      if (oauthUser) {
        const accessToken = await getFeishuToken(oauthUser.id);
        if (accessToken) {
          const r = await feishuGetTask(accessToken, taskId);
          if (r.ok && r.task) {
            const task = normalizeTask(r.task);
            // 写入 DB 缓存（后台，不阻塞响应）
            upsertTaskToDb(task).catch((e) => {
              logger.error({ err: e }, "[lark-tasks] OAuth GET 写入数据库失败");
            });
            return NextResponse.json({ task, source: "feishu-oauth" });
          }
          // OAuth 拉取失败：回退到 DB 缓存 + lark-cli 路径
          logger.warn({ err: r.error, taskId }, "[lark-tasks] OAuth 获取详情失败，回退 DB/lark-cli");
        }
      }
    }

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
// { action: "update", summary?, description?, due?, start?, tasklistId? }
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

    // 获取当前用户：用于 OAuth 路径；未登录时为 null（回退到 lark-cli）
    const oauthUser = await getCurrentUser();
    const accessToken = oauthUser ? await getFeishuToken(oauthUser.id) : null;

    if (action === "update") {
      const { summary, description, due, start, tasklistId } = body as {
        summary?: string;
        description?: string;
        due?: string;
        start?: string;
        tasklistId?: string;
      };

      // ===== OAuth 路径：优先用用户自己的飞书账号更新任务 =====
      if (accessToken) {
        const feishuRes = await feishuUpdateTask(accessToken, taskId, {
          summary: summary !== undefined ? summary : undefined,
          description: description !== undefined ? description : undefined,
          due: due !== undefined ? (due || null) : undefined,
          start: start !== undefined ? (start || null) : undefined,
          tasklistGuid: tasklistId !== undefined ? tasklistId : undefined,
        });
        if (feishuRes.ok) {
          // 归一化并写入 DB 缓存，保持与 lark-cli 路径返回结构一致
          if (feishuRes.task) {
            const normalized = normalizeTask(feishuRes.task);
            upsertTaskToDb(normalized).catch((e) => {
              logger.error({ err: e }, "[lark-tasks] OAuth update 写入数据库失败");
            });
            return NextResponse.json({ success: true, task: normalized, source: "feishu-oauth" });
          }
          return NextResponse.json({ success: true, source: "feishu-oauth" });
        }
        // OAuth 更新失败：记录日志，回退到 lark-cli 路径
        logger.warn({ err: feishuRes.error, taskId }, "[lark-tasks] OAuth update 失败，回退 lark-cli");
      }

      // ===== lark-cli 回退路径（向后兼容）=====
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
      // ===== OAuth 路径：标记完成 =====
      if (accessToken) {
        const feishuRes = await feishuCompleteTask(accessToken, taskId);
        if (feishuRes.ok) {
          // 更新 DB 缓存中的完成状态
          await updateDbTaskCompleted(taskId, true);
          return NextResponse.json({ success: true, source: "feishu-oauth" });
        }
        logger.warn({ err: feishuRes.error, taskId }, "[lark-tasks] OAuth complete 失败，回退 lark-cli");
      }

      // ===== lark-cli 回退路径 =====
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
      // ===== OAuth 路径：取消完成（重开） =====
      if (accessToken) {
        const feishuRes = await feishuUncompleteTask(accessToken, taskId);
        if (feishuRes.ok) {
          await updateDbTaskCompleted(taskId, false);
          return NextResponse.json({ success: true, source: "feishu-oauth" });
        }
        logger.warn({ err: feishuRes.error, taskId }, "[lark-tasks] OAuth reopen 失败，回退 lark-cli");
      }

      // ===== lark-cli 回退路径 =====
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

      // ===== OAuth 路径：分配任务（通过 members 字段更新负责人） =====
      if (accessToken) {
        const feishuRes = await feishuUpdateTask(accessToken, taskId, {
          members: [{ id: assignee, type: "user", role: "assignee" }],
        });
        if (feishuRes.ok) {
          // 写入 DB 缓存以同步负责人变更
          if (feishuRes.task) {
            const normalized = normalizeTask(feishuRes.task);
            upsertTaskToDb(normalized).catch((e) => {
              logger.error({ err: e }, "[lark-tasks] OAuth assign 写入数据库失败");
            });
          }
          return NextResponse.json({ success: true, source: "feishu-oauth" });
        }
        logger.warn({ err: feishuRes.error, taskId }, "[lark-tasks] OAuth assign 失败，回退 lark-cli");
      }

      // ===== lark-cli 回退路径 =====
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

// DELETE /api/lark-tasks/[id] - 删除飞书任务
// 优先用 OAuth 路径（用户自己的飞书账号）；未绑定 OAuth 时返回错误
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = params;
    if (!taskId) {
      return NextResponse.json({ error: "缺少任务 ID" }, { status: 400 });
    }

    // OAuth 路径：必须绑定飞书账号才能删除（操作不可逆，不提供 lark-cli 回退）
    const oauthUser = await getCurrentUser();
    if (!oauthUser) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const accessToken = await getFeishuToken(oauthUser.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "未连接飞书账号，无法删除任务" },
        { status: 400 }
      );
    }

    const feishuRes = await feishuDeleteTask(accessToken, taskId);
    if (!feishuRes.ok) {
      logger.error({ err: feishuRes.error, taskId }, "[lark-tasks] OAuth delete 失败");
      return NextResponse.json(
        { error: "删除任务失败：" + (feishuRes.error || "未知错误") },
        { status: 502 }
      );
    }

    // 同步删除 DB 缓存中的任务（按 guid 删除，所有用户共享的缓存）
    await prisma.larkTask.deleteMany({ where: { guid: taskId } }).catch((e) => {
      logger.warn({ err: e, taskId }, "[lark-tasks] 删除 DB 缓存任务失败（忽略）");
    });

    return NextResponse.json({ success: true, source: "feishu-oauth" });
  } catch (e) {
    logger.error({ err: e }, "删除飞书任务失败");
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

/**
 * 直接更新 DB 缓存中任务的完成状态（OAuth 路径专用，避免依赖 lark-cli 重新拉取）。
 */
async function updateDbTaskCompleted(taskId: string, completed: boolean): Promise<void> {
  try {
    await prisma.larkTask.update({
      where: { guid: taskId },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
        status: completed ? "done" : "incomplete",
      },
    });
  } catch (e) {
    // DB 更新失败不影响主流程（可能是任务不在缓存中）
    logger.warn({ err: e, taskId }, `[lark-tasks] 更新 DB 完成状态失败（忽略）`);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getMyTasks,
  getRelatedTasks,
  getAllTasks,
  getAllTasksAsync,
  createTask,
  extractAssignees,
  extractTasklists,
  searchTasklists,
  getTasklists,
  readSyncState,
  upsertTasksToDb,
  getTasksFromDb,
  getAssigneesFromDb,
  getTasklistsFromDb,
  applyClientFilters,
  type NormalizedTask,
  type LarkMember,
  type LarkTasklistRef,
} from "@/lib/lark-sync";
import { getCurrentUser, requireAuth } from "@/lib/auth-utils";

/** 构建子任务映射：parentGuid → 子任务数组（从全量任务中提取） */
function buildSubtaskMap(allTasks: NormalizedTask[]): Record<string, NormalizedTask[]> {
  const map: Record<string, NormalizedTask[]> = {};
  for (const t of allTasks) {
    if (t.parentTaskGuid) {
      if (!map[t.parentTaskGuid]) map[t.parentTaskGuid] = [];
      map[t.parentTaskGuid].push(t);
    }
  }
  return map;
}

/** 后台异步刷新任务（不阻塞响应、不阻塞事件循环）：从 lark-cli 拉取并写入 DB */
async function refreshTasksInBackground() {
  try {
    // 使用异步版本，避免 execSync 阻塞 Node.js 事件循环
    const result = await getAllTasksAsync({ refresh: true });
    if (result.ok && result.allTasks.length > 0) {
      await upsertTasksToDb(result.allTasks).catch((e) => {
        console.error("[lark-tasks] 后台同步写入数据库失败:", e);
      });
    }
  } catch (e) {
    console.error("[lark-tasks] 后台刷新失败:", e);
  }
}

// GET /api/lark-tasks?view=my|related|all&complete=true|false&q=关键词&assignee=xxx&tasklist=xxx&refresh=true
export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const view = (searchParams.get("view") || "my") as "my" | "related" | "all";
  const completeRaw = searchParams.get("complete"); // "false" | "true" | null(全部)
  const q = searchParams.get("q")?.trim() || null;
  const assignee = searchParams.get("assignee") || null;
  const tasklist = searchParams.get("tasklist") || null;
  const meta = searchParams.get("meta") === "true"; // 仅获取筛选元数据
  const refresh = searchParams.get("refresh") === "true"; // 强制刷新（跳过数据库缓存）
  const fast = searchParams.get("fast") === "true"; // 快速模式：优先返回 DB 缓存，后台刷新
  const dbOnly = searchParams.get("db_only") === "true"; // 纯数据库模式：移动端用，不调用 lark-cli

  const complete =
    completeRaw === "true" ? true : completeRaw === "false" ? false : null;

  // ===== 纯数据库模式（移动端）：完全不依赖 lark-cli，只读数据库 =====
  if (dbOnly) {
    const me = await getCurrentUser();
    const myOpenId = (me as { openId?: string } | null)?.openId || "";
    const dbAllTasks = await getTasksFromDb({ complete: null });
    const filtered = applyClientFilters(dbAllTasks, {
      complete, q, assignee, tasklist, myOpenId, view,
    });
    const assignees = extractAssignees(dbAllTasks);
    const tasklists = extractTasklists(dbAllTasks);
    const subtaskMap = buildSubtaskMap(dbAllTasks);
    return NextResponse.json({
      tasks: filtered,
      assignees,
      tasklists,
      subtaskMap,
      myOpenId,
      source: "db-only",
    });
  }

  // meta 模式：返回筛选下拉选项（负责人清单 + 任务清单）+ 同步状态
  if (meta) {
    const syncState = readSyncState();
    // 优先从数据库聚合 assignees 和 tasklists（性能优化：不触发 lark-cli）
    let [assignees, tasklists] = await Promise.all([
      getAssigneesFromDb(),
      getTasklistsFromDb(),
    ]);

    // 仅当数据库完全为空时，才回退到 lark-cli 拉取一次以填充缓存
    if (assignees.length === 0 && tasklists.length === 0) {
      const base = getAllTasks({ complete: null, q: null });
      if (base.ok) {
        // 从已同步任务中聚合真实的 assignees（带 name）
        assignees = extractAssignees(base.tasks);
        tasklists = extractTasklists(base.tasks);
        // 写入数据库缓存
        upsertTasksToDb(base.tasks).catch((e) => {
          console.error("[lark-tasks] meta 写入数据库失败:", e);
        });
      }
    }

    // 调用 getTasklists() 获取真实任务清单列表（优先于 searchTasklists）
    const tlRes = getTasklists();
    if (tlRes.ok && tlRes.tasklists.length > 0) {
      const map = new Map<string, LarkTasklistRef>();
      for (const t of tasklists) if (t.guid) map.set(t.guid, t);
      for (const t of tlRes.tasklists) {
        const guid = t.guid || "";
        if (guid) {
          map.set(guid, { guid, name: t.name || map.get(guid)?.name || "" });
        }
      }
      tasklists = Array.from(map.values());
    } else {
      // getTasklists 失败时回退到 tasklist-search
      const searchRes = searchTasklists();
      if (searchRes.ok && searchRes.tasklists.length > 0) {
        const map = new Map<string, LarkTasklistRef>();
        for (const t of tasklists) if (t.guid) map.set(t.guid, t);
        for (const t of searchRes.tasklists) {
          const guid = t.guid || "";
          if (guid && !map.has(guid)) {
            map.set(guid, { guid, name: t.name });
          }
        }
        tasklists = Array.from(map.values());
      }
    }
    return NextResponse.json({
      assignees,
      tasklists,
      syncState,
    });
  }

  try {
    // ===== 快速模式：优先返回 DB 缓存，后台触发 lark-cli 刷新 =====
    if (fast && !refresh) {
      const me = await getCurrentUser();
      const myOpenId = (me as { openId?: string } | null)?.openId || "";
      // 从 DB 读取全量任务（不含视图过滤，用于构建 subtaskMap）
      const dbAllTasks = await getTasksFromDb({ complete: null });
      if (dbAllTasks.length > 0) {
        // 按视图+筛选条件过滤
        const filtered = applyClientFilters(dbAllTasks, {
          complete, q, assignee, tasklist, myOpenId, view,
        });
        const assignees = extractAssignees(dbAllTasks);
        const tasklists = extractTasklists(dbAllTasks);
        const subtaskMap = buildSubtaskMap(dbAllTasks);
        // 后台触发 lark-cli 刷新（延迟执行，不阻塞当前响应）
        setImmediate(() => refreshTasksInBackground());
        return NextResponse.json({
          tasks: filtered,
          assignees,
          tasklists,
          subtaskMap,
          myOpenId,
          source: "db-cache",
          refreshing: true,
        });
      }
      // DB 为空时继续走 lark-cli 慢路径（首次加载）
    }

    // ===== 慢路径：从 lark-cli 拉取最新数据 =====
    let result: { ok: boolean; tasks: NormalizedTask[]; allTasks: NormalizedTask[]; myOpenId: string; error?: string };

    if (view === "my") {
      result = getMyTasks({ complete, q, assignee, tasklist, refresh });
    } else if (view === "related") {
      result = getRelatedTasks({ complete, q, assignee, tasklist, refresh });
    } else {
      // all
      result = getAllTasks({ complete, q, assignee, tasklist, refresh });
    }

    if (!result.ok) {
      // lark-cli 失败时回退到数据库缓存，避免前端报错
      const dbTasks = await getTasksFromDb({ complete, assignee, tasklist });
      if (dbTasks.length > 0) {
        const dbAll = await getTasksFromDb({ complete: null });
        const assignees = extractAssignees(dbAll);
        const tasklists = extractTasklists(dbAll);
        const subtaskMap = buildSubtaskMap(dbAll);
        return NextResponse.json({ tasks: dbTasks, assignees, tasklists, subtaskMap, myOpenId: result.myOpenId, source: "db-fallback" });
      }
      // DB 也为空：返回空列表 + lark-cli 不可用提示（不返回 502 错误，避免前端崩溃）
      return NextResponse.json({
        tasks: [],
        assignees: [],
        tasklists: [],
        subtaskMap: {},
        myOpenId: "",
        source: "lark-cli-unavailable",
        warning: "飞书任务暂不可用（服务器不运行 CLI）。请在您的电脑上打开 Lynx 桌面端或 Web 端并登录，飞书任务将通过您本地的在线设备执行。",
      });
    }

    const tasks = result.tasks;
    // 从全量数据聚合assignees和tasklists（过滤条件不影响筛选下拉选项）
    const allAssignees = extractAssignees(result.allTasks);
    const allTasklists = extractTasklists(result.allTasks);
    // 构建子任务映射（从全量数据，确保子任务不丢失）
    const subtaskMap = buildSubtaskMap(result.allTasks);

    // 同步后写入数据库（upsert，后台执行不阻塞响应）
    if (result.allTasks.length > 0) {
      upsertTasksToDb(result.allTasks).catch((e) => {
        console.error("[lark-tasks] 同步写入数据库失败:", e);
      });
    }

    return NextResponse.json({ tasks, assignees: allAssignees, tasklists: allTasklists, subtaskMap, myOpenId: result.myOpenId, source: "lark" });
  } catch (e) {
    console.error("获取飞书任务失败:", e);
    // 异常时回退到数据库缓存
    const dbTasks = await getTasksFromDb({ complete, assignee, tasklist });
    if (dbTasks.length > 0) {
      const dbAll = await getTasksFromDb({ complete: null });
      const assignees = extractAssignees(dbAll);
      const tasklists = extractTasklists(dbAll);
      const subtaskMap = buildSubtaskMap(dbAll);
      return NextResponse.json({ tasks: dbTasks, assignees, tasklists, subtaskMap, source: "db-fallback" });
    }
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST /api/lark-tasks
// { action: "create", summary, description?, due?, assignee?, tasklistId? }
// { action: "import", taskId, summary }  // 导入飞书任务到决策看板
// { action: "push", localTaskId }  // 本地看板任务推送到飞书
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await req.json();
    const { action } = body;

    // 创建飞书任务（实时推送）
    if (action === "create") {
      const {
        summary,
        description,
        due,
        start,
        assignee,
        assignees,
        followers,
        tasklistId,
      } = body as {
        summary: string;
        description?: string;
        due?: string;
        start?: string;
        assignee?: string;
        assignees?: string[];
        followers?: string[];
        tasklistId?: string;
      };
      if (!summary || !summary.trim()) {
        return NextResponse.json({ error: "缺少 summary" }, { status: 400 });
      }
      const res = createTask({
        summary: summary.trim(),
        description: description?.trim() || undefined,
        due: due || undefined,
        start: start || undefined,
        assignee: assignee || undefined,
        assignees: assignees,
        followers: followers,
        tasklistId: tasklistId || undefined,
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: "创建失败：" + res.error },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true, task: res.task });
    }

    // 导入飞书任务到决策看板
    if (action === "import") {
      const { taskId, summary, description } = body as {
        taskId: string;
        summary: string;
        description?: string;
      };
      if (!taskId || !summary) {
        return NextResponse.json(
          { error: "缺少 taskId 或 summary" },
          { status: 400 }
        );
      }

      // 获取当前用户，确保数据隔离
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: "未登录" }, { status: 401 });
      }

      // 去重：避免重复导入同一飞书任务（用 sourceId 存 guid，按 userId 隔离）
      const existing = await prisma.task.findFirst({
        where: { sourceId: taskId, status: "active", userId: user.id },
      });
      if (existing) {
        return NextResponse.json(
          { error: "该飞书任务已导入看板" },
          { status: 409 }
        );
      }

      // 检查 task 列满额（上限 10，按 userId 隔离）
      const count = await prisma.task.count({
        where: { column: "task", status: "active", userId: user.id },
      });
      if (count >= 10) {
        return NextResponse.json(
          { error: "任务列已满（上限 10），请先完成或降级" },
          { status: 409 }
        );
      }

      const content = description
        ? `${summary}\n${description}`.slice(0, 2000)
        : summary;
      const task = await prisma.task.create({
        data: {
          content,
          column: "task",
          position: count,
          status: "active",
          sourceId: taskId,
          userId: user.id,
        },
      });
      return NextResponse.json({ task, success: true });
    }

    // 本地看板任务推送到飞书
    if (action === "push") {
      const { localTaskId } = body as { localTaskId: string };
      if (!localTaskId) {
        return NextResponse.json({ error: "缺少 localTaskId" }, { status: 400 });
      }

      const localTask = await prisma.task.findUnique({
        where: { id: localTaskId },
      });
      if (!localTask) {
        return NextResponse.json(
          { error: "本地任务不存在" },
          { status: 404 }
        );
      }

      const res = createTask({
        summary: localTask.content.slice(0, 200),
        description:
          localTask.content.length > 200
            ? localTask.content.slice(200)
            : undefined,
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: "推送失败：" + res.error },
          { status: 502 }
        );
      }

      // 将飞书 guid 记录到本地任务的 sourceId（便于后续关联）
      const larkGuid = res.task?.guid || res.task?.task?.guid || null;
      if (larkGuid && !localTask.sourceId) {
        await prisma.task.update({
          where: { id: localTaskId },
          data: { sourceId: larkGuid },
        });
      }

      return NextResponse.json({
        success: true,
        larkTask: res.task,
        larkGuid,
      });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (e) {
    console.error("飞书任务操作失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 导出类型供前端使用
export type { NormalizedTask, LarkMember, LarkTasklistRef };

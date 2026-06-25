import { get, patch, post } from "./request.js";

/**
 * 获取飞书任务列表（纯数据库模式：移动端不依赖 lark-cli）
 * 后端契约：GET /api/lark-tasks?view=my&complete=null&db_only=true
 * 返回 { tasks, assignees, tasklists, subtaskMap, source: "db-only" }
 */
export function getLarkTasks(view = "my", complete = null) {
  const completeParam = complete === null ? "null" : String(complete);
  return get(
    `/api/lark-tasks?view=${view}&complete=${completeParam}&db_only=true`
  );
}

/** 获取单个飞书任务详情（纯数据库模式） */
export function getLarkTask(id) {
  return get(`/api/lark-tasks/${id}?db_only=true`);
}

/**
 * 切换飞书任务完成状态
 * 后端契约：PATCH /api/lark-tasks/[id] { action: "complete" | "reopen" }
 * 注意：此操作会调用 lark-cli 同步到飞书，移动端仅在数据库更新状态
 */
export function toggleLarkTask(id, completed) {
  return patch(`/api/lark-tasks/${id}`, {
    action: completed ? "complete" : "reopen",
  });
}

/**
 * 获取飞书任务同步状态
 * 后端契约：GET /api/lark-tasks/sync
 * 返回 { state: { lastSyncAt, lastError, taskCount } }
 */
export function getSyncState() {
  return get("/api/lark-tasks/sync");
}

/**
 * 触发一次飞书任务同步（手动）
 * 后端契约：POST /api/lark-tasks/sync
 * 返回 { success, state, error? }
 */
export function triggerSync() {
  return post("/api/lark-tasks/sync");
}

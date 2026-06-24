import { get, post, patch } from "./request.js";

/**
 * 获取飞书任务列表（快速模式：优先 DB 缓存，后台刷新）
 * 后端契约：GET /api/lark-tasks?view=my&complete=false&fast=true
 * 返回 { tasks, assignees, tasklists, subtaskMap, source }
 */
export function getLarkTasks(view = "my", complete = false) {
  return get(
    `/api/lark-tasks?view=${view}&complete=${complete}&fast=true`
  );
}

/** 强制刷新飞书任务（跳过缓存，从 lark-cli 拉取） */
export function refreshLarkTasks() {
  return get("/api/lark-tasks?view=my&complete=false&refresh=true");
}

/** 获取单个飞书任务详情 */
export function getLarkTask(id) {
  return get(`/api/lark-tasks/${id}`);
}

/**
 * 切换飞书任务完成状态
 * 后端契约：PATCH /api/lark-tasks/[id] { action: "complete" | "reopen" }
 */
export function toggleLarkTask(id, completed) {
  return patch(`/api/lark-tasks/${id}`, {
    action: completed ? "complete" : "reopen",
  });
}

/** 创建飞书任务 */
export function createLarkTask(data) {
  return post("/api/lark-tasks", { action: "create", ...data });
}

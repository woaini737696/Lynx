import { get, post } from "./request.js";

/** 获取飞书任务列表 */
export function getLarkTasks(params = {}) {
  return get("/api/lark-tasks");
}

/** 获取单个飞书任务详情 */
export function getLarkTask(id) {
  return get(`/api/lark-tasks/${id}`);
}

/** 同步飞书任务 */
export function syncLarkTasks() {
  return post("/api/lark-tasks/sync");
}

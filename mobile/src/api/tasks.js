import { get, post, put, del } from "./request.js";

/** 获取看板任务列表 */
export function getTasks() {
  return get("/api/tasks");
}

/** 创建看板任务 */
export function createTask(data) {
  return post("/api/tasks", data);
}

/** 更新任务（状态/列/位置） */
export function updateTask(id, data) {
  return put(`/api/tasks/${id}`, data);
}

/** 删除任务 */
export function deleteTask(id) {
  return del(`/api/tasks/${id}`);
}

/** 任务统计 */
export function getTaskStats() {
  return get("/api/tasks/stats");
}

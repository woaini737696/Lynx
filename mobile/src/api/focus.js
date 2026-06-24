import { get, post, put } from "./request.js";

/** 获取今日聚焦 */
export function getTodayFocus() {
  return get("/api/focus");
}

/** 生成今日聚焦 */
export function generateFocus() {
  return post("/api/focus");
}

/** 切换聚焦卡片完成状态 */
export function toggleFocusItem(itemId, completed) {
  return put("/api/focus", { itemId, completed });
}

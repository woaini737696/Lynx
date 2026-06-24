import { get, patch } from "./request.js";

/** 获取今日聚焦（后端 GET 自动生成，无需手动 POST） */
export function getTodayFocus() {
  return get("/api/focus");
}

/** 切换聚焦卡片完成状态（后端用 PATCH 方法） */
export function toggleFocusItem(itemId, completed) {
  return patch("/api/focus", { itemId, completed });
}

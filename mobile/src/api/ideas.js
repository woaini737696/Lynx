import { get, post, patch } from "./request.js";

/** 获取 Inbox 灵感列表 */
export function getInboxIdeas() {
  return get("/api/ideas");
}

/** 闪电输入 - 创建灵感 */
export function createIdea(content, source = "lightning", status = "inbox") {
  return post("/api/ideas", { content, source, status });
}

/**
 * 移入看板
 * 后端契约：PATCH /api/ideas/[id] { action: "board", column }
 */
export function moveIdeaToBoard(id, column) {
  return patch(`/api/ideas/${id}`, { action: "board", column });
}

/**
 * 放弃灵感（入墓地）
 * 后端契约：PATCH /api/ideas/[id] { action: "abandon", reason, reviveCondition }
 */
export function abandonIdea(id, reason, reviveCondition) {
  return patch(`/api/ideas/${id}`, { action: "abandon", reason, reviveCondition });
}

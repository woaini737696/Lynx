import { get, post } from "./request.js";

/** 获取 Inbox 灵感列表 */
export function getInboxIdeas() {
  return get("/api/ideas");
}

/** 闪电输入 - 创建灵感 */
export function createIdea(content, source = "lightning", status = "inbox") {
  return post("/api/ideas", { content, source, status });
}

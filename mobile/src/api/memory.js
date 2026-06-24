import { get, post } from "./request.js";

/** 记忆语义搜索 */
export function searchMemory(query) {
  return post("/api/memory/search", { query });
}

/** 获取记忆列表 */
export function getMemories() {
  return get("/api/memory");
}

/** 获取认知库列表 */
export function getCognitions() {
  return get("/api/cognitions");
}

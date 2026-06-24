import { get, post } from "./request.js";

/**
 * 获取记忆图谱数据（节点列表 + 连边 + 统计）
 * 后端契约：GET /api/memory
 * 返回 { nodes: [{ id, label, type, color, strength, connections, fullContent, createdAt }], edges, stats }
 */
export function getMemoryGraph() {
  return get("/api/memory");
}

/**
 * 记忆语义搜索
 * 后端契约：GET /api/memory/search?q=关键词
 * 返回 { results: [{ id, label, source, score, type }], total }
 */
export function searchMemory(query) {
  return get(`/api/memory/search?q=${encodeURIComponent(query)}`);
}

/** 获取记忆列表 */
export function getMemories() {
  return get("/api/memory");
}

/** 获取认知库列表 */
export function getCognitions() {
  return get("/api/cognitions");
}

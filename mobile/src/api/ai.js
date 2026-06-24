import { get, post } from "./request.js";

/** 获取对话会话列表 */
export function getChatSessions() {
  return get("/api/ai/chat/sessions");
}

/** 创建对话会话 */
export function createChatSession(data = {}) {
  return post("/api/ai/chat/sessions", data);
}

/** 获取会话消息列表 */
export function getChatMessages(sessionId) {
  return get(`/api/ai/chat/sessions/${sessionId}/messages`);
}

/**
 * 发送对话消息（非流式，返回完整回复）
 * 流式回复在 Phase 3 通过 fetch + ReadableStream 实现（H5）
 */
export function sendChatMessage(sessionId, content, images) {
  return post(`/api/ai/chat/sessions/${sessionId}/messages`, {
    content,
    images,
  });
}

/** 直接对话（无会话，一次性） */
export function chat(content, provider) {
  return post("/api/ai/chat", { content, provider });
}

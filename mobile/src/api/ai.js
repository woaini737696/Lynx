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
 * 发送对话消息（非流式）
 * 后端契约：POST /api/ai/chat { messages, provider?, stream? }
 * 返回 { content, provider, model, usage }
 */
export function chat(content, provider, history = []) {
  const messages = [...history, { role: "user", content }];
  return post("/api/ai/chat", { messages, provider, stream: false });
}

/**
 * 流式对话（H5 支持，通过 fetch + ReadableStream）
 * @param {string} content - 用户消息
 * @param {string} provider - deepseek | mimo
 * @param {Array} history - 历史消息 [{role, content}]
 * @param {Function} onChunk - 收到文本片段回调 (text) => void
 * @returns {Promise<string>} 完整回复
 */
export async function chatStream(content, provider, history, onChunk) {
  const { getBaseUrl, getToken } = await import("./request.js");
  const messages = [...history, { role: "user", content }];
  const res = await fetch(`${getBaseUrl()}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ messages, provider, stream: true }),
  });

  if (!res.ok) {
    throw new Error(`请求失败 (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "delta" && evt.text) {
            full += evt.text;
            onChunk && onChunk(evt.text);
          } else if (evt.type === "done") {
            return full;
          } else if (evt.type === "error") {
            throw new Error(evt.message || "流式响应异常");
          }
        } catch (e) {
          // 忽略解析错误的行
        }
      }
    }
  }
  return full;
}

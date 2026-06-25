import { get, post } from "./request.js";

/** 获取对话会话列表 */
export function getChatSessions() {
  return get("/api/ai/chat/sessions");
}

/** 创建对话会话 */
export function createChatSession(data = {}) {
  return post("/api/ai/chat/sessions", data);
}

/** 获取会话消息列表（GET /api/ai/chat/sessions/[id] 返回会话+消息） */
export function getChatMessages(sessionId) {
  return get(`/api/ai/chat/sessions/${sessionId}`);
}

/** 可用 AI 模型列表 */
export const AI_PROVIDERS = [
  { key: "deepseek", label: "DeepSeek", desc: "深度求索 · 推理强", icon: "🧠" },
  { key: "mimo", label: "MiMo", desc: "小米 · 响应快", icon: "⚡" },
];

/**
 * 发送对话消息（非流式，启用 AI 助理模式 = 工具调用）
 * 同步 Web 端契约：POST /api/ai/chat { messages, provider, stream:false, assistantMode:true }
 * 返回 { content, provider, model, usage, toolCalled }
 */
export function chat(content, provider, history = []) {
  const messages = [...history, { role: "user", content }];
  return post("/api/ai/chat", {
    messages,
    provider,
    stream: false,
    assistantMode: true,
  });
}

/**
 * 流式对话（H5 支持，通过 fetch + ReadableStream）
 * 注意：流式模式不支持工具调用（后端 assistantMode 与 stream 互斥）
 * 仅作为非流式失败时的降级方案
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
          // 后端 delta 事件字段为 content（不是 text）
          if (evt.type === "delta" && evt.content) {
            full += evt.content;
            onChunk && onChunk(evt.content);
          } else if (evt.type === "done") {
            return full;
          } else if (evt.type === "error") {
            throw new Error(evt.message || "流式响应异常");
          }
          // meta 事件忽略
        } catch (e) {
          // 忽略解析错误的行
        }
      }
    }
  }
  return full;
}

/**
 * 简要总结工具调用结果（用于工具卡片标题）
 * 同步 Web 端 summarizeToolResult 逻辑
 */
export function summarizeToolResult(result) {
  if (!result) return "";
  if (typeof result === "string") return result.slice(0, 60);
  if (result.error) return "执行失败";
  if (Array.isArray(result)) return `${result.length} 条结果`;
  if (result.ideas) return `${result.ideas.length} 条灵感`;
  if (result.tasks) return `${result.tasks.length} 条任务`;
  if (result.cognitions) return `${result.cognitions.length} 条认知`;
  if (result.skills) return `${result.skills.length} 个技能`;
  if (result.flows) return `${result.flows.length} 个工作流`;
  if (result.suggestions) return `${result.suggestions.length} 条建议`;
  if (result.success) return "执行成功";
  if (result.id) return "创建成功";
  const keys = Object.keys(result);
  if (keys.length <= 3) return keys.join(", ");
  return `${keys.length} 个字段`;
}

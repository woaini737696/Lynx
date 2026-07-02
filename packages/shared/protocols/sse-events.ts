// SSE 流式事件协议 - Lynx 超级助理聊天流
// 从 src/app/ai/assistant/hooks/useChat.ts 抽离
// 定义 AI 聊天流的所有事件类型，三端共享

// ============ 事件类型定义 ============

/** 元信息事件（流开始，包含模型/Provider 信息） */
export interface SSEMetaEvent {
  type: "meta";
  model: string;
  provider: string;
  /** Token 用量（如果可用） */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/** 思考过程事件（推理模型的 thinking 内容） */
export interface SSEThinkingEvent {
  type: "thinking";
  content: string;
}

/** 工具调用开始事件 */
export interface SSEToolStartEvent {
  type: "tool_start";
  tool: string;
  args: Record<string, unknown>;
}

/** 工具调用完成事件 */
export interface SSEToolDoneEvent {
  type: "tool_done";
  tool: string;
  result: unknown;
  /** 耗时（毫秒） */
  durationMs?: number;
}

/** 增量内容事件（主流式文本） */
export interface SSEDeltaEvent {
  type: "delta";
  content: string;
}

/** 流结束事件 */
export interface SSEDoneEvent {
  type: "done";
  /** 完整回复（如果服务端聚合了） */
  fullContent?: string;
  /** Token 用量 */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  /** 结束原因（stop/length/tool_calls） */
  finishReason?: string;
  /** AI 提供方（部分服务端会在 done 事件中回传） */
  provider?: string;
  /** 模型名（部分服务端会在 done 事件中回传） */
  model?: string;
}

/** 错误事件 */
export interface SSEErrorEvent {
  type: "error";
  message: string;
  /** 错误码（如 rate_limit / server_error / network） */
  code?: string;
}

/** 所有 SSE 事件类型 */
export type SSEEvent =
  | SSEMetaEvent
  | SSEThinkingEvent
  | SSEToolStartEvent
  | SSEToolDoneEvent
  | SSEDeltaEvent
  | SSEDoneEvent
  | SSEErrorEvent;

// ============ 解析器 ============

/**
 * 解析 SSE data 行为事件对象
 * @param line SSE 数据行（以 "data: " 开头）
 * @returns 解析后的事件对象，解析失败返回 null
 */
export function parseSSELine(line: string): SSEEvent | null {
  const data = line.startsWith("data: ") ? line.slice(6) : line;
  if (!data || data === "[DONE]") return null;
  try {
    return JSON.parse(data) as SSEEvent;
  } catch {
    return null;
  }
}

/**
 * 从 ReadableStream 逐行读取并解析 SSE 事件
 * 平台无关实现：接受 ReadableStream<Uint8Array>，用 TextDecoder 解码
 *
 * 用法：
 *   const reader = response.body.getReader();
 *   for await (const event of readSSEStream(reader)) {
 *     handleEvent(event);
 *   }
 */
export async function* readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<SSEEvent, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // 最后一行可能不完整，保留

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      const event = parseSSELine(trimmed);
      if (event) yield event;
    }
  }

  // 处理缓冲区剩余
  if (buffer.trim()) {
    const event = parseSSELine(buffer.trim());
    if (event) yield event;
  }
}

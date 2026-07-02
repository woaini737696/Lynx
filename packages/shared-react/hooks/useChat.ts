"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { readSSEStream } from "@lynnhub/shared";

// ============ 类型定义 ============

/** LLM Provider 标识 */
export type LLMProvider = string;

/** 推理模式：fast 最低延迟 / standard 平衡 / deep 最强能力 */
export type ReasoningMode = "fast" | "standard" | "deep";

/** 模型配置（Provider + 具体模型 + 推理模式） */
export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  reasoningMode: ReasoningMode;
}

/** Token 用量 */
export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

/** 工具调用信息（后端 assistantMode 返回） */
export interface ToolCalled {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

/** 聊天消息 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  provider?: LLMProvider;
  model?: string;
  error?: boolean;
  usage?: TokenUsage;
  streaming?: boolean;
  images?: string[];
  toolCalled?: ToolCalled | null;
  /** 标记本条回复由 Hermes Agent 生成（模式 C） */
  hermesMode?: boolean;
  /** 标记 Hermes 失败后回退到 LLM 模式生成 */
  hermesFallback?: boolean;
}

/** 多模态内容片段（OpenAI 兼容格式） */
export interface MultimodalContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

/** 模型目录（来自 /api/ai/models） */
export interface ModelCatalog {
  providers: Array<{
    id: LLMProvider;
    models: Array<{ id: string; multimodal?: boolean }>;
  }>;
}

// ============ SSE 事件扩展类型 ============
// 服务端实际下发的字段比 @lynnhub/shared 的 SSEEvent 基础类型更丰富，
// 这里定义扩展接口，在事件处理时按 type 分发后安全访问额外字段。

/** 扩展 meta 事件（服务端额外返回 hermesMode/hermesFallback） */
interface ChatMetaEvent {
  type: "meta";
  model: string;
  provider: string;
  usage?: TokenUsage;
  hermesMode?: boolean;
  hermesFallback?: boolean;
}

/** 扩展 tool_done 事件（服务端额外返回 toolCalled） */
interface ChatToolDoneEvent {
  type: "tool_done";
  tool: string;
  result: unknown;
  durationMs?: number;
  toolCalled?: ToolCalled | null;
}

/** 扩展 done 事件（服务端额外返回 provider/model/toolCalled/hermesMode/hermesFallback） */
interface ChatDoneEvent {
  type: "done";
  fullContent?: string;
  usage?: TokenUsage;
  finishReason?: string;
  provider?: LLMProvider;
  model?: string;
  toolCalled?: ToolCalled | null;
  hermesMode?: boolean;
  hermesFallback?: boolean;
}

// ============ 依赖注入接口 ============

/** HTTP POST 响应（流式兼容，与 fetch Response 接口对齐） */
export interface ChatHttpResponse {
  ok: boolean;
  status: number;
  /** 解析 JSON 响应体 */
  json: <T = unknown>() => Promise<T>;
  /** 响应流（SSE 流式响应时使用，非流式响应为 null） */
  body: ReadableStream<Uint8Array> | null;
}

/** HTTP 适配器（注入） */
export interface ChatHttpAdapter {
  /** POST 请求，返回流式兼容响应 */
  post(
    url: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<ChatHttpResponse>;
  /** GET 请求（可选，用于加载模型目录） */
  get?<T = unknown>(url: string): Promise<{ ok: boolean; data: T }>;
}

/** 通知函数（注入，替代 toast） */
export type ChatNotify = (
  message: string,
  type?: "info" | "error" | "success"
) => void;

/** API 端点配置（注入） */
export interface ChatEndpoints {
  /** 聊天接口（流式 SSE） */
  chat: string;
  /** 模型目录接口（GET） */
  models: string;
  /** 消息持久化接口（按 sessionId 构造完整 URL） */
  persistMessage: (sessionId: string) => string;
}

/** useChat 参数（全部通过依赖注入接收平台特定能力） */
export interface UseChatParams {
  /** HTTP 适配器（替代硬编码 fetch） */
  http: ChatHttpAdapter;
  /** 通知函数（替代硬编码 toast） */
  notify: ChatNotify;
  /** API 端点配置（替代硬编码 API 路径） */
  endpoints: ChatEndpoints;
  /** 当前会话 ID（用于消息持久化，为 null 则跳过持久化） */
  currentSessionId?: string | null;
  /** 消息持久化后的回调（如刷新会话列表） */
  onMessagePersisted?: () => void;
  /** AI 回复完成后的回调（如自动语音播放） */
  onAssistantReply?: (content: string, msgId: string) => void;
  /** 是否自动播放语音（为 true 时流结束后触发 onAssistantReply） */
  autoSpeak?: boolean;
}

// ============ Hook 返回值 ============

export interface UseChatReturn {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  thinking: boolean;
  setThinking: React.Dispatch<React.SetStateAction<boolean>>;
  modelConfig: ModelConfig;
  setModelConfig: React.Dispatch<React.SetStateAction<ModelConfig>>;
  modelCatalog: ModelCatalog | null;
  isMultimodal: boolean;
  attachedImages: string[];
  setAttachedImages: React.Dispatch<React.SetStateAction<string[]>>;
  /** 发送消息（流式输出） */
  send: (text?: string) => Promise<void>;
  /** 中止当前生成 */
  stopGeneration: () => void;
}

// ============ 默认值 ============

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: "deepseek",
  model: "deepseek-chat",
  reasoningMode: "standard",
};

// ============ Hook 实现 ============

/**
 * Lynx 超级助理聊天 hook（跨端共享版本）
 *
 * 从 src/app/ai/assistant/hooks/useChat.ts 抽离核心逻辑：
 * - 消息列表管理、loading 状态、abort 能力
 * - 完整的 SSE 事件处理：meta/thinking/tool_start/tool_done/delta/done/error
 * - 使用 @lynnhub/shared 的 readSSEStream 解析器
 *
 * 平台特定能力全部通过依赖注入接收：
 * - httpPost / httpGet → HTTP 适配器
 * - notify → 通知函数
 * - endpoints → API 路径配置
 *
 * 不依赖任何 DOM API（scrollRef/fileInputRef/inputRef 由各端自行管理）。
 */
export function useChat(params: UseChatParams): UseChatReturn {
  const {
    http,
    notify,
    endpoints,
    currentSessionId,
    onMessagePersisted,
    onAssistantReply,
    autoSpeak = false,
  } = params;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog | null>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const isMultimodal = (() => {
    if (!modelCatalog) return false;
    const provider = modelCatalog.providers.find((p) => p.id === modelConfig.provider);
    if (!provider) return false;
    const model = provider.models.find((m) => m.id === modelConfig.model);
    return Boolean(model?.multimodal);
  })();

  // 加载模型目录（若注入了 http.get）
  useEffect(() => {
    if (!http.get) return;
    http
      .get<ModelCatalog>(endpoints.models)
      .then(({ ok, data }) => {
        if (ok && data) setModelCatalog(data);
      })
      .catch(() => {});
  }, [http, endpoints.models]);

  // 组件卸载时中止进行中的请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(
    async (text?: string) => {
      const content = (text || input).trim();
      if ((!content && attachedImages.length === 0) || thinking) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content,
        time: "刚刚",
        images: attachedImages.length > 0 ? attachedImages : undefined,
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput("");
      setAttachedImages([]);
      setThinking(true);

      // 持久化用户消息
      if (currentSessionId) {
        http
          .post(endpoints.persistMessage(currentSessionId), {
            role: "user",
            content,
            images: attachedImages.length > 0 ? attachedImages : undefined,
          })
          .catch(() => {});
      }

      const aiMsgId = `a-${Date.now()}`;
      const aiPlaceholder: ChatMessage = {
        id: aiMsgId,
        role: "assistant",
        content: "",
        time: "刚刚",
        streaming: true,
      };
      setMessages((prev) => [...prev, aiPlaceholder]);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // 构建 API 消息（保留历史对话上下文，过滤错误消息）
        const apiMessages = nextMessages
          .filter((m) => !m.error)
          .map((m) => {
            if (m.images && m.images.length > 0) {
              const parts: MultimodalContent[] = [];
              if (m.content) parts.push({ type: "text", text: m.content });
              for (const img of m.images) {
                parts.push({ type: "image_url", image_url: { url: img } });
              }
              return { role: m.role, content: parts };
            }
            return { role: m.role, content: m.content };
          });

        // 调用 AI 助理模式（流式输出，支持 Function Calling + 工具执行进度推送）
        const res = await http.post(
          endpoints.chat,
          {
            messages: apiMessages,
            provider: modelConfig.provider,
            model: modelConfig.model,
            reasoningMode: modelConfig.reasoningMode,
            stream: true,
            assistantMode: true,
          },
          controller.signal
        );

        if (!res.ok || !res.body) {
          const data = await res.json<{ error?: string }>().catch(() => null);
          const errMsg = data?.error || `请求失败（${res.status}）`;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: errMsg, error: true, streaming: false } : m
            )
          );
          notify(errMsg, "error");
          return;
        }

        // SSE 流式解析：使用 @lynnhub/shared 的 readSSEStream
        const reader = res.body.getReader();
        let aiContent = "";
        let aiProvider: LLMProvider | undefined;
        let aiModel: string | undefined;
        let aiUsage: TokenUsage | undefined;
        let toolCalled: ToolCalled | null = null;
        let hermesMode: boolean | undefined;
        let hermesFallback: boolean | undefined;
        // 用于在 thinking 期间显示"正在思考..."，收到首个 delta 后清除
        let firstDeltaReceived = false;
        // delta 渲染节流：用 setTimeout(0) 合并多个 delta，避免每个 token 触发 setState
        // （原 Web 版用 requestAnimationFrame，此处用 setTimeout 以避免 DOM API 依赖）
        let flushScheduled = false;
        let flushTimer: ReturnType<typeof setTimeout> | null = null;
        let streamEnded = false;

        const flushDelta = () => {
          flushScheduled = false;
          flushTimer = null;
          if (streamEnded) return; // 流已结束，最终化消息已设置，跳过这次 flush 避免覆盖
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: aiContent } : m))
          );
        };
        const scheduleDeltaFlush = () => {
          if (flushScheduled || streamEnded) return;
          flushScheduled = true;
          flushTimer = setTimeout(flushDelta, 0);
        };
        const cancelPendingFlush = () => {
          if (flushTimer !== null) {
            clearTimeout(flushTimer);
            flushTimer = null;
          }
          flushScheduled = false;
        };

        // 使用 readSSEStream 异步迭代器逐事件处理
        for await (const event of readSSEStream(reader)) {
          switch (event.type) {
            case "meta": {
              const meta = event as ChatMetaEvent;
              aiProvider = meta.provider;
              aiModel = meta.model;
              if (meta.hermesMode) hermesMode = true;
              if (meta.hermesFallback) hermesFallback = true;
              break;
            }
            case "thinking": {
              // 第一轮 LLM 流式 thinking 事件：显示"正在思考..."
              if (!firstDeltaReceived) {
                const thinkingEvent = event as { type: "thinking"; content: string };
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, content: thinkingEvent.content || "正在思考...", streaming: true }
                      : m
                  )
                );
              }
              break;
            }
            case "tool_start": {
              // 工具开始执行
              const toolName = (event as { type: "tool_start"; tool: string }).tool || "工具";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: `🔧 正在执行工具：${toolName}...`, streaming: true }
                    : m
                )
              );
              break;
            }
            case "tool_done": {
              // 工具执行完成，准备接收第二轮 LLM 输出
              const toolDone = event as ChatToolDoneEvent;
              toolCalled = toolDone.toolCalled || null;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: "✓ 工具执行完成，正在生成回复...", streaming: true }
                    : m
                )
              );
              break;
            }
            case "delta": {
              const delta = event as { type: "delta"; content: string };
              if (typeof delta.content !== "string") break;
              if (!firstDeltaReceived) {
                firstDeltaReceived = true;
                aiContent = delta.content;
              } else {
                aiContent += delta.content;
              }
              // 节流：合并多个 delta 到下一帧渲染
              scheduleDeltaFlush();
              break;
            }
            case "done": {
              const done = event as ChatDoneEvent;
              if (done.usage) aiUsage = done.usage;
              if (done.provider) aiProvider = done.provider;
              if (done.model) aiModel = done.model;
              if (done.toolCalled) toolCalled = done.toolCalled;
              if (done.hermesMode) hermesMode = true;
              if (done.hermesFallback) hermesFallback = true;
              break;
            }
            case "error": {
              const errorEvent = event as { type: "error"; message: string };
              const errMsg = errorEvent.message || "流式响应异常";
              // 取消未触发的 delta flush，避免覆盖错误状态
              streamEnded = true;
              cancelPendingFlush();
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, content: errMsg, error: true, streaming: false } : m
                )
              );
              notify(errMsg, "error");
              return;
            }
          }
        }

        // 流结束：标记流结束 + 取消未触发的 delta flush
        streamEnded = true;
        cancelPendingFlush();

        // 流结束：最终化消息
        const finalContent = aiContent || "(空回复)";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: finalContent,
                  streaming: false,
                  provider: aiProvider,
                  model: aiModel,
                  usage: aiUsage,
                  toolCalled,
                  hermesMode,
                  hermesFallback,
                }
              : m
          )
        );

        // 持久化 AI 回复
        if (currentSessionId && finalContent) {
          http
            .post(endpoints.persistMessage(currentSessionId), {
              role: "assistant",
              content: finalContent,
              provider: aiProvider,
              model: aiModel,
              tokens: aiUsage?.total_tokens,
            })
            .then((r) => r.json<{ message?: { id: string } }>())
            .then((data) => {
              // 用 DB 真实 id 替换本地临时 id
              if (data.message?.id) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === aiMsgId ? { ...m, id: data.message!.id } : m))
                );
              }
            })
            .catch(() => {});
          // 刷新会话列表（标题可能已自动更新）
          onMessagePersisted?.();
        }

        // 自动语音播放（通过回调触发，不在此 hook 内直接调用 TTS）
        if (autoSpeak && finalContent) {
          setTimeout(() => onAssistantReply?.(finalContent, aiMsgId), 300);
        }
      } catch (e) {
        const err = e as Error;
        if (err.name === "AbortError") {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, streaming: false } : m))
          );
        } else {
          const msg = "网络错误：" + err.message;
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: msg, error: true, streaming: false } : m))
          );
          notify(msg, "error");
        }
      } finally {
        setThinking(false);
        abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      input,
      attachedImages,
      thinking,
      messages,
      currentSessionId,
      http,
      notify,
      endpoints,
      onMessagePersisted,
      onAssistantReply,
      autoSpeak,
      modelConfig,
    ]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    messages,
    setMessages,
    input,
    setInput,
    thinking,
    setThinking,
    modelConfig,
    setModelConfig,
    modelCatalog,
    isMultimodal,
    attachedImages,
    setAttachedImages,
    send,
    stopGeneration,
  };
}

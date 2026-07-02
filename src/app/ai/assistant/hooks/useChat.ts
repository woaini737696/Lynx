"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "@/components/ui/toast";
import type { ModelSwitcherValue } from "@/components/ui/ModelSwitcher";
import type { LLMProvider } from "@/lib/ai-provider";
import type { Message, TokenUsage, ToolCalled, AISettings } from "../types";

interface UseChatParams {
  settings: AISettings;
  speak: (text: string, msgId?: string) => Promise<void>;
  stopSpeaking: () => void;
  voiceCallActive: boolean;
  currentSessionId: string | null;
  fetchSessions: () => Promise<any>;
  loadSession: (sessionId: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  fetchSettings: () => Promise<void>;
}

/** 对话核心：消息状态、流式发送、模型配置 */
export function useChat(params: UseChatParams) {
  const { settings, speak, stopSpeaking, voiceCallActive, currentSessionId, fetchSessions, loadSession, createNewSession, fetchSettings } = params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelSwitcherValue>({
    provider: "deepseek",
    model: "deepseek-chat",
    reasoningMode: "standard",
  });
  const [modelCatalog, setModelCatalog] = useState<{
    providers: Array<{ id: LLMProvider; models: Array<{ id: string; multimodal?: boolean }> }>;
  } | null>(null);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMultimodal = (() => {
    if (!modelCatalog) return false;
    const provider = modelCatalog.providers.find((p) => p.id === modelConfig.provider);
    if (!provider) return false;
    const model = provider.models.find((m) => m.id === modelConfig.model);
    return Boolean(model?.multimodal);
  })();

  useEffect(() => {
    fetch("/api/ai/models")
      .then((r) => r.json())
      .then((data: { catalog?: typeof modelCatalog }) => {
        if (data.catalog) setModelCatalog(data.catalog);
      })
      .catch(() => {});
    fetchSettings();
  }, [fetchSettings]);

  // 初始化：加载会话列表，若有会话则加载最近一个，否则创建新会话
  useEffect(() => {
    (async () => {
      const sessionList = await fetchSessions();
      if (sessionList.length > 0) {
        await loadSession(sessionList[0].id);
      } else {
        await createNewSession();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // 组件卸载时中止进行中的请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = async (text?: string) => {
    const content = (text || input).trim();
    if ((!content && attachedImages.length === 0) || thinking) return;

    stopSpeaking();

    const userMsg: Message = {
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

    // 持久化用户消息到数据库
    if (currentSessionId) {
      fetch(`/api/ai/chat/sessions/${currentSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "user",
          content,
          images: attachedImages.length > 0 ? attachedImages : undefined,
        }),
      }).catch(() => {});
    }

    const aiMsgId = `a-${Date.now()}`;
    const aiPlaceholder: Message = {
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
      // 构建 API 消息（保留历史对话上下文，过滤错误消息和工具卡片消息）
      const apiMessages = nextMessages
        .filter((m) => !m.error)
        .map((m) => {
          if (m.images && m.images.length > 0) {
            const parts: Array<
              { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
            > = [];
            if (m.content) parts.push({ type: "text", text: m.content });
            for (const img of m.images) {
              parts.push({ type: "image_url", image_url: { url: img } });
            }
            return { role: m.role, content: parts };
          }
          return { role: m.role, content: m.content };
        });

      // 调用 AI 助理模式（流式输出，支持 Function Calling + 工具执行进度推送）
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          provider: modelConfig.provider,
          model: modelConfig.model,
          reasoningMode: modelConfig.reasoningMode,
          stream: true,
          assistantMode: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        const errMsg = data?.error || `请求失败（${res.status}）`;
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: errMsg, error: true, streaming: false } : m));
        toast(errMsg, "error");
        return;
      }

      // SSE 流式解析：实时渲染 delta，支持 thinking/tool_start/tool_done 事件
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = "";
      let sseBuffer = "";
      let aiProvider: LLMProvider | undefined;
      let aiModel: string | undefined;
      let aiUsage: TokenUsage | undefined;
      let toolCalled: ToolCalled | null = null;
      let hermesMode: boolean | undefined;
      let hermesFallback: boolean | undefined;
      // 用于在 thinking 期间显示"正在思考..."，收到首个 delta 后清除
      let firstDeltaReceived = false;
      // delta 渲染节流：用 rAF 合并多个 delta 到下一帧，避免每个 token 触发 setState 重渲染
      let rafScheduled = false;
      let rafId: number | null = null;
      let streamEnded = false;
      const flushDelta = () => {
        rafScheduled = false;
        rafId = null;
        if (streamEnded) return; // 流已结束，最终化消息已设置，跳过这次 flush 避免覆盖
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: aiContent } : m))
        );
      };
      const scheduleDeltaFlush = () => {
        if (rafScheduled || streamEnded) return;
        rafScheduled = true;
        if (typeof requestAnimationFrame === "function") {
          rafId = requestAnimationFrame(flushDelta);
        } else {
          // SSR 或非浏览器环境降级为 setTimeout(0)
          rafId = null;
          setTimeout(flushDelta, 0);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            if (obj.type === "meta") {
              aiProvider = obj.provider;
              aiModel = obj.model;
              if (obj.hermesMode) hermesMode = true;
              if (obj.hermesFallback) hermesFallback = true;
            } else if (obj.type === "thinking") {
              // 第一轮 LLM 流式 thinking 事件：显示"正在思考..."
              if (!firstDeltaReceived) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, content: obj.content || "正在思考...", streaming: true }
                      : m
                  )
                );
              }
            } else if (obj.type === "tool_start") {
              // 工具开始执行
              const toolName = obj.tool || "工具";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: `🔧 正在执行工具：${toolName}...`, streaming: true }
                    : m
                )
              );
            } else if (obj.type === "tool_done") {
              // 工具执行完成，准备接收第二轮 LLM 输出
              toolCalled = obj.toolCalled || null;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: "✓ 工具执行完成，正在生成回复...", streaming: true }
                    : m
                )
              );
            } else if (obj.type === "delta" && typeof obj.content === "string") {
              if (!firstDeltaReceived) {
                firstDeltaReceived = true;
                aiContent = obj.content;
              } else {
                aiContent += obj.content;
              }
              // 节流：合并多个 delta 到下一帧渲染（避免每个 token 触发 setState）
              scheduleDeltaFlush();
            } else if (obj.type === "done") {
              if (obj.usage) aiUsage = obj.usage;
              if (obj.provider) aiProvider = obj.provider;
              if (obj.model) aiModel = obj.model;
              if (obj.toolCalled) toolCalled = obj.toolCalled;
              if (obj.hermesMode) hermesMode = true;
              if (obj.hermesFallback) hermesFallback = true;
            } else if (obj.type === "error") {
              const errMsg = obj.message || "流式响应异常";
              // 取消未触发的 delta flush，避免覆盖错误状态
              streamEnded = true;
              if (rafId !== null && typeof cancelAnimationFrame === "function") {
                cancelAnimationFrame(rafId);
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, content: errMsg, error: true, streaming: false } : m
                )
              );
              toast(errMsg, "error");
              return;
            }
          } catch {
            /* ignore SSE parse error */
          }
        }
      }

      // 流结束：标记流结束 + 取消未触发的 delta flush，避免覆盖最终化状态
      streamEnded = true;
      if (rafId !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafId);
      }
      rafScheduled = false;
      rafId = null;

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

      // 持久化 AI 回复到数据库
      if (currentSessionId && finalContent) {
        fetch(`/api/ai/chat/sessions/${currentSessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            content: finalContent,
            provider: aiProvider,
            model: aiModel,
            tokens: aiUsage?.total_tokens,
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            // 用 DB 真实 id 替换本地临时 id，使消息标注按钮可用
            if (data.message?.id) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, id: data.message.id } : m
                )
              );
            }
          })
          .catch(() => {});
        // 刷新会话列表（标题可能已自动更新）
        fetchSessions();
      }

      // 自动语音播放条件：
      // - autoSpeak 开启时总是播放（全双工通话中走 sendVoice 的 StreamTTS，不重复播报）
      const shouldAutoSpeak = settings.autoSpeak && !voiceCallActive;
      if (shouldAutoSpeak && finalContent) {
        setTimeout(() => speak(finalContent, aiMsgId), 300);
      }
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, streaming: false } : m));
      } else {
        const msg = "网络错误：" + err.message;
        setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, content: msg, error: true, streaming: false } : m));
        toast(msg, "error");
      }
    } finally {
      setThinking(false);
      abortRef.current = null;
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

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
    scrollRef,
    abortRef,
    fileInputRef,
    inputRef,
    send,
    stopGeneration,
  };
}

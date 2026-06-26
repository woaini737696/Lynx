"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2 } from "lucide-react";
import { LarkTaskCard, type LarkTaskCardData } from "@/components/ai/LarkTaskCard";

/**
 * 工具调用字段：当 type === "larkTaskCard" 时渲染飞书任务卡片。
 */
export interface ToolCall {
  type: string;
  data: unknown;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** 预留：后续用于渲染工具调用卡片（如飞书任务） */
  toolCall?: ToolCall;
}

const WELCOME_TEXT = "你好，我是 Lynn AI 助理，有什么可以帮你？";

/**
 * 极简 AI 助理聊天组件
 * - user 气泡靠右橙色，assistant 气泡靠左灰色
 * - 流式响应（cursor ▋ 表示输入中）
 * - 调用 /api/ai/chat 流式接口（SSE）
 * - 多轮上下文
 * - Enter 发送，Shift+Enter 换行
 * - 自动滚动到底部
 */
export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 新消息时自动滚动到底部
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 卸载时中断未完成的流
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    // 上下文：只取 role/content 发给后端
    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "" }]);
    setInput("");
    setSending(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 事件分隔（空行）
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data) continue;
            // JSON 解析错误忽略该行
            let evt: { type: string; content?: string; message?: string };
            try {
              evt = JSON.parse(data);
            } catch {
              continue;
            }
            if (evt.type === "delta" && typeof evt.content === "string") {
              acc += evt.content;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = { ...last, content: acc };
                }
                return next;
              });
            } else if (evt.type === "error") {
              throw new Error(evt.message || "流式响应异常");
            }
            // meta / done 忽略
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError("发送失败，请重试");
      // 移除空的 assistant 占位消息
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && last.content === "") {
          next.pop();
        }
        return next;
      });
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [input, sending, messages]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 消息列表 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm text-foreground">
              {WELCOME_TEXT}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const isStreaming =
                !isUser && sending && i === messages.length - 1;
              const larkCard =
                !isUser && m.toolCall?.type === "larkTaskCard"
                  ? (m.toolCall.data as LarkTaskCardData | undefined)
                  : undefined;
              return (
                <li
                  key={i}
                  className={`flex ${
                    larkCard
                      ? "flex-col items-start"
                      : isUser
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words px-4 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? "rounded-2xl rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-2xl rounded-tl-sm bg-muted text-foreground"
                    }`}
                  >
                    {m.content}
                    {isStreaming && (
                      <span className="ml-0.5 inline-block animate-pulse text-foreground">
                        ▋
                      </span>
                    )}
                  </div>
                  {larkCard && (
                    <LarkTaskCard {...larkCard} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="px-4 pb-1 text-xs text-red-500">{error}</div>
      )}

      {/* 输入区 */}
      <div className="border-t border-border bg-background px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
            rows={1}
            placeholder={sending ? "AI 思考中..." : "输入消息，Enter 发送，Shift+Enter 换行"}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            aria-label="发送"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

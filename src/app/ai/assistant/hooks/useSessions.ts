"use client";

import { useState, useCallback, useMemo } from "react";
import { useClientPagination } from "@/components/ui/ListControls";
import type { ModelSwitcherValue } from "@/components/ui/ModelSwitcher";
import type { Message } from "../types";

interface SessionItem {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  pinned: boolean;
}

/** 对话会话持久化管理 */
export function useSessions(
  assistantName: string,
  modelConfig: ModelSwitcherValue,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  const [sessionQuery, setSessionQuery] = useState("");
  const filteredSessions = useMemo(() => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, sessionQuery]);
  const sessionPagination = useClientPagination(filteredSessions, 10);

  // 加载对话会话列表
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/chat/sessions?limit=30");
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
        return data.sessions as SessionItem[];
      }
    } catch {}
    return [];
  }, []);

  // 加载指定会话的消息
  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/ai/chat/sessions/${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) {
        setCurrentSessionId(sessionId);
        const loadedMessages: Message[] = data.session.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          time: new Date(m.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          provider: m.provider,
          model: m.model,
          images: m.images || undefined,
          // P0 修复：保留 tokens 字段并转换为 usage 对象结构，否则刷新页面后 token 消耗数消失
          usage: typeof m.tokens === "number" && m.tokens > 0
            ? { total_tokens: m.tokens }
            : undefined,
          // 加载已持久化的标注状态（feedback API 写入）
          feedback: m.feedback === "good" || m.feedback === "bad" ? m.feedback : null,
          feedbackReason: typeof m.feedbackReason === "string" ? m.feedbackReason : null,
        }));
        // 若会话为空，添加欢迎消息
        if (loadedMessages.length === 0) {
          loadedMessages.push({
            id: "welcome",
            role: "assistant",
            content: `你好！我是你的奇思超级助理${assistantName !== "Lynn" ? ` ${assistantName}` : ""}。我可以帮你管理灵感、分析任务、整理认知，也可以直接对话讨论问题。有什么我能帮你的？`,
            time: "刚刚",
          });
        }
        setMessages(loadedMessages);
      }
    } catch {}
  }, [assistantName, setMessages]);

  // 创建新对话
  const createNewSession = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "新对话",
          provider: modelConfig.provider,
          model: modelConfig.model,
        }),
      });
      const data = await res.json();
      if (data.session) {
        setCurrentSessionId(data.session.id);
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: `你好！我是你的奇思超级助理${assistantName !== "Lynn" ? ` ${assistantName}` : ""}。我可以帮你管理灵感、分析任务、整理认知，也可以直接对话讨论问题。有什么我能帮你的？`,
          time: "刚刚",
        }]);
        fetchSessions();
      }
    } catch {}
  }, [modelConfig.provider, modelConfig.model, assistantName, fetchSessions, setMessages]);

  return {
    currentSessionId,
    setCurrentSessionId,
    sessions,
    setSessions,
    showSessionList,
    setShowSessionList,
    sessionQuery,
    setSessionQuery,
    filteredSessions,
    sessionPagination,
    fetchSessions,
    loadSession,
    createNewSession,
  };
}

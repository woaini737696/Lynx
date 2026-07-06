import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import {
  Send,
  User,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Plus,
  Trash2,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  Brain,
  BookOpen,
  Zap,
  Settings,
  Save,
  Upload,
  Wrench,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import { cloudApi, getCloudEndpoint, resolveAvatarUrl } from "@/lib/cloud-api";
import { invoke, listen } from "@/lib/tauri";
import type { AgentStatus } from "@/types/api";
import { useAuthStore } from "@/stores/authStore";

import {
  type Message,
  type ChatSession,
  type ChatStreamCallbacks,
  QUICK_COMMANDS,
  listSessions,
  createSession,
  getSession,
  deleteSession,
  appendMessage,
  feedbackMessage,
  chatCompletion,
  renderMarkdown,
  summarizeToolResult,
} from "@/lib/ai-assistant";

// ============ AI 助理设置类型 ============
interface AISettings {
  assistantName?: string;
  assistantAvatar?: string;
  avatarUrl?: string | null;
  personaStyle?: string | null;
  distilledStyle?: string | null;
  styleStrength?: number;
  defaultVoice?: string | null;
  autoSpeak?: boolean;
  voiceMode?: boolean;
  feishuNotify?: boolean;
  hermesTakeover?: boolean;
  hermesAutoReport?: boolean;
  hermesReportCron?: string | null;
  larkWebhookUrl?: string | null;
}

function buildWelcomeMessage(name: string): Message {
  return {
    id: "welcome",
    role: "assistant",
    content: `你好，我是 ${name} · 你的奇思超级助理。\n\n我可以帮你查询任务、分析灵感、搜索记忆、执行技能，甚至通过奇思 Agent 操控本地电脑。\n\n试试下方的快捷指令，或直接告诉我你想做什么。`,
    time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
  };
}

const SUGGESTIONS = [
  { icon: Target, text: "今天有哪些任务需要聚焦？", color: "text-northstar" },
  { icon: Brain, text: "帮我分析最近的灵感趋势", color: "text-cognition" },
  { icon: BookOpen, text: "从认知库中找一条方法论", color: "text-cognition" },
  { icon: Zap, text: "快速捕获一条灵感", color: "text-northstar" },
];

interface AIAssistantPageProps {
  inDrawer?: boolean;
}

export function AIAssistantPage({ inDrawer = false }: AIAssistantPageProps) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([buildWelcomeMessage("奇思")]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<Message | null>(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  // WS 连接状态：用于 hermesExecute 工具调用前置检查（避免静默失败）
  const [wsConnected, setWsConnected] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialPromptHandled = useRef(false);

  // 加载会话列表
  const { data: sessions = [] } = useQuery<ChatSession[]>({
    queryKey: ["ai-sessions"],
    queryFn: listSessions,
  });

  // 加载 AI 助理设置（对齐 Web 端 /api/ai/settings）
  const { data: aiSettings, refetch: refetchSettings } = useQuery<AISettings>({
    queryKey: ["ai-settings"],
    queryFn: async () => {
      try {
        const resp = await cloudApi.get<{ settings: AISettings }>("/api/ai/settings");
        return resp.settings || {};
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "加载 AI 设置失败");
        return {};
      }
    },
  });

  // 查询 Agent WS 连接状态（用于 hermesExecute 工具调用前置检查）
  // 任务3: 事件驱动为主 + 轮询作为备份（间隔 30 秒）
  useEffect(() => {
    let cancelled = false;
    const fetchWsStatus = async () => {
      try {
        const s = await invoke<AgentStatus>("get_agent_status");
        if (!cancelled) setWsConnected(!!s?.wsConnected);
      } catch {
        // 非 Tauri 环境或命令不可用：忽略，默认 false
      }
    };
    fetchWsStatus();
    // 轮询备份：间隔改为 30 秒（主通道由 ws-status-changed 事件驱动）
    const timer = setInterval(fetchWsStatus, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // 任务3: 监听 IPC 事件 ws-status-changed，事件驱动更新 WS 连接状态
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<{ connected: boolean }>("ws-status-changed", (payload) => {
      setWsConnected(!!payload?.connected);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // 助理显示名称（默认 "Lynn"，可被设置覆盖）
  const assistantName = aiSettings?.assistantName?.trim() || "Lynn";
  // 助理 emoji 头像（无 avatarUrl 时使用，对齐 Web 端 assistantAvatar 字段）
  const assistantEmoji = aiSettings?.assistantAvatar?.trim() || "🦊";
  // 是否配置了头像 URL（无 URL 时回退到 emoji 显示）
  const hasAvatarUrl = !!aiSettings?.avatarUrl;
  // 助理头像 URL（拼接云端 endpoint，避免 WebView2 相对路径 404）
  const assistantAvatarUrl = resolveAvatarUrl(aiSettings?.avatarUrl);

  // 当助理名称变化时，更新欢迎消息（仅当当前是欢迎消息时）
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [buildWelcomeMessage(assistantName)];
      }
      return prev;
    });
  }, [assistantName]);

  // 自动滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // 发送消息（流式 SSE，支持 thinking/tool_start/tool_done/delta 事件实时更新 UI）
  const handleSend = useCallback(async (overrideContent?: string) => {
    const content = (overrideContent ?? input).trim();
    if (!content || loading) return;

    // 中止之前的请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // 添加 AI 占位消息（流式）
    const aiMsgId = (Date.now() + 1).toString();
    const aiPlaceholder: Message = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      streaming: true,
    };
    setMessages((prev) => [...prev, aiPlaceholder]);

    try {
      // 如果没有会话，自动创建一个
      let sessionId = currentSessionId;
      if (!sessionId) {
        const session = await createSession(content.slice(0, 30));
        sessionId = session.id;
        setCurrentSessionId(sessionId);
        queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      }

      // 持久化用户消息
      appendMessage(sessionId, { role: "user", content }).catch((e) => {
        toast.error(e instanceof Error ? e.message : "消息持久化失败");
      });

      // 构建历史消息（含当前用户消息）
      const history = [...messages, userMsg]
        .filter((m) => !m.error && m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      // 流式回调：实时更新 UI
      const callbacks: ChatStreamCallbacks = {
        onThinking: (thinkContent) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: thinkContent || "正在思考...", streaming: true }
                : m
            )
          );
        },
        onToolStart: async (tool, args) => {
          // P0 修复：移除 hermesExecute 前置 WS 检查（原逻辑会因缓存 wsConnected 过期而误拦截）
          // 改为信任服务端：服务端 hermesExecute 工具会通过 WS 下发指令，若 WS 未连接服务端会返回错误
          // 错误经 onToolDone / onError 自然呈现给用户，避免前端硬性拦截导致"完全不可用"
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    content: `🔧 正在执行工具：${tool}...`,
                    streaming: true,
                    toolProgress: { tool, status: "running", args },
                  }
                : m
            )
          );
        },
        onToolDone: (tool, result) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    content: "✓ 工具执行完成，正在生成回复...",
                    streaming: true,
                    toolProgress: { tool, status: "done", result },
                  }
                : m
            )
          );
        },
        onDelta: (_chunk, fullContent) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: fullContent, toolProgress: null }
                : m
            )
          );
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    content: `请求失败：${err.message}`,
                    streaming: false,
                    error: true,
                    toolProgress: null,
                  }
                : m
            )
          );
        },
      };

      // 调用 AI（流式 SSE）
      const res = await chatCompletion(
        { messages: history, sessionId, signal: controller.signal },
        callbacks
      );

      // 最终化 AI 消息
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: res.content || "(空回复)",
                streaming: false,
                provider: res.provider,
                model: res.model,
                usage: res.usage,
                toolCalled: res.toolCalled || null,
                hermesMode: res.hermesMode,
                hermesFallback: res.hermesFallback,
                toolProgress: null,
              }
            : m
        )
      );
    } catch (err: unknown) {
      // AbortError 是用户主动中止，不显示错误
      if (err instanceof Error && err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, streaming: false, content: m.content || "（已中止）", toolProgress: null }
              : m
          )
        );
        return;
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: `请求失败：${errorMsg}`,
                streaming: false,
                error: true,
                toolProgress: null,
              }
            : m
        )
      );
      toast.error("AI 回复失败");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, currentSessionId, queryClient, wsConnected]);

  // 从其他页面（如 AI 工作空间）跳转过来时，自动发送预填指令
  useEffect(() => {
    if (initialPromptHandled.current) return;
    const state = location.state as { initialPrompt?: string } | null;
    if (state?.initialPrompt) {
      initialPromptHandled.current = true;
      // 清除 location.state 避免刷新重复发送
      window.history.replaceState({}, "");
      handleSend(state.initialPrompt);
    }
  }, [location.state, handleSend]);

  // 新建对话
  const handleNewChat = useCallback(() => {
    abortRef.current?.abort();
    setCurrentSessionId(null);
    setMessages([buildWelcomeMessage(assistantName)]);
    setInput("");
    setLoading(false);
    inputRef.current?.focus();
  }, [assistantName]);

  // 清空当前对话
  const handleClear = useCallback(() => {
    if (currentSessionId) {
      deleteSession(currentSessionId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
          toast.success("已清空对话");
        })
        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "删除失败"));
    }
    handleNewChat();
    setConfirmClear(false);
  }, [currentSessionId, handleNewChat, queryClient]);

  // 加载历史会话
  const handleLoadSession = useCallback(async (sessionId: string) => {
    abortRef.current?.abort();
    setLoading(true);
    try {
      const { session, messages: sessionMessages } = await getSession(sessionId);
      const mapped: Message[] = sessionMessages.map((m) => ({
        ...m,
        time:
          m.time ||
          new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      }));
      setMessages(
        mapped.length > 0
          ? mapped
          : [{ ...buildWelcomeMessage(assistantName), id: "welcome-" + sessionId }]
      );
      setCurrentSessionId(session.id);
      setShowSessionList(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "加载会话失败");
    } finally {
      setLoading(false);
    }
  }, [assistantName]);

  // 删除历史会话
  const handleDeleteSession = useCallback(
    async (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteSession(sessionId);
        queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
        toast.success("已删除会话");
        if (sessionId === currentSessionId) handleNewChat();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "删除失败");
      }
    },
    [currentSessionId, handleNewChat, queryClient]
  );

  // 消息反馈
  const handleFeedback = useCallback(
    async (msg: Message, feedback: "good" | "bad") => {
      if (msg.feedback === feedback) {
        // 取消反馈
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, feedback: null, feedbackReason: null } : m
          )
        );
        if (msg.id !== "welcome" && !msg.id.startsWith("welcome-")) {
          feedbackMessage(msg.id, null).catch(() => {});
        }
        return;
      }
      if (feedback === "bad") {
        setFeedbackTarget(msg);
        setFeedbackReason(msg.feedbackReason || "");
        return;
      }
      // good
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, feedback: "good", feedbackReason: null } : m
        )
      );
      if (msg.id !== "welcome" && !msg.id.startsWith("welcome-")) {
        feedbackMessage(msg.id, "good")
          .then(() => toast.success("已记录好评"))
          .catch(() => toast.error("反馈失败"));
      }
    },
    []
  );

  // 提交差评原因
  const submitBadFeedback = useCallback(async () => {
    if (!feedbackTarget) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === feedbackTarget.id
          ? { ...m, feedback: "bad", feedbackReason: feedbackReason.trim() || null }
          : m
      )
    );
    if (feedbackTarget.id !== "welcome" && !feedbackTarget.id.startsWith("welcome-")) {
      feedbackMessage(feedbackTarget.id, "bad", feedbackReason.trim() || undefined)
        .then(() => toast.success("已记录反馈"))
        .catch(() => toast.error("反馈失败"));
    }
    setFeedbackTarget(null);
    setFeedbackReason("");
  }, [feedbackTarget, feedbackReason]);

  return (
    <div className={cn("flex h-full min-h-[calc(100vh-100px)] flex-col", inDrawer ? "" : "mx-auto max-w-4xl px-4 py-2")}>
      {/* 页头（抽屉模式隐藏，由抽屉自带 header） */}
      {!inDrawer && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSessionList((v) => !v)}
              title={showSessionList ? "隐藏历史会话" : "显示历史会话"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              {showSessionList ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
            {hasAvatarUrl ? (
              <img
                src={assistantAvatarUrl}
                alt={assistantName}
                className="h-10 w-10 rounded-xl object-cover shadow-md"
                draggable={false}
                onError={(e) => {
                  // 头像加载失败：回退到 emoji 显示
                  const t = e.currentTarget as HTMLImageElement;
                  t.style.display = "none";
                  const parent = t.parentElement;
                  if (parent) {
                    const fallback = document.createElement("div");
                    fallback.className =
                      "flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl shadow-md";
                    fallback.textContent = assistantEmoji;
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl shadow-md">
                {assistantEmoji}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{assistantName} · 超级助理</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                基于记忆图谱和认知库 · 支持 Function Calling
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              title="助理设置"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={handleNewChat}
              title="新建对话"
              className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>新对话</span>
            </button>
            {messages.length > 1 && (
              <button
                onClick={() => setConfirmClear(true)}
                title="清空当前对话"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <HelpButton module="ai-assistant" />
          </div>
        </div>
      )}

      {/* 抽屉模式：顶部操作栏（简化版） */}
      {inDrawer && (
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <button
            onClick={() => setShowSessionList((v) => !v)}
            title={showSessionList ? "隐藏历史会话" : "显示历史会话"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            {showSessionList ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(true)}
              title="助理设置"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleNewChat}
              title="新建对话"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {messages.length > 1 && (
              <button
                onClick={() => setConfirmClear(true)}
                title="清空当前对话"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 gap-3 overflow-hidden px-3 pb-3">
        {/* 历史会话侧边栏 */}
        <AnimatePresence>
          {showSessionList && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="glass-card flex shrink-0 flex-col overflow-hidden"
            >
              <div className="border-b border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                历史会话 · {sessions.length}
              </div>
              <div className="flex-1 overflow-auto p-2">
                {sessions.length === 0 ? (
                  <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
                    暂无历史会话
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleLoadSession(s.id)}
                        className={cn(
                          "group flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-xs transition-colors",
                          s.id === currentSessionId
                            ? "bg-primary/10 text-foreground"
                            : "text-foreground/80 hover:bg-primary/8 hover:text-foreground"
                        )}
                      >
                        <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{s.title || "新对话"}</div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground/70">
                            {s.messageCount ?? 0} 条 · {new Date(s.updatedAt).toLocaleDateString("zh-CN")}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          title="删除会话"
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 消息区 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div
            ref={scrollRef}
            className="flex flex-1 flex-col gap-4 overflow-auto rounded-2xl border border-border/40 bg-muted/20 p-4"
          >
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onFeedback={handleFeedback}
                avatarUrl={assistantAvatarUrl}
                hasAvatarUrl={hasAvatarUrl}
                assistantEmoji={assistantEmoji}
              />
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {assistantName} 正在思考...
              </div>
            )}
            {/* 空状态：欢迎语 + 建议卡片 */}
            {!loading && messages.length === 1 && messages[0].id === "welcome" && (
              <div className="mt-2 flex flex-col gap-2">
                <div className="px-1 text-xs font-medium text-muted-foreground">试试这些：</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => handleSend(s.text)}
                        className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-left text-xs transition-all hover:border-cognition/40 hover:bg-cognition/5"
                      >
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", s.color)} />
                        <span className="text-foreground/80">{s.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 快捷指令 */}
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => {
                  setInput((prev) => (prev ? prev + "\n" + cmd.message : cmd.message));
                  inputRef.current?.focus();
                }}
                title={cmd.description}
                className="ios-pill text-xs"
              >
                <span className="mr-1">{cmd.icon}</span>
                {cmd.label}
              </button>
            ))}
          </div>

          {/* 输入框 */}
          <div className="glass-card mt-3 flex items-end gap-2 p-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入指令，按 Enter 发送，Shift+Enter 换行..."
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="btn-primary-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 清空确认弹窗 */}
      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="清空当前对话" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-foreground/80">
            确认清空当前对话？所有消息将被删除，此操作不可撤销。
          </p>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setConfirmClear(false)} className="btn-glass flex h-8 items-center px-3 text-xs">
              取消
            </button>
            <button
              onClick={handleClear}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              确认清空
            </button>
          </div>
        </div>
      </Modal>

      {/* 差评反馈弹窗 */}
      <Modal
        open={!!feedbackTarget}
        onClose={() => {
          setFeedbackTarget(null);
          setFeedbackReason("");
        }}
        title="反馈原因（可选）"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground/80">
            告诉 {assistantName} 哪里做得不好，我会学习改进。
          </p>
          {feedbackTarget && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {feedbackTarget.content}
              </p>
            </div>
          )}
          <textarea
            value={feedbackReason}
            onChange={(e) => setFeedbackReason(e.target.value)}
            placeholder="例如：回答不准确、遗漏关键信息、格式混乱..."
            rows={3}
            className="w-full resize-none rounded-xl border border-border/60 bg-background/40 p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setFeedbackTarget(null);
                setFeedbackReason("");
              }}
              className="btn-glass flex h-8 items-center px-3 text-xs"
            >
              取消
            </button>
            <button
              onClick={submitBadFeedback}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              提交反馈
            </button>
          </div>
        </div>
      </Modal>

      {/* AI 助理设置弹窗（对齐 Web 端 /api/ai/settings） */}
      <AISettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={aiSettings}
        avatarUrl={assistantAvatarUrl}
        onSaved={() => refetchSettings()}
      />
    </div>
  );
}

// ============ 消息气泡组件 ============

function MessageBubble({
  message,
  onFeedback,
  avatarUrl,
  hasAvatarUrl,
  assistantEmoji,
}: {
  message: Message;
  onFeedback: (msg: Message, feedback: "good" | "bad") => void;
  avatarUrl: string;
  hasAvatarUrl: boolean;
  assistantEmoji: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showToolDetail, setShowToolDetail] = useState(false);
  const isUser = message.role === "user";
  const isWelcome = message.id === "welcome" || message.id.startsWith("welcome-");

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("group flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {isUser ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-4 w-4" />
        </div>
      ) : hasAvatarUrl ? (
        <img
          src={avatarUrl}
          alt="奇思"
          className="h-8 w-8 shrink-0 rounded-full object-cover shadow-sm"
          draggable={false}
          onError={(e) => {
            const t = e.currentTarget as HTMLImageElement;
            t.style.display = "none";
            const parent = t.parentElement;
            if (parent) {
              parent.className =
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-base";
              parent.textContent = assistantEmoji;
            }
          }}
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-base">
          {assistantEmoji}
        </div>
      )}
      <div className={cn("flex max-w-[80%] flex-col", isUser && "items-end")}>
        {/* 工具调用进度卡片（流式期间显示） */}
        {message.toolProgress && (
          <div
            className={cn(
              "mb-1.5 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
              message.toolProgress.status === "running"
                ? "border-cognition/30 bg-cognition/5 text-cognition"
                : "border-task/30 bg-task/5 text-task"
            )}
          >
            {message.toolProgress.status === "running" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            <Wrench className="h-3 w-3" />
            <span className="font-medium">
              {message.toolProgress.status === "running"
                ? `正在执行: ${message.toolProgress.tool}`
                : `${message.toolProgress.tool} 执行完成`}
            </span>
          </div>
        )}

        {/* 工具调用卡片（消息完成后显示） */}
        {message.toolCalled && (
          <div className="mb-1.5 overflow-hidden rounded-xl border border-cognition/30 bg-cognition/5">
            <button
              onClick={() => setShowToolDetail((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs text-cognition transition-colors hover:bg-cognition/10"
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                <span className="font-medium">工具调用</span>
                <span className="text-muted-foreground">
                  {summarizeToolResult(message.toolCalled)}
                </span>
              </div>
              {showToolDetail ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            <AnimatePresence>
              {showToolDetail && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-cognition/20"
                >
                  <div className="space-y-2 p-3 text-[11px]">
                    <div>
                      <span className="font-medium text-foreground/70">工具：</span>
                      <code className="rounded bg-muted/50 px-1 py-0.5 text-cognition">
                        {message.toolCalled.tool}
                      </code>
                    </div>
                    <div>
                      <span className="font-medium text-foreground/70">参数：</span>
                      <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/30 p-2 text-[10px] text-foreground/80">
                        {JSON.stringify(message.toolCalled.args, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="font-medium text-foreground/70">结果：</span>
                      <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted/30 p-2 text-[10px] text-foreground/80">
                        {typeof message.toolCalled.result === "string"
                          ? message.toolCalled.result
                          : JSON.stringify(message.toolCalled.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 消息内容 */}
        <div
          className={cn(
            "relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            message.error
              ? "border border-destructive/30 bg-destructive/5 text-destructive"
              : isUser
                ? "bg-primary text-primary-foreground"
                : "glass-card"
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : message.streaming && !message.content ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">思考中...</span>
            </div>
          ) : (
            <div
              className="md-content whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
            />
          )}
          {!isUser && !message.streaming && message.content && (
            <button
              onClick={copy}
              className="absolute -right-8 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-primary/10 hover:text-foreground group-hover:opacity-100"
              title="复制"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* 元信息 + 反馈按钮 */}
        {!message.streaming && (
          <div className={cn("mt-1 flex items-center gap-2 text-[10px] text-muted-foreground", isUser && "flex-row-reverse")}>
            <span>{message.time}</span>
            {message.provider && (
              <span className="opacity-60">
                {message.provider}
                {message.hermesFallback ? " · 回退" : message.hermesMode ? " · 奇思" : ""}
              </span>
            )}
            {message.usage?.total_tokens && (
              <span className="opacity-50">{message.usage.total_tokens} tokens</span>
            )}
            {!isUser && !isWelcome && !message.error && (
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => onFeedback(message, "good")}
                  title="好回答"
                  className={cn(
                    "rounded p-0.5 transition-colors hover:bg-task/10",
                    message.feedback === "good" ? "text-task" : "text-muted-foreground hover:text-task"
                  )}
                >
                  <ThumbsUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onFeedback(message, "bad")}
                  title="差回答"
                  className={cn(
                    "rounded p-0.5 transition-colors hover:bg-destructive/10",
                    message.feedback === "bad" ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                  )}
                >
                  <ThumbsDown className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============ AI 助理设置弹窗（对齐 Web 端 /api/ai/settings） ============

function AISettingsModal({
  open,
  onClose,
  settings,
  avatarUrl,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  settings?: AISettings;
  avatarUrl: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AISettings>({});
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // 可选 emoji 头像（无 URL 时使用，对齐 Web 端）
  const EMOJI_CHOICES = ["🦊", "🐱", "🤖", "🐼", "🧠", "⚡", "🌟", "🎯"];

  // 同步 props 到本地表单
  useEffect(() => {
    if (open && settings) {
      setForm({
        assistantName: settings.assistantName || "",
        assistantAvatar: settings.assistantAvatar || "🦊",
        avatarUrl: settings.avatarUrl || "",
        personaStyle: settings.personaStyle || "",
        distilledStyle: settings.distilledStyle || "",
        styleStrength: settings.styleStrength ?? 0.5,
        autoSpeak: settings.autoSpeak ?? false,
        voiceMode: settings.voiceMode ?? false,
        feishuNotify: settings.feishuNotify ?? false,
        hermesTakeover: settings.hermesTakeover ?? false,
        hermesAutoReport: settings.hermesAutoReport ?? false,
        hermesReportCron: settings.hermesReportCron || "",
        larkWebhookUrl: settings.larkWebhookUrl || "",
      });
    }
  }, [open, settings]);

  const update = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // 头像文件上传：multipart/form-data 上传到 /api/ai/avatar-upload
  // 参考 Web 端 src/app/ai/assistant/page.tsx 的 handleAvatarUpload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("头像文件过大，最大 2MB");
      return;
    }
    setAvatarUploading(true);
    try {
      const base = getCloudEndpoint().replace(/\/+$/, "");
      const url = `${base}/api/ai/avatar-upload`;
      const formData = new FormData();
      formData.append("file", file);

      // 走 fetch + Bearer token（与 cloudApi 认证方式一致）
      const token = useAuthStore.getState().token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url, { method: "POST", headers, body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setForm((prev) => ({ ...prev, avatarUrl: data.url }));
        // 立即保存到后端，避免关闭弹窗后丢失
        await cloudApi.put("/api/ai/settings", { ...form, avatarUrl: data.url });
        toast.success("头像上传成功");
        onSaved();
      } else {
        toast.error(data?.error || "上传失败");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setAvatarUploading(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await cloudApi.put("/api/ai/settings", form);
      toast.success("设置已保存");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="助理设置" size="lg">
      <div className="space-y-5">
        {/* 头像 - 支持 Emoji 选择、URL 输入和文件上传（对齐 Web 端） */}
        <div>
          <label className="mb-2 block text-xs font-medium text-foreground">助理头像</label>
          {/* 当前头像预览 */}
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-md">
              {form.avatarUrl ? (
                <img
                  src={resolveAvatarUrl(form.avatarUrl) || avatarUrl}
                  alt="助理头像"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // URL 头像加载失败：回退到 emoji
                    const t = e.currentTarget as HTMLImageElement;
                    t.style.display = "none";
                    const parent = t.parentElement;
                    if (parent) {
                      parent.className =
                        "flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-3xl shadow-md";
                      parent.textContent = form.assistantAvatar || "🦊";
                    }
                  }}
                />
              ) : (
                <span className="text-3xl">{form.assistantAvatar || "🦊"}</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-muted-foreground">
                {form.avatarUrl ? "当前使用图片 URL" : "当前使用 Emoji（无 URL 时显示）"}
              </p>
              {form.avatarUrl && (
                <button
                  onClick={() => update("avatarUrl", "")}
                  className="mt-1 text-[11px] text-destructive hover:underline"
                >
                  移除头像 URL（回退到 Emoji）
                </button>
              )}
            </div>
          </div>

          {/* Emoji 选择器（无 URL 时使用） */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {EMOJI_CHOICES.map((emoji) => (
              <button
                key={emoji}
                onClick={() => update("assistantAvatar", emoji)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors",
                  form.assistantAvatar === emoji
                    ? "border-primary bg-primary/10"
                    : "border-border/60 bg-background/40 hover:bg-primary/5"
                )}
              >
                {emoji}
              </button>
            ))}
            <span className="ml-1 text-[11px] text-muted-foreground">无 URL 时显示</span>
          </div>

          {/* URL 输入 + 文件上传 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={form.avatarUrl || ""}
              onChange={(e) => update("avatarUrl", e.target.value)}
              placeholder="粘贴图片 URL 或点击右侧上传"
              className="h-9 flex-1 rounded-lg border border-border/60 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              ref={avatarFileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              onClick={() => avatarFileRef.current?.click()}
              disabled={avatarUploading}
              className="btn-glass flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs disabled:opacity-50"
            >
              {avatarUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {avatarUploading ? "上传中" : "上传"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            支持 PNG/JPEG/GIF/WebP/SVG，最大 2MB
          </p>
        </div>

        {/* 助理名称 */}
        <div>
          <label className="text-xs font-medium text-foreground">助理名称</label>
          <input
            type="text"
            value={form.assistantName || ""}
            onChange={(e) => update("assistantName", e.target.value)}
            placeholder="Lynn"
            maxLength={20}
            className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* 人设风格 */}
        <div>
          <label className="text-xs font-medium text-foreground">人设风格（Persona）</label>
          <textarea
            value={form.personaStyle || ""}
            onChange={(e) => update("personaStyle", e.target.value)}
            placeholder="例如：温和、专业、简洁，偶尔用比喻解释复杂概念"
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-border/60 bg-background/40 p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* 风格强度 */}
        <div>
          <label className="text-xs font-medium text-foreground">
            风格强度：{((form.styleStrength ?? 0.5) * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={form.styleStrength ?? 0.5}
            onChange={(e) => update("styleStrength", Number(e.target.value))}
            className="mt-2 w-full accent-primary"
          />
        </div>

        {/* 开关组 */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToggleRow
            label="自动语音播报"
            checked={form.autoSpeak ?? false}
            onChange={(v) => update("autoSpeak", v)}
          />
          <ToggleRow
            label="语音模式"
            checked={form.voiceMode ?? false}
            onChange={(v) => update("voiceMode", v)}
          />
          <ToggleRow
            label="飞书通知"
            checked={form.feishuNotify ?? false}
            onChange={(v) => update("feishuNotify", v)}
          />
          <ToggleRow
            label="奇思 Agent 接管"
            checked={form.hermesTakeover ?? false}
            onChange={(v) => update("hermesTakeover", v)}
          />
          <ToggleRow
            label="自动报告"
            checked={form.hermesAutoReport ?? false}
            onChange={(v) => update("hermesAutoReport", v)}
          />
        </div>

        {/* 飞书 Webhook */}
        <div>
          <label className="text-xs font-medium text-foreground">飞书 Webhook URL</label>
          <input
            type="text"
            value={form.larkWebhookUrl || ""}
            onChange={(e) => update("larkWebhookUrl", e.target.value)}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
            className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
          <button onClick={onClose} className="btn-glass flex h-9 items-center px-4 text-sm">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary-glass flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存设置
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
        checked
          ? "border-primary/30 bg-primary/5 text-foreground"
          : "border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="font-medium">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

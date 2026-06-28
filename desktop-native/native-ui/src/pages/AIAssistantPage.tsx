import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import {
  Send,
  Bot,
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import {
  type Message,
  type ChatSession,
  QUICK_COMMANDS,
  listSessions,
  createSession,
  getSession,
  deleteSession,
  appendMessage,
  feedbackMessage,
  chatCompletion,
  streamSimulate,
  renderMarkdown,
  summarizeToolResult,
} from "@/lib/ai-assistant";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content: "你好，我是 Lynn · 你的 Lynx超级助理。\n\n我可以帮你查询任务、分析灵感、搜索记忆、执行技能，甚至通过 Lynx Agent 操控本地电脑。\n\n试试下方的快捷指令，或直接告诉我你想做什么。",
  time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
};

const SUGGESTIONS = [
  { icon: Target, text: "今天有哪些任务需要聚焦？", color: "text-northstar" },
  { icon: Brain, text: "帮我分析最近的灵感趋势", color: "text-cognition" },
  { icon: BookOpen, text: "从认知库中找一条方法论", color: "text-cognition" },
  { icon: Zap, text: "快速捕获一条灵感", color: "text-northstar" },
];

export function AIAssistantPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<Message | null>(null);
  const [feedbackReason, setFeedbackReason] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialPromptHandled = useRef(false);

  // 加载会话列表
  const { data: sessions = [] } = useQuery<ChatSession[]>({
    queryKey: ["ai-sessions"],
    queryFn: listSessions,
  });

  // 自动滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // 发送消息
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
      appendMessage(sessionId, { role: "user", content }).catch((e) =>
        console.warn("持久化用户消息失败", e)
      );

      // 构建历史消息（含当前用户消息）
      const history = [...messages, userMsg]
        .filter((m) => !m.error && m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      // 调用 AI（非流式）
      const res = await chatCompletion({ messages: history, sessionId });

      // 逐字模拟流式输出
      await streamSimulate(
        res.content || "",
        (partial) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: partial } : m
            )
          );
        },
        controller.signal
      );

      // 最终化 AI 消息
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: res.content || "",
                streaming: false,
                provider: res.provider,
                model: res.model,
                usage: res.usage,
                toolCalled: res.toolCalled || null,
                hermesMode: res.hermesMode,
                hermesFallback: res.hermesFallback,
              }
            : m
        )
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: `请求失败：${errorMsg}`,
                streaming: false,
                error: true,
              }
            : m
        )
      );
      toast.error("AI 回复失败");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, currentSessionId, queryClient]);

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
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setLoading(false);
    inputRef.current?.focus();
  }, []);

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
          : [{ ...WELCOME_MESSAGE, id: "welcome-" + sessionId }]
      );
      setCurrentSessionId(session.id);
      setShowSessionList(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "加载会话失败");
    } finally {
      setLoading(false);
    }
  }, []);

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
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      {/* 页头 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSessionList((v) => !v)}
            title={showSessionList ? "隐藏历史会话" : "显示历史会话"}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            {showSessionList ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Lynx超级助理</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              基于记忆图谱和认知库 · 支持 Function Calling
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="flex flex-1 gap-3 overflow-hidden">
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
              />
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lynn 正在思考...
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
            告诉 Lynn 哪里做得不好，我会学习改进。
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
    </div>
  );
}

// ============ 消息气泡组件 ============

function MessageBubble({
  message,
  onFeedback,
}: {
  message: Message;
  onFeedback: (msg: Message, feedback: "good" | "bad") => void;
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
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/10 text-primary" : "bg-primary text-primary-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("flex max-w-[80%] flex-col", isUser && "items-end")}>
        {/* 工具调用卡片 */}
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
                {message.hermesFallback ? " · 回退" : message.hermesMode ? " · Lynx" : ""}
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

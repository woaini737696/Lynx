import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Trash2,
  Inbox as InboxIcon,
  Bot,
  Send,
  X,
  Sparkles,
  Check,
  Bell,
  AlertCircle,
  FileText,
  CheckSquare,
  Square,
  Skull,
  Loader2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, formatRelativeTime } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";
import { streamSimulate } from "@/lib/ai-assistant";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import type { Idea, ReviveSuggestion, FinalizeResult } from "@/types/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const COLUMNS = [
  { key: "northstar", label: "北极星", color: "text-northstar", bg: "bg-northstar/10", border: "border-northstar/30" },
  { key: "campaign", label: "战役", color: "text-campaign", bg: "bg-campaign/10", border: "border-campaign/30" },
  { key: "task", label: "任务", color: "text-task", bg: "bg-task/10", border: "border-task/30" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

export function InboxPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTime, setFilterTime] = useState<"all" | "today" | "7days">("all");
  const [expanding, setExpanding] = useState<string | null>(null);
  const [abandoning, setAbandoning] = useState<Idea | null>(null);
  const [reason, setReason] = useState("");
  const [condition, setCondition] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Idea | null>(null);

  // AI 对话状态
  const [chatIdea, setChatIdea] = useState<Idea | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // AI 对话取消控制器：组件卸载或关闭抽屉时 abort，避免 setState on unmounted
  const chatAbortRef = useRef<AbortController | null>(null);

  // 复活建议
  const [showRevivePanel, setShowRevivePanel] = useState(true);
  const [checkingRevive, setCheckingRevive] = useState(false);

  // 图片预览
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 批量选择
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);

  // 加载灵感列表
  const { data: ideas = [], isLoading } = useQuery<Idea[]>({
    queryKey: ["inbox"],
    queryFn: async () => {
      const res = await cloudApi.get<{ ideas?: Idea[] }>("/api/ideas");
      return res.ideas || [];
    },
  });

  // 加载复活建议
  const { data: reviveSuggestions = [], refetch } = useQuery<ReviveSuggestion[]>({
    queryKey: ["inbox-revive"],
    queryFn: async () => {
      const res = await cloudApi.get<{ suggestions?: ReviveSuggestion[] }>("/api/ideas/revive-check");
      return res.suggestions || [];
    },
  });

  // 拖入看板
  const boardMutation = useMutation({
    mutationFn: async ({ idea, column }: { idea: Idea; column: ColumnKey }) => {
      return cloudApi.patch(`/api/ideas/${idea.id}`, { action: "board", column });
    },
    onSuccess: (_data, { column }) => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
      setExpanding(null);
      toast.success(`已拖入${COLUMNS.find((c) => c.key === column)?.label}`);
    },
    onError: (e: Error) => toast.error(e.message || "操作失败"),
  });

  // 送入墓地
  const abandonMutation = useMutation({
    mutationFn: async ({ idea, reason, reviveCondition }: { idea: Idea; reason: string; reviveCondition: string }) => {
      return cloudApi.patch(`/api/ideas/${idea.id}`, {
        action: "abandon",
        reason,
        reviveCondition,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      setAbandoning(null);
      setReason("");
      setCondition("");
      toast.success("已送入灵感墓地");
    },
    onError: (e: Error) => toast.error(e.message || "放弃失败"),
  });

  // 单条删除
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return cloudApi.delete(`/api/ideas`, { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      toast.success("已删除灵感");
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || "删除失败"),
  });

  // 自动滚动
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // 组件卸载时取消正在进行的 AI 对话，避免 setState on unmounted
  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
    };
  }, []);

  // 过滤
  const filtered = useMemo(() => {
    return ideas.filter((idea) => {
      if (searchQuery && !idea.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterTime !== "all") {
        const created = new Date(idea.createdAt).getTime();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        if (filterTime === "today" && now - created > dayMs) return false;
        if (filterTime === "7days" && now - created > 7 * dayMs) return false;
      }
      return true;
    });
  }, [ideas, searchQuery, filterTime]);

  // AI 巡检
  const refreshReviveSuggestions = useCallback(async () => {
    setCheckingRevive(true);
    try {
      const res = await refetch();
      const count = res.data?.length || 0;
      toast.info(`AI 巡检完成：${count} 条复活建议`);
    } catch {
      toast.error("巡检失败");
    } finally {
      setCheckingRevive(false);
    }
  }, [refetch]);

  const dismissRevive = useCallback((id: string) => {
    // 本地隐藏（不调用 API，仅 UI 移除）
    queryClient.setQueryData<ReviveSuggestion[]>(["inbox-revive"], (prev) =>
      (prev || []).filter((s) => s.graveyardId !== id)
    );
  }, [queryClient]);

  // 切换选择
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((i) => i.id)));
  };

  const performBatchDelete = () => {
    deleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        toast.success(`已删除 ${selectedIds.size} 条灵感`);
        setSelectedIds(new Set());
        setMultiSelectMode(false);
        setConfirmBatchDelete(false);
      },
      onError: (e: Error) => {
        toast.error(e.message || "批量删除失败");
        setConfirmBatchDelete(false);
      },
    });
  };

  const handleDelete = (idea: Idea) => {
    setDeleteTarget(idea);
  };

  // ============ AI 对话助理 ============
  const openChat = useCallback((idea: Idea) => {
    setChatIdea(idea);
    setChatMessages([]);
    setChatInput("");
    setFinalizeResult(null);
    setChatStreaming(false);
    // 自动触发第一句
    void streamChat(idea.content, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeChat = () => {
    // 取消正在进行的 AI 对话，避免关闭后继续 setState
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setChatIdea(null);
    setChatMessages([]);
    setChatInput("");
    setChatStreaming(false);
    setFinalizeResult(null);
  };

  // 非流式调用（桌面端通过 Tauri cloud_request 代理，不支持流式）
  const streamChat = async (ideaDraft: string, history: ChatMessage[]) => {
    // 取消上一次未完成的对话，防止回复错位
    chatAbortRef.current?.abort();
    const ctrl = new AbortController();
    chatAbortRef.current = ctrl;

    setChatStreaming(true);
    try {
      const res = await cloudApi.post<{ reply?: string }>("/api/ai/idea-chat", {
        messages: history,
        ideaDraft,
        stream: false,
      });
      if (ctrl.signal.aborted) return;
      const reply = res.reply || "";
      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      await streamSimulate(
        reply,
        (partial) => {
          if (ctrl.signal.aborted) return;
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: partial };
            return updated;
          });
        },
        ctrl.signal
      );
    } catch (e) {
      if (ctrl.signal.aborted) return; // 主动取消，不报错
      toast.error("AI 回复失败，请重试");
    } finally {
      if (chatAbortRef.current === ctrl) {
        chatAbortRef.current = null;
      }
      setChatStreaming(false);
    }
  };

  const sendMessage = () => {
    if (!chatInput.trim() || !chatIdea || chatStreaming) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    void streamChat(chatIdea.content, newMessages);
  };

  const finalizeIdea = async () => {
    if (!chatIdea) return;
    setFinalizing(true);
    try {
      const result = await cloudApi.post<FinalizeResult>("/api/ai/idea-finalize", {
        messages: chatMessages,
        ideaDraft: chatIdea.content,
        ideaId: chatIdea.id,
      });
      setFinalizeResult(result);
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      toast.success("AI 已完成总结和分类");
    } catch {
      toast.error("定稿失败，请重试");
    } finally {
      setFinalizing(false);
    }
  };

  const getColumnLabel = (col: string) => {
    const map: Record<string, string> = {
      northstar: "北极星（核心战略）",
      campaign: "战役（中期目标）",
      task: "任务（短期执行）",
      inbox: "继续留在 Inbox 思考",
      cognition: "认知库",
      graveyard: "灵感墓地",
    };
    return map[col] || col;
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* 页头 */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ideas.length} 条待收敛 · 每晚 23:00 强制处理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshReviveSuggestions}
            disabled={checkingRevive}
            title="AI 巡检复活条件"
            className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
          >
            {checkingRevive ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bell className="h-3.5 w-3.5" />
            )}
            <span>{checkingRevive ? "巡检中..." : "AI 巡检"}</span>
          </button>
          <HelpButton module="inbox" />
        </div>
      </div>

      {/* AI 复活建议面板 */}
      <AnimatePresence>
        {showRevivePanel && reviveSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="glass-card border-cognition/30 bg-cognition/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-cognition">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    AI 复活建议 · {reviveSuggestions.length} 条
                  </span>
                </div>
                <button
                  onClick={() => setShowRevivePanel(false)}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {reviveSuggestions.map((s) => (
                  <div
                    key={s.graveyardId}
                    className="glass-card border-cognition/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-xs font-medium text-foreground/90">
                          原灵感：
                          {s.originalContent.length > 50
                            ? s.originalContent.slice(0, 50) + "…"
                            : s.originalContent}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          复活条件：{s.reviveCondition}
                        </div>
                        <div className="mt-1 text-[11px] text-cognition">{s.reason}</div>
                        {s.matchedContent && (
                          <div className="mt-1 rounded-lg bg-cognition/10 px-2 py-1 text-[10px] text-cognition/90">
                            命中新灵感：
                            {s.matchedContent.length > 40
                              ? s.matchedContent.slice(0, 40) + "…"
                              : s.matchedContent}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => dismissRevive(s.graveyardId)}
                        className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                        title="忽略"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 主体内容 */}
      {isLoading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">加载 Inbox...</p>
        </div>
      ) : ideas.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
          <InboxIcon className="h-12 w-12 opacity-40" />
          <div className="text-center">
            <p className="text-sm font-medium">Inbox 已清空</p>
            <p className="mt-1 text-xs">所有灵感都已收敛到看板或墓地，可以安心工作了</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 工具栏 */}
          <div className="glass-card flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索灵感..."
                className="h-7 w-40 rounded-md bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground"
              />
              <select
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value as "all" | "today" | "7days")}
                className="h-7 rounded-md bg-transparent px-2 text-xs outline-none"
              >
                <option value="all">全部</option>
                <option value="today">今天</option>
                <option value="7days">7 天内</option>
              </select>
            </div>
            {multiSelectMode ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-northstar"
                >
                  {selectedIds.size === filtered.length && filtered.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-northstar" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {selectedIds.size === filtered.length && filtered.length > 0 ? "取消全选" : "全选"}
                </button>
                <span className="text-xs text-muted-foreground">
                  已选 {selectedIds.size} / {filtered.length}
                </span>
                <button
                  onClick={() => {
                    setMultiSelectMode(false);
                    setSelectedIds(new Set());
                  }}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (selectedIds.size === 0) {
                      toast.error("请先选择要删除的灵感");
                      return;
                    }
                    setConfirmBatchDelete(true);
                  }}
                  disabled={selectedIds.size === 0 || deleteMutation.isPending}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-graveyard transition-colors hover:bg-graveyard/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {deleteMutation.isPending ? "删除中..." : "批量删除"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{filtered.length} 条灵感</span>
                <button
                  onClick={() => {
                    setMultiSelectMode(true);
                    setSelectedIds(new Set());
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <CheckSquare className="h-3 w-3" />
                  批量操作
                </button>
              </div>
            )}
          </div>

          {/* 灵感列表 */}
          <AnimatePresence mode="popLayout">
            {filtered.map((idea, i) => {
              const isExpanding = expanding === idea.id;
              const isSelected = selectedIds.has(idea.id);
              return (
                <motion.div
                  key={idea.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    "glass-card group p-4 transition-all hover:-translate-y-0.5",
                    isSelected && "ring-2 ring-northstar/40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {multiSelectMode && (
                      <button onClick={() => toggleSelect(idea.id)} className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-northstar" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </button>
                    )}
                    <span className="mt-0.5 hidden w-6 shrink-0 text-right text-[11px] text-muted-foreground/60 sm:block">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm leading-relaxed">{idea.content}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-1.5 py-0.5">
                          {idea.source === "lightning" ? "⚡" : "💬"}
                          {idea.source === "lightning" ? "闪电输入" : "对话提取"}
                        </span>
                        <span>{formatRelativeTime(idea.createdAt)}</span>
                        {idea.tags?.map((tag) =>
                          tag === "AI建议" ? (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-0.5 rounded-lg bg-cognition/10 px-1.5 py-0.5 text-[10px] text-cognition"
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              {tag}
                            </span>
                          ) : (
                            <span
                              key={tag}
                              className="rounded-lg bg-muted px-1.5 py-0.5 text-[10px]"
                            >
                              {tag}
                            </span>
                          )
                        )}
                      </div>
                      {/* 附件 */}
                      {idea.attachments && idea.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {idea.attachments.map((att, ai) =>
                            att.type === "image" ? (
                              <button
                                key={ai}
                                onClick={() => setPreviewImage(att.url)}
                                className="relative overflow-hidden rounded-lg border border-border transition-transform hover:scale-[1.02]"
                                title={att.name}
                              >
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="h-16 w-16 object-cover"
                                />
                              </button>
                            ) : (
                              <a
                                key={ai}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2 py-1 text-[10px] text-foreground/80 transition-colors hover:bg-primary/10"
                                title={att.name}
                              >
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                <span className="max-w-[100px] truncate">{att.name}</span>
                              </a>
                            )
                          )}
                        </div>
                      )}
                    </div>
                    {/* 操作按钮 */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isExpanding ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {COLUMNS.map((col) => (
                            <button
                              key={col.key}
                              onClick={() =>
                                boardMutation.mutate({ idea, column: col.key })
                              }
                              disabled={boardMutation.isPending}
                              className={cn(
                                "rounded-lg border px-2 py-1 text-[10px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50",
                                col.border,
                                col.bg,
                                col.color
                              )}
                            >
                              {col.label}
                            </button>
                          ))}
                          <button
                            onClick={() => setExpanding(null)}
                            className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        !multiSelectMode && (
                          <>
                            <button
                              onClick={() => openChat(idea)}
                              disabled={boardMutation.isPending}
                              className="btn-glass flex h-8 items-center gap-1 px-2.5 text-xs text-cognition hover:bg-cognition/10"
                            >
                              <Bot className="h-3 w-3" /> 与 AI 讨论
                            </button>
                            <button
                              onClick={() => setExpanding(idea.id)}
                              disabled={boardMutation.isPending}
                              className="btn-glass flex h-8 items-center gap-1 px-2.5 text-xs"
                            >
                              <ArrowRight className="h-3 w-3" /> 看板
                            </button>
                            <button
                              onClick={() => setAbandoning(idea)}
                              disabled={boardMutation.isPending}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-graveyard transition-colors hover:bg-graveyard/10"
                              title="送入墓地"
                            >
                              <Skull className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(idea)}
                              disabled={deleteMutation.isPending}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-graveyard/10 hover:text-graveyard"
                              title="删除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
              没有匹配的灵感
            </div>
          )}
        </div>
      )}

      {/* 送入墓地弹窗 */}
      <Modal
        open={!!abandoning}
        onClose={() => {
          setAbandoning(null);
          setReason("");
          setCondition("");
        }}
        title="送入灵感墓地"
        size="sm"
      >
        {abandoning && (
          <div>
            <p className="mb-4 rounded-xl bg-muted/50 p-2 text-sm text-foreground/80">
              {abandoning.content}
            </p>
            <div className="mb-3 space-y-1">
              <label className="text-[11px] text-muted-foreground">放弃原因（必填）</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[72px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-graveyard"
                placeholder="为什么放弃这个想法..."
              />
            </div>
            <div className="mb-4 space-y-1">
              <label className="text-[11px] text-muted-foreground">
                复活条件（必填 · 系统将自动监测）
              </label>
              <textarea
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="min-h-[72px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-graveyard"
                placeholder="什么条件下可以复活..."
              />
            </div>
            <div className="mb-4 rounded-xl bg-graveyard/10 px-3 py-2 text-[11px] text-graveyard/90">
              当后续输入命中复活条件时，系统会自动提醒
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setAbandoning(null);
                  setReason("");
                  setCondition("");
                }}
                className="btn-glass rounded-lg px-3 py-1.5 text-xs"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!reason.trim() || !condition.trim()) {
                    toast.error("原因和复活条件都必须填写");
                    return;
                  }
                  abandonMutation.mutate({
                    idea: abandoning,
                    reason: reason.trim(),
                    reviveCondition: condition.trim(),
                  });
                }}
                disabled={abandonMutation.isPending}
                className="btn-primary-glass rounded-lg bg-graveyard px-3 py-1.5 text-xs"
              >
                {abandonMutation.isPending ? "处理中..." : "送入墓地"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* AI 对话助理抽屉 */}
      <AnimatePresence>
        {chatIdea && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex justify-end bg-background/40 backdrop-blur-sm"
          >
            <div className="absolute inset-0" onClick={closeChat} />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="ios-glass relative flex h-full w-full max-w-md flex-col rounded-none border-l"
            >
              {/* 头部 */}
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cognition/10 text-cognition">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">AI 灵感教练</div>
                    <div className="text-[10px] text-muted-foreground">多轮讨论 · 一键定稿</div>
                  </div>
                </div>
                <button
                  onClick={closeChat}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 原始灵感 */}
              <div className="border-b border-border/60 bg-muted/30 px-4 py-2.5">
                <div className="text-[10px] text-muted-foreground">原始灵感</div>
                <div className="mt-0.5 text-xs leading-relaxed text-foreground/80">
                  {chatIdea.content}
                </div>
              </div>

              {/* 内容区 */}
              {finalizeResult ? (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="mb-4 flex items-center gap-2 text-cognition">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-semibold">AI 定稿完成</span>
                  </div>
                  <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
                    <div className="mb-1 text-[10px] font-medium text-muted-foreground">讨论总结</div>
                    <div className="text-xs leading-relaxed text-foreground/90">
                      {finalizeResult.summary}
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">自动标签</div>
                    <div className="flex flex-wrap gap-1.5">
                      {finalizeResult.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-cognition/20 bg-cognition/10 px-2.5 py-0.5 text-[11px] text-cognition"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4 rounded-xl border border-cognition/20 bg-cognition/5 p-3">
                    <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                      AI 建议归入
                    </div>
                    <div className="text-sm font-semibold text-cognition">
                      {getColumnLabel(finalizeResult.suggestedColumn)}
                    </div>
                    {finalizeResult.reason && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {finalizeResult.reason}
                      </div>
                    )}
                  </div>
                  {finalizeResult.cognition && (
                    <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
                      <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                        生成认知记录（{finalizeResult.cognition.type}）
                      </div>
                      <div className="text-xs leading-relaxed text-foreground/80">
                        {finalizeResult.cognition.content}
                      </div>
                    </div>
                  )}
                  <div className="mb-4 rounded-xl bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                    灵感已保存并标记为"AI 建议"，AI 将持续关注并提醒处理。你可以继续拖入看板或送入墓地。
                  </div>
                  <button
                    onClick={closeChat}
                    className="btn-primary-glass flex w-full items-center justify-center gap-1.5 py-2.5 text-sm"
                  >
                    <Check className="h-3.5 w-3.5" /> 完成
                  </button>
                </div>
              ) : (
                <>
                  {/* 消息列表 */}
                  <div className="flex-1 overflow-y-auto px-4 py-3">
                    {chatMessages.length === 0 && chatStreaming && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs text-muted-foreground">
                          AI 正在思考...
                        </div>
                      </div>
                    )}
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={cn(
                          "mb-3 flex",
                          msg.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed",
                            msg.role === "user"
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm bg-muted text-foreground"
                          )}
                        >
                          {msg.content || "..."}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* 输入区 */}
                  <div className="border-t border-border/60 p-3">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="输入你的想法... (Enter 发送，Shift+Enter 换行)"
                      className="mb-2 min-h-[60px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-cognition"
                      disabled={chatStreaming}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={sendMessage}
                        disabled={!chatInput.trim() || chatStreaming}
                        className="btn-primary-glass flex flex-1 items-center justify-center gap-1.5 py-2 text-xs disabled:opacity-50"
                      >
                        {chatStreaming ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {chatStreaming ? "回复中..." : "发送"}
                      </button>
                      <button
                        onClick={finalizeIdea}
                        disabled={chatStreaming || finalizing || chatMessages.length === 0}
                        className="btn-glass flex items-center gap-1.5 px-3 py-2 text-xs text-cognition hover:bg-cognition/10 disabled:opacity-50"
                      >
                        {finalizing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {finalizing ? "定稿中..." : "定稿保存"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 图片预览 */}
      <Modal open={!!previewImage} onClose={() => setPreviewImage(null)} size="lg">
        {previewImage && (
          <img
            src={previewImage}
            alt="预览"
            className="max-h-[70vh] w-full object-contain"
          />
        )}
      </Modal>

      {/* 批量删除确认 */}
      <Modal
        open={confirmBatchDelete}
        onClose={() => setConfirmBatchDelete(false)}
        title="确认删除"
        size="sm"
      >
        <p className="text-sm text-muted-foreground">
          确定要永久删除选中的 {selectedIds.size} 条灵感吗？此操作不可恢复。
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setConfirmBatchDelete(false)}
            className="btn-glass rounded-lg px-3 py-1.5 text-xs"
          >
            取消
          </button>
          <button
            onClick={performBatchDelete}
            disabled={deleteMutation.isPending}
            className="btn-primary-glass rounded-lg bg-graveyard px-3 py-1.5 text-xs"
          >
            {deleteMutation.isPending ? "删除中..." : "确认删除"}
          </button>
        </div>
      </Modal>

      {/* 单条删除确认 */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="删除灵感"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground/80">
            确定删除这条灵感？此操作不可恢复。
          </p>
          {deleteTarget && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {deleteTarget.content}
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="btn-glass flex h-8 items-center px-3 text-xs"
            >
              取消
            </button>
            <button
              onClick={() => deleteTarget && deleteMutation.mutate([deleteTarget.id])}
              disabled={deleteMutation.isPending}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              确认删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

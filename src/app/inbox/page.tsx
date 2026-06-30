"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { ArrowRight, Trash2, InboxIcon, Bot, Send, X, Sparkles, Check, Settings, Bell, AlertCircle, FileText, CheckSquare, Square, Skull } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { PageHeader, Card, Button, Badge, Skeleton } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { EmptyState } from "@/components/layout/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { AnimatedList } from "@/components/ui/AnimatedList";
import { cn } from "@/lib/utils";
import { SearchInput, FilterSelect, Pagination, useClientPagination } from "@/components/ui/ListControls";
import type { ReviveSuggestion } from "@/lib/reminder-scheduler";
import { openContextMenu } from "@/components/ui/ContextMenu";
import { RetryState } from "@/components/ui/RetryState";
import { useLightningStore } from "@/store/lightning";

/** 附件结构（与 Idea.attachments 字段一致） */
interface Attachment {
  type: "image" | "file";
  name: string;
  url: string;
  size?: number;
}

interface Idea {
  id: string;
  content: string;
  source: string;
  tags: string[];
  attachments?: Attachment[];
  createdAt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface FinalizeResult {
  idea: Idea;
  cognition?: { id: string; type: string; content: string } | null;
  summary: string;
  tags: string[];
  suggestedColumn: string;
  reason: string;
}

const COLUMNS = [
  { key: "northstar", label: "北极星", color: "text-northstar", bg: "bg-northstar/10", border: "border-northstar/30" },
  { key: "campaign", label: "战役", color: "text-campaign", bg: "bg-campaign/10", border: "border-campaign/30" },
  { key: "task", label: "任务", color: "text-task", bg: "bg-task/10", border: "border-task/30" },
] as const;

export default function InboxPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [abandoning, setAbandoning] = useState<Idea | null>(null);
  const [reason, setReason] = useState("");
  const [condition, setCondition] = useState("");

  // AI 对话助理状态
  const [chatIdea, setChatIdea] = useState<Idea | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI 复活建议
  const [reviveSuggestions, setReviveSuggestions] = useState<ReviveSuggestion[]>([]);
  const [showRevivePanel, setShowRevivePanel] = useState(true);
  const [checkingRevive, setCheckingRevive] = useState(false);

  // 图片放大查看 modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 批量选择模式
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  // 批量删除二次确认
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTime, setFilterTime] = useState<"all" | "today" | "7days">("all");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/ideas");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          // 后端 /api/ideas 使用 paginatedResponse 返回 { success, data: [...], total, hasMore, cursor }
          setIdeas(data.data || data.ideas || []);
        } else if (res.status >= 500) {
          setLoadError("服务器异常，加载灵感失败");
        }
      } catch {
        if (!mounted) return;
        setLoadError("网络错误，加载灵感失败");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();

    // 加载复活建议
    const loadRevive = async () => {
      try {
        const res = await fetch("/api/ideas/revive-check");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setReviveSuggestions(data.suggestions || []);
        }
      } catch {
        // ignore
      }
    };
    loadRevive();

    return () => {
      mounted = false;
    };
  }, [retryCount]);

  // 手动刷新复活建议
  const refreshReviveSuggestions = useCallback(async () => {
    setCheckingRevive(true);
    try {
      const res = await fetch("/api/ideas/revive-check");
      if (res.ok) {
        const data = await res.json();
        setReviveSuggestions(data.suggestions || []);
        toast(`AI 巡检完成：${data.suggestions?.length || 0} 条复活建议`, "info");
      }
    } catch {
      toast("巡检失败", "error");
    } finally {
      setCheckingRevive(false);
    }
  }, []);

  // 忽略复活建议
  const dismissRevive = useCallback((id: string) => {
    setReviveSuggestions((prev) => prev.filter((s) => s.graveyardId !== id));
  }, []);

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

  const { page, pageSize, total, paginated, onPageChange, onPageSizeChange } = useClientPagination(filtered);

  const board = async (idea: Idea, column: typeof COLUMNS[number]["key"]) => {
    setProcessing(idea.id);
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "board", column }),
      });
      if (res.ok) {
        setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
        setExpanding(null);
        toast(`已拖入${COLUMNS.find((c) => c.key === column)?.label}`, "success");
      } else if (res.status === 409) {
        const err = await res.json();
        toast(err.error || "该列已满", "error");
      } else {
        toast("操作失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
    setProcessing(null);
  };

  // 切换单条选择
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((i) => i.id)));
    }
  };

  // 批量删除（真删除）
  const batchDelete = async () => {
    if (selectedIds.size === 0) {
      toast("请先选择要删除的灵感", "error");
      return;
    }
    setConfirmBatchDelete(true);
  };

  const performBatchDelete = async () => {
    setBatchDeleting(true);
    try {
      const res = await fetch("/api/ideas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIdeas((prev) => prev.filter((i) => !selectedIds.has(i.id)));
        toast(`已删除 ${data.deleted} 条灵感`, "success");
        setSelectedIds(new Set());
        setMultiSelectMode(false);
      } else {
        toast(data.error || "批量删除失败", "error");
      }
    } catch {
      toast("批量删除失败", "error");
    }
    setBatchDeleting(false);
    setConfirmBatchDelete(false);
  };

  // 单条删除（真删除，复用批量删除的 DELETE 接口）
  const handleDelete = async (idea: Idea) => {
    if (!confirm("确定删除这条灵感？此操作不可恢复。")) return;
    try {
      const res = await fetch("/api/ideas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [idea.id] }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
        toast("已删除灵感", "success");
      } else {
        toast(data.error || "删除失败", "error");
      }
    } catch {
      toast("删除失败", "error");
    }
  };

  // 进入/退出多选模式
  const enterMultiSelect = () => {
    setMultiSelectMode(true);
    setSelectedIds(new Set());
  };
  const exitMultiSelect = () => {
    setMultiSelectMode(false);
    setSelectedIds(new Set());
  };

  const abandon = async () => {
    if (!abandoning) return;
    if (!reason.trim() || !condition.trim()) {
      toast("原因和复活条件都必须填写", "error");
      return;
    }
    setProcessing(abandoning.id);
    try {
      const res = await fetch(`/api/ideas/${abandoning.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "abandon",
          reason,
          reviveCondition: condition,
        }),
      });
      if (res.ok) {
        setIdeas((prev) => prev.filter((i) => i.id !== abandoning.id));
        setAbandoning(null);
        setReason("");
        setCondition("");
        toast("已送入灵感墓地", "success");
      } else {
        toast("放弃失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
    setProcessing(null);
  };

  // ============ AI 对话助理 ============

  // 自动滚动到消息底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // 打开对话浮窗，自动发送第一条消息触发 AI
  const openChat = useCallback((idea: Idea) => {
    setChatIdea(idea);
    setChatMessages([]);
    setChatInput("");
    setChatStreaming(false);
    setFinalizeResult(null);
    // 自动触发 AI 第一句
    streamChat(idea.content, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 关闭对话浮窗
  const closeChat = () => {
    setChatIdea(null);
    setChatMessages([]);
    setChatInput("");
    setChatStreaming(false);
    setFinalizeResult(null);
  };

  // 流式发送消息到 AI
  const streamChat = async (ideaDraft: string, history: ChatMessage[]) => {
    setChatStreaming(true);
    try {
      const res = await fetch("/api/ai/idea-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, ideaDraft }),
      });

      if (!res.ok) {
        throw new Error("请求失败");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取流");

      const decoder = new TextDecoder();
      let aiContent = "";

      // 添加空的 AI 消息占位
      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiContent += decoder.decode(value, { stream: true });
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: aiContent };
          return updated;
        });
      }
    } catch {
      toast("AI 回复失败，请重试", "error");
      // 移除空的 AI 占位消息
      setChatMessages((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && !prev[prev.length - 1].content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setChatStreaming(false);
    }
  };

  // 发送用户消息
  const sendMessage = () => {
    if (!chatInput.trim() || !chatIdea || chatStreaming) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    streamChat(chatIdea.content, newMessages);
  };

  // 定稿保存
  const finalizeIdea = async () => {
    if (!chatIdea) return;
    setFinalizing(true);
    try {
      const res = await fetch("/api/ai/idea-finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatMessages,
          ideaDraft: chatIdea.content,
          ideaId: chatIdea.id,
        }),
      });

      if (!res.ok) {
        throw new Error("定稿失败");
      }

      const result: FinalizeResult = await res.json();
      setFinalizeResult(result);

      // 更新列表中的灵感
      setIdeas((prev) =>
        prev.map((i) =>
          i.id === chatIdea.id
            ? {
                ...i,
                content: result.idea.content,
                tags: result.idea.tags,
              }
            : i
        )
      );

      toast("AI 已完成总结和分类", "success");
    } catch {
      toast("定稿失败，请重试", "error");
    } finally {
      setFinalizing(false);
    }
  };

  // 确认定稿结果，关闭浮窗
  const confirmFinalize = () => {
    closeChat();
    toast("灵感已保存，AI 将持续关注", "success");
  };

  // 获取建议列的显示标签
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
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Inbox"
        subtitle={`${ideas.length} 条待收敛 · 每晚 23:00 强制处理`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshReviveSuggestions}
              disabled={checkingRevive}
              title="AI 巡检复活条件"
            >
              <Bell className={cn("h-3.5 w-3.5", checkingRevive && "animate-pulse")} />
              <span className="hidden sm:inline">{checkingRevive ? "巡检中..." : "AI 巡检"}</span>
            </Button>
            <a
              href="/settings"
              className="inline-flex h-8 items-center justify-center rounded-xl border border-border bg-transparent px-3 text-[11px] text-foreground transition-all hover:bg-primary/10"
              title="提醒设置"
            >
              <Settings className="h-3.5 w-3.5" />
            </a>
            <HelpButton contentKey="inbox" />
          </div>
        }
      />

      {/* AI 复活建议面板 */}
      {showRevivePanel && reviveSuggestions.length > 0 && (
        <Card className="mb-4 border-cognition/30 bg-cognition/5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-cognition">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">
                AI 复活建议 · {reviveSuggestions.length} 条
              </span>
            </div>
            <button
              onClick={() => setShowRevivePanel(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2">
            {reviveSuggestions.map((s) => (
              <div
                key={s.graveyardId}
                className="rounded-xl border border-cognition/20 glass-card p-3"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-foreground/90">
                      原灵感：{s.originalContent.length > 50
                        ? s.originalContent.slice(0, 50) + "…"
                        : s.originalContent}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      复活条件：{s.reviveCondition}
                    </div>
                    <div className="mt-1 text-[11px] text-cognition">
                      {s.reason}
                    </div>
                    {s.matchedContent && (
                      <div className="mt-1 rounded-lg bg-cognition/10 px-2 py-1 text-[10px] text-cognition/90">
                        命中新灵感：{s.matchedContent.length > 40
                          ? s.matchedContent.slice(0, 40) + "…"
                          : s.matchedContent}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => dismissRevive(s.graveyardId)}
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                    title="忽略"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loadError && !loading ? (
        <RetryState
          message={loadError}
          onRetry={() => setRetryCount((c) => c + 1)}
        />
      ) : loading ? (
        <div className="space-y-3">
          <PageHeader title="Inbox" subtitle="加载中..." />
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-3 sm:p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <Skeleton className="h-4 w-6" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="Inbox 已清空"
          description="所有灵感都已收敛到看板或墓地，可以安心工作了"
          action={
            <Button onClick={() => useLightningStore.getState().open()}>
              按 Ctrl+J 捕获新灵感
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {/* 批量操作栏 */}
          <div className="flex items-center justify-between rounded-lg border border-border/60 ios-glass-sm px-3 py-2">
            {multiSelectMode ? (
              <>
                <div className="flex items-center gap-3">
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
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={exitMultiSelect}
                    className="h-7 text-xs"
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={batchDelete}
                    disabled={selectedIds.size === 0 || batchDeleting}
                    className="h-7 gap-1 text-xs text-graveyard hover:bg-graveyard/10 hover:text-graveyard"
                  >
                    <Trash2 className="h-3 w-3" />
                    {batchDeleting ? "删除中..." : "批量删除"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="text-xs text-muted-foreground">{filtered.length} 条灵感</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={enterMultiSelect}
                  className="h-7 text-xs"
                >
                  <CheckSquare className="h-3 w-3" />
                  批量操作
                </Button>
              </>
            )}
          </div>
          <AnimatedList items={paginated} keyExtractor={(idea: Idea) => idea.id}>
            {(idea: Idea, i: number) => {
            const isExpanding = expanding === idea.id;
            const isSelected = selectedIds.has(idea.id);
            return (
              <Card
                className={`p-0 overflow-hidden ${isSelected ? "ring-2 ring-northstar/40" : ""}`}
                hover
                onContextMenu={(e) => openContextMenu(e, [
                  { label: "与 AI 讨论", icon: <Bot className="h-3.5 w-3.5" />, onClick: () => openChat(idea) },
                  { label: "拖入看板", icon: <ArrowRight className="h-3.5 w-3.5" />, onClick: () => setExpanding(idea.id) },
                  { separator: true },
                  { label: "送入墓地", icon: <Skull className="h-3.5 w-3.5" />, onClick: () => setAbandoning(idea) },
                  { label: "删除", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: () => handleDelete(idea) },
                ])}
              >
                <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                  {multiSelectMode && (
                    <button
                      onClick={() => toggleSelect(idea.id)}
                      className="shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-northstar" />
                      ) : (
                        <Square className="h-5 w-5 text-muted-foreground/50" />
                      )}
                    </button>
                  )}
                  <span className="hidden w-6 text-right text-[11px] text-muted-foreground/60 sm:block">
                    {(page - 1) * pageSize + i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm leading-relaxed">{idea.content}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80 sm:gap-3">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-1.5 py-0.5">
                        {idea.source === "lightning" ? "⚡" : "💬"}
                        {idea.source === "lightning" ? "闪电输入" : "对话提取"}
                      </span>
                      <span>{formatTime(idea.createdAt)}</span>
                      {(Array.isArray(idea.tags) ? idea.tags : []).map((tag) =>
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
                            className="inline-flex items-center rounded-lg bg-muted/20 px-1.5 py-0.5 text-[10px] font-medium text-foreground/70"
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                    {/* 附件展示 */}
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
                              {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isExpanding ? (
                      <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                        {COLUMNS.map((col) => (
                          <button
                            key={col.key}
                            onClick={() => board(idea, col.key)}
                            disabled={processing === idea.id}
                            className={`rounded-lg border ${col.border} ${col.bg} ${col.color} px-2 py-1 text-[10px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50`}
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
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openChat(idea)}
                          disabled={processing === idea.id}
                          className="h-8 text-cognition hover:bg-cognition/10"
                        >
                          <Bot className="h-3 w-3" /> 与 AI 讨论
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpanding(idea.id)}
                          disabled={processing === idea.id}
                          className="h-8"
                        >
                          <ArrowRight className="h-3 w-3" /> 拖入看板
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAbandoning(idea)}
                          disabled={processing === idea.id}
                          className="h-8 text-graveyard hover:bg-graveyard/10 hover:text-graveyard"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
            }}
          </AnimatedList>
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border ios-glass-sm px-4 py-12 text-center text-sm text-muted-foreground">
              没有匹配的灵感
            </div>
          )}
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
        </div>
      )}

      {/* 放弃弹窗 */}
      {abandoning && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4 backdrop-blur-md"
          onClick={() => setAbandoning(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-graveyard/30 glass-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-graveyard">
              <Trash2 className="h-4 w-4" />
              <span className="text-sm font-semibold">送入灵感墓地</span>
            </div>
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
              <label className="text-[11px] text-muted-foreground">复活条件（必填 · 系统将自动监测）</label>
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
              <Button size="sm" variant="ghost" onClick={() => { setAbandoning(null); setReason(""); setCondition(""); }}>
                取消
              </Button>
              <Button size="sm" variant="danger" onClick={abandon} disabled={processing === abandoning.id}>
                {processing === abandoning.id ? "处理中..." : "送入墓地"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI 对话助理抽屉 */}
      {chatIdea && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/30 backdrop-blur-sm">
          {/* 背景点击关闭 */}
          <div className="absolute inset-0" onClick={closeChat} />

          {/* 抽屉主体 */}
          <div className="relative flex h-full w-full max-w-md flex-col glass-card shadow-2xl">
            {/* 头部 */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cognition/10 text-cognition">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">AI 灵感教练</div>
                  <div className="text-[10px] text-muted-foreground">
                    多轮讨论 · 一键定稿
                  </div>
                </div>
              </div>
              <button
                onClick={closeChat}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 原始灵感展示 */}
            <div className="border-b border-border bg-muted/30 px-4 py-2.5">
              <div className="text-[10px] text-muted-foreground">原始灵感</div>
              <div className="mt-0.5 text-xs leading-relaxed text-foreground/80">
                {chatIdea.content}
              </div>
            </div>

            {/* 内容区域 */}
            {finalizeResult ? (
              // 定稿结果展示
              <div className="flex-1 overflow-y-auto p-4">
                <div className="mb-4 flex items-center gap-2 text-cognition">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm font-semibold">AI 定稿完成</span>
                </div>

                {/* 总结 */}
                <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                    讨论总结
                  </div>
                  <div className="text-xs leading-relaxed text-foreground/90">
                    {finalizeResult.summary}
                  </div>
                </div>

                {/* 标签 */}
                <div className="mb-4">
                  <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">
                    自动标签
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {finalizeResult.tags.map((tag) => (
                      <Badge key={tag} color="cognition">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 建议归入 */}
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

                {/* 认知记录 */}
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

                {/* 提示 */}
                <div className="mb-4 rounded-xl bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                  灵感已保存并标记为&ldquo;AI 建议&rdquo;，AI 将持续关注并提醒处理。
                  你可以继续拖入看板或送入墓地。
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={confirmFinalize}
                >
                  <Check className="h-3.5 w-3.5" /> 完成
                </Button>
              </div>
            ) : (
              // 对话界面
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
                      className={`mb-3 flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm bg-muted text-foreground"
                        }`}
                      >
                        {msg.content || "..."}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* 输入区域 */}
                <div className="border-t border-border p-3">
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
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={sendMessage}
                      disabled={!chatInput.trim() || chatStreaming}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {chatStreaming ? "回复中..." : "发送"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={finalizeIdea}
                      disabled={chatStreaming || finalizing || chatMessages.length === 0}
                      className="text-cognition hover:bg-cognition/10"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {finalizing ? "定稿中..." : "定稿保存"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 图片放大查看 modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full glass-card text-foreground transition-colors hover:bg-card"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewImage}
            alt="预览"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* 批量删除二次确认弹窗 */}
      <Modal
        open={confirmBatchDelete}
        onClose={() => setConfirmBatchDelete(false)}
        title="确认删除"
        size="sm"
      >
        <p className="text-base text-foreground/80">
          确定要永久删除选中的 {selectedIds.size} 条灵感吗？此操作不可恢复。
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setConfirmBatchDelete(false)}>
            取消
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => void performBatchDelete()}
            disabled={batchDeleting}
          >
            {batchDeleting ? "删除中..." : "确认删除"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

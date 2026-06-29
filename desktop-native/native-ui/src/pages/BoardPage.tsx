import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Plus,
  Target,
  Swords,
  ListChecks,
  Loader2,
  Skull,
  ChevronDown,
  ChevronRight,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";
import type { BoardTask } from "@/types/api";

type BoardColumn = "northstar" | "campaign" | "task";

interface ColumnData {
  key: BoardColumn;
  label: string;
  icon: React.ElementType;
  color: string;
  limit: number;
}

const COLUMNS: ColumnData[] = [
  { key: "northstar", label: "北极星", icon: Target, color: "text-northstar border-northstar/30 bg-northstar/10", limit: 5 },
  { key: "campaign", label: "战役", icon: Swords, color: "text-campaign border-campaign/30 bg-campaign/10", limit: 10 },
  { key: "task", label: "任务", icon: ListChecks, color: "text-task border-task/30 bg-task/10", limit: 20 },
];

// 判断是否本周内
function isThisWeek(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return date >= weekStart;
}

export function BoardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [addingColumn, setAddingColumn] = useState<BoardColumn | null>(null);
  const [newContent, setNewContent] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedDone, setExpandedDone] = useState<Set<BoardColumn>>(new Set());
  // 认知提取延迟刷新的 timer，组件卸载时清除避免内存泄漏
  const cognitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cognitionTimerRef.current) clearTimeout(cognitionTimerRef.current);
    };
  }, []);

  const { data: tasks = [], isLoading } = useQuery<BoardTask[]>({
    queryKey: ["board"],
    queryFn: async () => {
      const res = await cloudApi.get<{ data?: BoardTask[]; total?: number }>("/api/tasks");
      return res.data || [];
    },
  });

  // 统计
  const stats = useMemo(() => {
    const active = tasks.filter((t) => t.status === "active").length;
    const done = tasks.filter((t) => t.status === "done");
    const doneThisWeek = done.filter((t) => isThisWeek(t.completedAt || t.createdAt)).length;
    return { active, doneTotal: done.length, doneThisWeek };
  }, [tasks]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return cloudApi.patch<{ cognitionPending?: boolean }>(`/api/tasks/${id}`, { status });
    },
    onMutate: ({ id }) => {
      setUpdatingId(id);
    },
    onSuccess: (data, variables) => {
      // 完成任务时，后端会异步提取认知
      if (variables.status === "done" && data.cognitionPending) {
        toast.success("任务已完成 · AI 正在提取认知...");
        // 延迟刷新认知库，让用户能在认知库看到新提取的条目
        if (cognitionTimerRef.current) clearTimeout(cognitionTimerRef.current);
        cognitionTimerRef.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["cognitions"] });
        }, 3000);
      } else if (variables.status === "done") {
        toast.success("任务已完成");
      }
    },
    onSettled: () => {
      setUpdatingId(null);
      queryClient.invalidateQueries({ queryKey: ["board"] });
      queryClient.invalidateQueries({ queryKey: ["focus"] });
    },
  });

  const addMutation = useMutation({
    mutationFn: async ({ column, content }: { column: BoardColumn; content: string }) => {
      return cloudApi.post("/api/tasks", { content, column, status: "active" });
    },
    onSuccess: () => {
      setAddingColumn(null);
      setNewContent("");
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (e: Error) => toast.error(e.message || "添加失败"),
  });

  const handleAdd = (column: BoardColumn) => {
    if (!newContent.trim()) return;
    addMutation.mutate({ column, content: newContent.trim() });
  };

  const toggleDoneExpand = (col: BoardColumn) => {
    setExpandedDone((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p>加载决策看板...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      {/* 页头 */}
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">决策看板</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            北极星 · 战役 · 任务，三层结构清晰决策
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/graveyard")}
            className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
            title="灵感墓地"
          >
            <Skull className="h-3.5 w-3.5" />
            <span>灵感墓地</span>
          </button>
          <HelpButton module="board" />
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="glass-card flex items-center gap-3 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">{stats.active}</div>
            <div className="text-[11px] text-muted-foreground">进行中</div>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-task/10 text-task">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">{stats.doneThisWeek}</div>
            <div className="text-[11px] text-muted-foreground">本周完成</div>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cognition/10 text-cognition">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">{stats.doneTotal}</div>
            <div className="text-[11px] text-muted-foreground">累计完成</div>
          </div>
        </div>
      </div>

      {/* 看板列 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const activeTasks = tasks
            .filter((t) => t.column === column.key && t.status === "active")
            .sort((a, b) => a.position - b.position);
          const doneTasks = tasks
            .filter((t) => t.column === column.key && t.status === "done")
            .sort((a, b) => {
              const aTime = new Date(a.completedAt || a.createdAt || 0).getTime();
              const bTime = new Date(b.completedAt || b.createdAt || 0).getTime();
              return bTime - aTime;
            });
          const Icon = column.icon;
          const isFull = activeTasks.length >= column.limit;
          const isDoneExpanded = expandedDone.has(column.key);

          return (
            <motion.div
              key={column.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg border", column.color)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-semibold text-foreground">{column.label}</span>
                </div>
                <span className={cn("text-xs", isFull ? "text-destructive font-medium" : "text-muted-foreground")}>
                  {activeTasks.length}/{column.limit}
                </span>
              </div>

              <div className="flex min-h-[180px] flex-col gap-2.5 rounded-2xl border border-border/40 bg-muted/20 p-3">
                {activeTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    className="glass-card group relative flex items-start gap-3 p-3.5"
                  >
                    <button
                      onClick={() =>
                        toggleMutation.mutate({
                          id: task.id,
                          status: "done",
                        })
                      }
                      disabled={updatingId === task.id}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        "border-muted-foreground/30 hover:border-primary hover:bg-primary/10"
                      )}
                    >
                      {updatingId === task.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                    </button>
                    <span className="flex-1 text-sm leading-relaxed text-foreground">
                      {task.content}
                    </span>
                  </motion.div>
                ))}

                {activeTasks.length === 0 && !addingColumn && (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/60">
                    暂无{column.label}
                  </div>
                )}

                {addingColumn === column.key ? (
                  <div className="glass-card flex flex-col gap-2 p-3">
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder={`输入${column.label}内容...`}
                      className="min-h-[60px] w-full resize-none rounded-lg bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAdd(column.key);
                        }
                        if (e.key === "Escape") {
                          setAddingColumn(null);
                          setNewContent("");
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setAddingColumn(null);
                          setNewContent("");
                        }}
                        className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleAdd(column.key)}
                        disabled={addMutation.isPending || !newContent.trim()}
                        className="btn-primary-glass rounded-md px-3 py-1.5 text-xs"
                      >
                        {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "添加"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => !isFull && setAddingColumn(column.key)}
                    disabled={isFull}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border border-dashed px-3.5 py-2.5 text-sm transition-colors",
                      isFull
                        ? "cursor-not-allowed border-border/40 text-muted-foreground/40"
                        : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    <Plus className="h-4 w-4" />
                    {isFull ? `${column.label}已满` : `添加${column.label}`}
                  </button>
                )}

                {/* 已完成任务折叠区 */}
                {doneTasks.length > 0 && (
                  <div className="mt-1 border-t border-border/40 pt-2">
                    <button
                      onClick={() => toggleDoneExpand(column.key)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-1.5">
                        {isDoneExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <span>已完成 · {doneTasks.length}</span>
                      </div>
                      <span title="AI 已提取认知">
                        <Sparkles className="h-3 w-3 text-cognition/60" />
                      </span>
                    </button>
                    <AnimatePresence>
                      {isDoneExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-1.5 pt-1">
                            {doneTasks.map((task) => (
                              <div
                                key={task.id}
                                className="group flex items-start gap-2 rounded-lg bg-muted/20 p-2"
                              >
                                <button
                                  onClick={() =>
                                    toggleMutation.mutate({
                                      id: task.id,
                                      status: "active",
                                    })
                                  }
                                  disabled={updatingId === task.id}
                                  className={cn(
                                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                    "border-primary bg-primary text-primary-foreground hover:bg-primary/80"
                                  )}
                                >
                                  {updatingId === task.id ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <Check className="h-2.5 w-2.5" />
                                  )}
                                </button>
                                <span className="flex-1 text-xs leading-relaxed text-muted-foreground line-through">
                                  {task.content}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

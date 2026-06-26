"use client";

import { useEffect, useState } from "react";
import { Check, Plus, RotateCcw, X, Target, Swords, ListChecks, ChevronDown, ChevronRight, TrendingUp, Brain, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOARD_COLUMNS, type BoardColumn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { PageHeader, Card, Button, Skeleton } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";

interface Task {
  id: string;
  content: string;
  column: BoardColumn;
  status: "active" | "done" | "dropped";
  position: number;
  updatedAt?: string;
  sourceId?: string | null;
}

// AI 提取的认知数据项
interface ExtractedCognition {
  type: "method" | "experience" | "prompt";
  content: string;
}

// 认知确认弹窗状态
interface CognitionModalState {
  taskId: string;
  taskContent: string;
  ideaId: string | null;
  cognitions: ExtractedCognition[];
}

interface ColumnData {
  key: BoardColumn;
  tasks: Task[];
}

interface TaskStats {
  totalCompleted: number;
  totalActive: number;
  thisWeekCompleted: number;
  byColumn: { northstar: number; campaign: number; task: number };
}

const COLUMN_ICONS = {
  northstar: Target,
  campaign: Swords,
  task: ListChecks,
};

// localStorage key：累计完成数（前端缓存，用于离线展示）
const COMPLETED_COUNT_KEY = "lynnhub:board:completed-count";

export default function BoardPage() {
  const [columns, setColumns] = useState<ColumnData[]>(
    (Object.keys(BOARD_COLUMNS) as BoardColumn[]).map((key) => ({ key, tasks: [] }))
  );
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<BoardColumn | null>(null);
  const [newContent, setNewContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [showDone, setShowDone] = useState(false);

  // 认知确认弹窗状态：非 null 时显示弹窗
  const [cognitionModal, setCognitionModal] = useState<CognitionModalState | null>(null);
  // 弹窗中可编辑的认知列表
  const [editableCognitions, setEditableCognitions] = useState<ExtractedCognition[]>([]);
  // 入库中状态
  const [savingCognitions, setSavingCognitions] = useState(false);

  // 加载任务列表
  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        const tasks: Task[] = data.tasks || [];
        setColumns(
          (Object.keys(BOARD_COLUMNS) as BoardColumn[]).map((key) => ({
            key,
            tasks: tasks
              .filter((t) => t.column === key && t.status === "active")
              .sort((a, b) => a.position - b.position),
          }))
        );
        setDoneTasks(
          tasks
            .filter((t) => t.status === "done")
            .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
        );
      }
    } catch (e) {
      console.error(e);
      toast("加载看板失败", "error");
    } finally {
      setLoading(false);
    }
  };

  // 加载统计
  const loadStats = async () => {
    try {
      const res = await fetch("/api/tasks/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        // 同步到 localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem(
            COMPLETED_COUNT_KEY,
            String(data.totalCompleted || 0)
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      await loadTasks();
      if (!mounted) return;
      await loadStats();
    };
    load();

    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === "LYNNHUB_REFRESH_BOARD") {
        load();
      }
    };
    window.addEventListener("message", handleMsg);
    return () => {
      mounted = false;
      window.removeEventListener("message", handleMsg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDone = async (task: Task) => {
    const newStatus = task.status === "done" ? "active" : "done";
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        if (newStatus === "done") {
          // 从列中移除，加入已完成列表
          const updatedTask: Task = {
            ...task,
            status: "done",
            updatedAt: new Date().toISOString(),
          };
          setColumns((prev) =>
            prev.map((col) => ({
              ...col,
              tasks: col.tasks.filter((t) => t.id !== task.id),
            }))
          );
          setDoneTasks((prev) => [updatedTask, ...prev]);

          // 如果后端提取到认知，弹出确认弹窗（不立即 toast）
          if (data.cognitionExtracted && Array.isArray(data.extractedCognitions) && data.extractedCognitions.length > 0) {
            const cognitions: ExtractedCognition[] = data.extractedCognitions.map(
              (c: ExtractedCognition) => ({ type: c.type, content: c.content })
            );
            setEditableCognitions(cognitions);
            setCognitionModal({
              taskId: task.id,
              taskContent: task.content,
              ideaId: task.sourceId || null,
              cognitions,
            });
          } else {
            // 未提取到认知，直接 toast
            toast("任务已完成", "success");
          }
          // 刷新统计
          loadStats();
        } else {
          // 从已完成列表移除，回到原列
          setDoneTasks((prev) => prev.filter((t) => t.id !== task.id));
          setColumns((prev) =>
            prev.map((col) =>
              col.key === task.column
                ? { ...col, tasks: [...col.tasks, { ...task, status: "active" }] }
                : col
            )
          );
          toast("任务已恢复", "success");
          loadStats();
        }
        // 通知今日聚焦页刷新
        window.postMessage({ type: "LYNNHUB_REFRESH_FOCUS" }, "*");
      }
    } catch {
      toast("网络错误", "error");
    }
  };

  // 确认入库：将编辑后的认知逐条写入 Cognition 表
  const confirmSaveCognitions = async () => {
    if (!cognitionModal) return;
    // 过滤掉空内容
    const toSave = editableCognitions.filter((c) => c.content.trim());
    if (toSave.length === 0) {
      toast("没有可入库的认知", "info");
      setCognitionModal(null);
      return;
    }
    setSavingCognitions(true);
    try {
      // 并行入库，避免 N 次串行 HTTP 往返
      const results = await Promise.all(
        toSave.map((c) =>
          fetch("/api/cognitions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: c.type,
              content: c.content,
              source: "task",
              ideaId: cognitionModal.ideaId,
            }),
          }).then((r) => r.ok)
        )
      );
      const savedCount = results.filter(Boolean).length;
      toast(`已入库 ${savedCount} 条认知`, "success");
      setCognitionModal(null);
      setEditableCognitions([]);
    } catch {
      toast("网络错误", "error");
    } finally {
      setSavingCognitions(false);
    }
  };

  // 跳过：不入库
  const skipCognitions = () => {
    setCognitionModal(null);
    setEditableCognitions([]);
    toast("已跳过认知入库", "info");
  };

  const addTask = async (column: BoardColumn) => {
    if (!newContent.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent, column }),
      });
      if (res.ok) {
        const data = await res.json();
        setColumns((prev) =>
          prev.map((col) =>
            col.key === column ? { ...col, tasks: [...col.tasks, data.task] } : col
          )
        );
        setNewContent("");
        setAdding(null);
        toast("任务已创建", "success");
        loadStats();
      } else {
        const err = await res.json();
        setError(err.error);
        toast(err.error, "error");
      }
    } catch {
      toast("网络错误", "error");
    }
  };

  const columnEntries = Object.entries(BOARD_COLUMNS) as [
    BoardColumn,
    { label: string; limit: number }
  ][];

  if (loading) {
    return (
      <div className="p-4 sm:p-8">
        <PageHeader title="决策看板" subtitle="加载中..." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {columnEntries.map(([key, meta]) => (
            <Card key={key} className="flex min-h-[360px] flex-col border-t-4 p-0" style={{ borderTopColor: `hsl(var(--${key}))` }}>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
              <div className="flex-1 space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="决策看板"
        subtitle="北极星 ≤3 · 战役 ≤5 · 任务 ≤10，满额阻断"
        action={
          <div className="flex items-center gap-2">
            {stats ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-task" />
                  <span className="text-muted-foreground">累计完成</span>
                  <span className="font-semibold text-task">{stats.totalCompleted}</span>
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">本周</span>
                  <span className="font-semibold text-cognition">{stats.thisWeekCompleted}</span>
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">进行中</span>
                  <span className="font-semibold text-northstar">{stats.totalActive}</span>
                </div>
              </div>
            ) : null}
            <HelpButton contentKey="board" />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {columnEntries.map(([key, meta]) => {
          const col = columns.find((c) => c.key === key)!;
          const isFull = col.tasks.length >= meta.limit;
          const isAdding = adding === key;
          const Icon = COLUMN_ICONS[key];

          return (
            <Card
              key={key}
              className="flex min-h-[360px] flex-col border-t-4 p-0"
              style={{ borderTopColor: `hsl(var(--${key}))` }}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: `hsl(var(--${key}))` }} />
                  <h2 className="text-sm font-semibold">{meta.label}</h2>
                  <span
                    className={cn(
                      "ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      isFull
                        ? "bg-graveyard/10 text-graveyard"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {col.tasks.length}/{meta.limit}
                  </span>
                </div>
                {!isAdding && (
                  <button
                    onClick={() => {
                      setAdding(key);
                      setNewContent("");
                      setError(null);
                    }}
                    disabled={isFull}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {error && adding === key && (
                <div className="mx-4 mt-3 rounded-lg border border-graveyard/30 bg-graveyard/10 px-2.5 py-1.5 text-[11px] text-graveyard">
                  {error}
                </div>
              )}

              {isAdding && (
                <div className="p-3">
                  <input
                    autoFocus
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addTask(key);
                      if (e.key === "Escape") setAdding(null);
                    }}
                    placeholder={`添加${meta.label}...`}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-primary"
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
                      取消
                    </Button>
                    <Button size="sm" onClick={() => addTask(key)}>
                      添加
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex-1 space-y-2 p-3">
                {col.tasks.length === 0 ? (
                  <div className="flex h-24 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center">
                    <span className="text-xs text-muted-foreground">暂无{meta.label}</span>
                  </div>
                ) : (
                  col.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="group flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-background p-2.5 transition-all hover:border-primary/30 hover:shadow-sm"
                      onClick={() => toggleDone(task)}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          "border-border bg-transparent hover:border-primary"
                        )}
                      >
                      </div>
                      <span className="flex-1 text-xs leading-relaxed">
                        {task.content}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 已完成折叠区域 */}
      <Card className="mt-4 p-0">
        <button
          onClick={() => setShowDone((v) => !v)}
          className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/30"
        >
          <div className="flex items-center gap-2">
            {showDone ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Check className="h-4 w-4 text-task" />
            <h2 className="text-sm font-semibold">已完成</h2>
            <span className="ml-1 rounded-full bg-task/10 px-2 py-0.5 text-[10px] font-medium text-task">
              {doneTasks.length}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {showDone ? "点击收起" : "点击展开"}
          </span>
        </button>

        {showDone && (
          <div className="space-y-2 p-3">
            {doneTasks.length === 0 ? (
              <div className="flex h-20 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center">
                <span className="text-xs text-muted-foreground">暂无已完成任务</span>
              </div>
            ) : (
              doneTasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-background p-2.5 transition-all hover:border-task/30 hover:shadow-sm"
                  onClick={() => toggleDone(task)}
                >
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-task bg-task text-white">
                    <Check className="h-3 w-3" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs leading-relaxed line-through text-muted-foreground">
                      {task.content}
                    </span>
                    {task.updatedAt && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground/70">
                        完成于 {new Date(task.updatedAt).toLocaleString("zh-CN")}
                      </div>
                    )}
                  </div>
                  <RotateCcw
                    className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* 认知确认弹窗：任务完成时 AI 提取认知，用户确认后入库 */}
      {cognitionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-cognition" />
                <h2 className="text-sm font-semibold">AI 提取了认知，确认入库？</h2>
              </div>
              <button
                onClick={() => {
                  setCognitionModal(null);
                  setEditableCognitions([]);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 任务内容摘要 */}
            <div className="mb-3 rounded-lg border border-border bg-muted/30 p-2.5">
              <div className="text-[10px] text-muted-foreground">完成任务</div>
              <p className="mt-0.5 text-xs text-foreground line-clamp-2">
                {cognitionModal.taskContent}
              </p>
            </div>

            {/* 可编辑的认知列表 */}
            <div className="max-h-[50vh] space-y-3 overflow-y-auto">
              {editableCognitions.length === 0 ? (
                <p className="text-xs text-muted-foreground">无认知数据</p>
              ) : (
                editableCognitions.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border p-2.5">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          c.type === "method"
                            ? "bg-cognition/10 text-cognition"
                            : c.type === "experience"
                            ? "bg-task/10 text-task"
                            : "bg-campaign/10 text-campaign"
                        )}
                      >
                        {c.type === "method"
                          ? "方法论"
                          : c.type === "experience"
                          ? "经验"
                          : "提示词"}
                      </span>
                      <button
                        onClick={() =>
                          setEditableCognitions((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="ml-auto text-muted-foreground hover:text-graveyard"
                        title="删除此条"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <textarea
                      value={c.content}
                      onChange={(e) =>
                        setEditableCognitions((prev) =>
                          prev.map((item, idx) =>
                            idx === i ? { ...item, content: e.target.value } : item
                          )
                        )
                      }
                      rows={3}
                      className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none transition-colors focus:border-primary"
                    />
                  </div>
                ))
              )}
            </div>

            {/* 操作按钮 */}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => {
                setCognitionModal(null);
                setEditableCognitions([]);
              }}>
                查看任务
              </Button>
              <Button variant="outline" onClick={skipCognitions}>
                跳过
              </Button>
              <Button onClick={confirmSaveCognitions} disabled={savingCognitions}>
                {savingCognitions ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                确认入库
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

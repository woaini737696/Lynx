"use client";

import { useEffect, useState } from "react";
import { Check, Plus, RotateCcw, X, Target, Swords, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOARD_COLUMNS, type BoardColumn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { PageHeader, EmptyState, Card, Button, LoadingState } from "@/components/layout/PageHeader";

interface Task {
  id: string;
  content: string;
  column: BoardColumn;
  status: "active" | "done" | "dropped";
  position: number;
}

interface ColumnData {
  key: BoardColumn;
  tasks: Task[];
}

const COLUMN_ICONS = {
  northstar: Target,
  campaign: Swords,
  task: ListChecks,
};

export default function BoardPage() {
  const [columns, setColumns] = useState<ColumnData[]>(
    (Object.keys(BOARD_COLUMNS) as BoardColumn[]).map((key) => ({ key, tasks: [] }))
  );
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<BoardColumn | null>(null);
  const [newContent, setNewContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/tasks");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          const tasks: Task[] = data.tasks || [];
          setColumns(
            (Object.keys(BOARD_COLUMNS) as BoardColumn[]).map((key) => ({
              key,
              tasks: tasks
                .filter((t) => t.column === key)
                .sort((a, b) => a.position - b.position),
            }))
          );
        }
      } catch (e) {
        if (!mounted) return;
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
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
        setColumns((prev) =>
          prev.map((col) => ({
            ...col,
            tasks: col.tasks.map((t) =>
              t.id === task.id ? { ...t, status: newStatus } : t
            ),
          }))
        );
        toast(newStatus === "done" ? "任务已完成" : "任务已恢复", "success");
      }
    } catch {
      toast("网络错误", "error");
    }
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

  if (loading) return <LoadingState title="决策看板" />;

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="决策看板"
        subtitle="北极星 ≤3 · 战役 ≤5 · 任务 ≤10，满额阻断"
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
                      className={cn(
                        "group flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-background p-2.5 transition-all hover:border-primary/30 hover:shadow-sm",
                        task.status === "done" && "opacity-60"
                      )}
                      onClick={() => toggleDone(task)}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                          task.status === "done"
                            ? "border-task bg-task text-white"
                            : "border-border bg-transparent hover:border-primary"
                        )}
                      >
                        {task.status === "done" && <Check className="h-3 w-3" />}
                      </div>
                      <span
                        className={cn(
                          "flex-1 text-xs leading-relaxed",
                          task.status === "done" && "line-through text-muted-foreground"
                        )}
                      >
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
    </div>
  );
}

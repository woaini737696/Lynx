import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Target, Swords, ListChecks, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { HelpButton } from "@/components/ui/HelpButton";
import type { BoardTask } from "@/types/api";

type BoardColumn = "northstar" | "campaign" | "task";

interface ColumnData {
  key: BoardColumn;
  label: string;
  icon: React.ElementType;
  color: string;
}

const COLUMNS: ColumnData[] = [
  { key: "northstar", label: "北极星", icon: Target, color: "text-northstar border-northstar/30 bg-northstar/10" },
  { key: "campaign", label: "战役", icon: Swords, color: "text-campaign border-campaign/30 bg-campaign/10" },
  { key: "task", label: "任务", icon: ListChecks, color: "text-task border-task/30 bg-task/10" },
];

export function BoardPage() {
  const queryClient = useQueryClient();
  const [addingColumn, setAddingColumn] = useState<BoardColumn | null>(null);
  const [newContent, setNewContent] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery<BoardTask[]>({
    queryKey: ["board"],
    queryFn: async () => {
      const res = await cloudApi.get<{ tasks?: BoardTask[] }>("/api/tasks");
      return res.tasks || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return cloudApi.patch(`/api/tasks/${id}`, { status });
    },
    onMutate: ({ id }) => {
      setUpdatingId(id);
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
  });

  const handleAdd = (column: BoardColumn) => {
    if (!newContent.trim()) return;
    addMutation.mutate({ column, content: newContent.trim() });
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
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">决策看板</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            北极星 · 战役 · 任务，三层结构清晰决策
          </p>
        </div>
        <HelpButton module="board" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const columnTasks = tasks
            .filter((t) => t.column === column.key && t.status === "active")
            .sort((a, b) => a.position - b.position);
          const Icon = column.icon;

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
                <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
              </div>

              <div className="flex min-h-[180px] flex-col gap-2.5 rounded-2xl border border-border/40 bg-muted/20 p-3">
                {columnTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    className="glass-card group relative flex items-start gap-3 p-3.5"
                  >
                    <button
                      onClick={() =>
                        toggleMutation.mutate({
                          id: task.id,
                          status: task.status === "done" ? "active" : "done",
                        })
                      }
                      disabled={updatingId === task.id}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        task.status === "done"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30 hover:border-primary"
                      )}
                    >
                      {updatingId === task.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : task.status === "done" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : null}
                    </button>
                    <span
                      className={cn(
                        "flex-1 text-sm leading-relaxed",
                        task.status === "done" && "text-muted-foreground line-through"
                      )}
                    >
                      {task.content}
                    </span>
                  </motion.div>
                ))}

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
                    onClick={() => setAddingColumn(column.key)}
                    className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    添加{column.label}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

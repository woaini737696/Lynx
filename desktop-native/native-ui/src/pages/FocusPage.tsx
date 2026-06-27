import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Target, Sparkles, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { HelpButton } from "@/components/ui/HelpButton";
import type { FocusItem, DailyFocus } from "@/types/api";

const columnNames: Record<string, string> = {
  northstar: "北极星",
  campaign: "战役",
  task: "任务",
};

const columnColors: Record<string, string> = {
  northstar: "text-northstar border-northstar/30 bg-northstar/10",
  campaign: "text-campaign border-campaign/30 bg-campaign/10",
  task: "text-task border-task/30 bg-task/10",
};

export function FocusPage() {
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: focus, isLoading } = useQuery<DailyFocus | null>({
    queryKey: ["focus"],
    queryFn: async () => {
      const res = await cloudApi.get<{ dailyFocus?: DailyFocus }>("/api/focus");
      return res.dailyFocus || null;
    },
  });

  const items: FocusItem[] =
    focus?.items?.map((item: any) => ({
      id: item.id,
      taskId: item.taskId,
      title: item.task?.content || "",
      column: item.task?.column || "task",
      completed: item.completed,
    })) || [];

  const toggleMutation = useMutation({
    mutationFn: async ({
      itemId,
      completed,
    }: {
      itemId: string;
      completed: boolean;
    }) => {
      return cloudApi.patch("/api/focus", { itemId, completed });
    },
    onMutate: ({ itemId }) => {
      setUpdatingId(itemId);
    },
    onSettled: () => {
      setUpdatingId(null);
      queryClient.invalidateQueries({ queryKey: ["focus"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const completedCount = items.filter((i) => i.completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;
  const allDone = focus?.status === "completed";

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p>加载今日聚焦...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">今日聚焦</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {allDone ? "今日目标已完成" : `每天 3 张卡片 · 已完成 ${completedCount}/${items.length}`}
          </p>
        </div>
        <HelpButton module="focus" />
      </div>

      {items.length === 0 ? (
        <div className="ios-glass flex flex-col items-center justify-center py-20 text-center">
          <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-foreground">今日聚焦尚未生成</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            每天自动取前 3 个未完成任务，去决策看板添加任务吧
          </p>
        </div>
      ) : (
        <>
          <div className="glass-card mb-6 p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>完成进度</span>
              <span className="font-medium text-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {items.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={cn(
                  "glass-card flex flex-col justify-between p-5 transition-all",
                  item.completed && "opacity-70"
                )}
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        columnColors[item.column]
                      )}
                    >
                      {columnNames[item.column]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                  </div>
                  <h3
                    className={cn(
                      "text-base font-medium leading-snug sm:text-lg",
                      item.completed && "text-muted-foreground line-through"
                    )}
                  >
                    {item.title}
                  </h3>
                </div>
                <button
                  onClick={() => toggleMutation.mutate({ itemId: item.id, completed: !item.completed })}
                  disabled={updatingId === item.id}
                  className={cn(
                    "btn-primary-glass mt-5 flex w-full items-center justify-center gap-2 py-2.5 text-sm",
                    item.completed && "btn-glass"
                  )}
                >
                  {updatingId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : item.completed ? (
                    <>
                      <Clock className="h-4 w-4" /> 已恢复
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> 完成
                    </>
                  )}
                </button>
              </motion.div>
            ))}
          </div>

          {allDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 rounded-2xl border border-task/30 bg-task/10 p-6 text-center"
            >
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-task" />
              <h3 className="text-base font-semibold text-task">今日聚焦全部完成</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                今天的 3 张卡片都已完成，任务已自动标记为 done
              </p>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

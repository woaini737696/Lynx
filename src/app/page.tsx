"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Target, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOARD_COLUMNS, type BoardColumn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { PageHeader, Card, Badge, Button, LoadingState } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { HelpButton } from "@/components/layout/HelpButton";

interface FocusItem {
  id: string;
  taskId: string;
  title: string;
  column: BoardColumn;
  completed: boolean;
}

interface DailyFocus {
  id: string;
  date: string;
  status: string;
}

export default function FocusPage() {
  const [focus, setFocus] = useState<DailyFocus | null>(null);
  const [items, setItems] = useState<FocusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/focus");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          const focus = data.dailyFocus || null;
          setFocus(focus);
          setItems(
            (focus?.items || []).map((item: any) => ({
              id: item.id,
              taskId: item.taskId,
              title: item.task?.content || "",
              column: item.task?.column || "task",
              completed: item.completed,
            }))
          );
          setAllDone(focus?.status === "completed");
        }
      } catch {
        if (!mounted) return;
        toast("加载今日聚焦失败", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();

    // 监听决策看板的状态变更，自动刷新聚焦数据
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === "LYNNHUB_REFRESH_FOCUS") {
        load();
      }
    };
    window.addEventListener("message", handleMsg);
    return () => {
      mounted = false;
      window.removeEventListener("message", handleMsg);
    };
  }, []);

  const toggleComplete = async (item: FocusItem) => {
    const newCompleted = !item.completed;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completed: newCompleted } : i))
    );
    try {
      const res = await fetch("/api/focus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, completed: newCompleted }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.allDone) setAllDone(true);
        try {
          window.postMessage({ type: "LYNNHUB_REFRESH_BOARD" }, "*");
        } catch {}
        toast(
          data.allDone ? "今日聚焦全部完成！" : "聚焦卡片已更新",
          "success"
        );
      } else {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, completed: !newCompleted } : i))
        );
        toast("更新失败", "error");
      }
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, completed: !newCompleted } : i))
      );
      toast("网络错误", "error");
    }
  };

  const completedCount = items.filter((i) => i.completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  if (loading) return <LoadingState title="今日聚焦" />;

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="今日聚焦"
        subtitle={
          allDone
            ? "今日目标已完成"
            : `每天 3 张卡片 · 已完成 ${completedCount}/${items.length}`
        }
        action={
          <HelpButton content={{
            painPoint: "每天面对大量任务，不知道今天该先做什么，注意力被分散。",
            need: "需要一个每日聚焦机制，从所有任务中选出最重要的3个，集中精力完成。",
            solution: "今日聚焦每天自动从看板active任务中选3张卡片，完成一张即时同步看板状态，全部完成解锁成就。",
            usage: [
              "打开首页自动生成今日3张卡片",
              "点击卡片勾选完成",
              "全部完成后看板对应任务自动标记done",
              "看板完成任务也会同步到聚焦页"
            ]
          }} />
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Target}
          title="今日聚焦尚未生成"
          description="每天自动取前 3 个未完成任务，去决策看板添加任务吧"
        />
      ) : (
        <>
          <Card className="mb-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>完成进度</span>
              <span className="font-medium text-foreground">{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {items.map((item, idx) => {
              const column = BOARD_COLUMNS[item.column];
              return (
                <Card
                  key={item.id}
                  className={cn(
                    "relative flex flex-col justify-between transition-all",
                    item.completed && "opacity-70"
                  )}
                  hover
                >
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <Badge color={item.column}>{column.label}</Badge>
                      <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                    </div>
                    <h3
                      className={cn(
                        "text-base font-medium leading-snug sm:text-lg",
                        item.completed && "line-through text-muted-foreground"
                      )}
                    >
                      {item.title}
                    </h3>
                  </div>
                  <Button
                    onClick={() => toggleComplete(item)}
                    variant={item.completed ? "outline" : "primary"}
                    className="mt-5 w-full"
                  >
                    {item.completed ? (
                      <>
                        <Clock className="h-3.5 w-3.5" /> 已恢复
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" /> 完成
                      </>
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>

          {allDone && (
            <div className="mt-6 rounded-2xl border border-task/30 bg-task/10 p-6 text-center">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-task" />
              <h3 className="text-base font-semibold text-task">今日聚焦全部完成</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                今天的 3 张卡片都已完成，任务已自动标记为 done
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

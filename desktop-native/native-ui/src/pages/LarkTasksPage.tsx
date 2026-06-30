import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ListTodo,
  Search,
  RefreshCw,
  Loader2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, formatRelativeTime } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { HelpButton } from "@/components/ui/HelpButton";
import type { LarkTask } from "@/types/api";

// 状态映射：兼容后端返回的多种字段
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  todo: { label: "待办", color: "text-muted-foreground", bg: "bg-muted/40", border: "border-border/40" },
  pending: { label: "待办", color: "text-muted-foreground", bg: "bg-muted/40", border: "border-border/40" },
  in_progress: { label: "进行中", color: "text-campaign", bg: "bg-campaign/10", border: "border-campaign/30" },
  doing: { label: "进行中", color: "text-campaign", bg: "bg-campaign/10", border: "border-campaign/30" },
  done: { label: "已完成", color: "text-task", bg: "bg-task/10", border: "border-task/30" },
  completed: { label: "已完成", color: "text-task", bg: "bg-task/10", border: "border-task/30" },
  cancelled: { label: "已取消", color: "text-graveyard", bg: "bg-graveyard/10", border: "border-graveyard/30" },
  archived: { label: "已归档", color: "text-muted-foreground", bg: "bg-muted/40", border: "border-border/40" },
};

// 优先级映射
const PRIORITY_META: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "高", color: "text-graveyard", bg: "bg-graveyard/10" },
  urgent: { label: "紧急", color: "text-graveyard", bg: "bg-graveyard/10" },
  p0: { label: "P0", color: "text-graveyard", bg: "bg-graveyard/10" },
  p1: { label: "P1", color: "text-campaign", bg: "bg-campaign/10" },
  medium: { label: "中", color: "text-campaign", bg: "bg-campaign/10" },
  normal: { label: "普通", color: "text-muted-foreground", bg: "bg-muted/40" },
  low: { label: "低", color: "text-muted-foreground", bg: "bg-muted/40" },
  p2: { label: "P2", color: "text-muted-foreground", bg: "bg-muted/40" },
  p3: { label: "P3", color: "text-muted-foreground", bg: "bg-muted/40" },
};

const FILTER_TABS = [
  { key: "all", label: "全部" },
  { key: "todo", label: "待办" },
  { key: "in_progress", label: "进行中" },
  { key: "done", label: "已完成" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

// 归一化状态：将后端各种状态值映射到过滤使用的分类
function normalizeStatus(task: LarkTask): string {
  if (task.completed || task.isCompleted) return "done";
  const s = (task.status || "").toLowerCase();
  if (["done", "completed"].includes(s)) return "done";
  if (["in_progress", "doing", "processing"].includes(s)) return "in_progress";
  return "todo";
}

function getStatusMeta(status?: string, completed?: boolean, isCompleted?: boolean) {
  if (completed || isCompleted) return STATUS_META.done;
  if (!status) return STATUS_META.todo;
  return STATUS_META[status.toLowerCase()] || STATUS_META.todo;
}

function getPriorityMeta(priority?: string) {
  if (!priority) return null;
  return PRIORITY_META[priority.toLowerCase()] || null;
}

export function LarkTasksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterKey>("all");

  const { data: tasks = [], isLoading, isFetching, refetch, error } = useQuery<LarkTask[]>({
    queryKey: ["lark-tasks"],
    queryFn: async () => {
      const res = await cloudApi.get<unknown>("/api/lark-tasks?db_only=true&fast=true");
      // 防御性解析：API 可能返回数组、{tasks:[]}、{data:[]}、{items:[]} 等多种结构
      const obj = res as Record<string, unknown>;
      const arr = Array.isArray(res) ? res : (obj.tasks || obj.data || obj.items || obj.list || []);
      if (!Array.isArray(arr)) return [];
      // 字段归一化：后端返回 guid/summary/due/created/isCompleted，前端统一用 id/title/dueDate/createdAt/completed
      return (arr as Record<string, unknown>[]).map((t) => ({
        id: String(t.guid || t.id || t.taskGuid || ""),
        guid: String(t.guid || ""),
        title: String(t.summary || t.title || t.name || "(无标题)"),
        summary: String(t.summary || ""),
        description: String(t.description || ""),
        status: String(t.status || ""),
        priority: String(t.priority || ""),
        dueDate: String(t.due || t.dueDate || ""),
        due: String(t.due || ""),
        createdAt: String(t.created || t.createdAt || ""),
        created: String(t.created || ""),
        completed: Boolean(t.isCompleted || t.completed),
        isCompleted: Boolean(t.isCompleted),
        origin: String(t.origin || ""),
        tasklistGuid: String(t.tasklistGuid || t.containerGuid || ""),
      })) as LarkTask[];
    },
  });

  // 过滤 + 搜索
  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      const q = searchQuery.trim().toLowerCase();
      if (q && !task.title.toLowerCase().includes(q)) return false;
      if (filterStatus !== "all" && normalizeStatus(task) !== filterStatus) return false;
      return true;
    });
  }, [tasks, searchQuery, filterStatus]);

  // 计数
  const counts = useMemo(() => {
    const c = { all: tasks.length, todo: 0, in_progress: 0, done: 0 };
    tasks.forEach((t) => {
      const s = normalizeStatus(t);
      if (s === "todo") c.todo++;
      else if (s === "in_progress") c.in_progress++;
      else if (s === "done") c.done++;
    });
    return c;
  }, [tasks]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* 页头 */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <ListTodo className="h-6 w-6 text-primary" />
            飞书任务
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            同步飞书任务列表 · 共 {tasks.length} 条
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="刷新"
            className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
          >
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            刷新
          </button>
          <HelpButton module="lark-tasks" />
        </div>
      </div>

      {/* 同步状态提示 */}
      {tasks.length === 0 && (
        <div className="glass-card mb-4 flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span>飞书任务通过云端数据库同步。如无数据，请先在 Web 端或本地开发环境运行飞书任务同步。</span>
        </div>
      )}

      {/* 过滤 Tab + 搜索 */}
      <div className="glass-card mb-4 flex flex-wrap items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                filterStatus === tab.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.key === "all" ? (
                <span className="ml-1 opacity-60">{counts.all}</span>
              ) : (
                <span className="ml-1 opacity-60">{counts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索任务标题..."
            className="w-full rounded-lg border-0 bg-transparent py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">加载飞书任务...</p>
        </div>
      ) : error ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-graveyard/50" />
          <p className="mt-4 text-sm font-medium text-foreground">加载失败</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {(error as Error).message || "无法连接到飞书 CLI，请检查设置中的连接配置"}
          </p>
          <button
            onClick={() => refetch()}
            className="btn-primary-glass mt-4 flex h-8 items-center gap-1.5 px-3 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新加载
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <ListTodo className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium text-foreground">
            {tasks.length === 0 ? "暂无飞书任务" : "无匹配结果"}
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {tasks.length === 0
              ? "请检查设置中的飞书 CLI 连接，确保已正确配置 lark-cli 并完成授权"
              : "尝试更换关键词或切换状态过滤"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((task) => {
              const statusMeta = getStatusMeta(task.status, task.completed, task.isCompleted);
              const priorityMeta = getPriorityMeta(task.priority);
              const isOverdue =
                (task.dueDate || task.due) &&
                !task.completed &&
                !task.isCompleted &&
                new Date(task.dueDate || task.due!).getTime() < Date.now();
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="glass-card group p-4 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    {/* 完成状态图标 */}
                    <div className="mt-0.5 shrink-0">
                      {task.completed || task.isCompleted || normalizeStatus(task) === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-task" />
                      ) : normalizeStatus(task) === "in_progress" ? (
                        <Clock className="h-4 w-4 text-campaign" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
                      )}
                    </div>

                    {/* 主体 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={cn(
                            "text-sm font-medium leading-snug",
                            task.completed || task.isCompleted
                              ? "text-muted-foreground line-through"
                              : "text-foreground"
                          )}
                        >
                          {task.title}
                        </h3>
                      </div>

                      {task.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">
                          {task.description}
                        </p>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
                            statusMeta.bg,
                            statusMeta.color,
                            statusMeta.border
                          )}
                        >
                          {statusMeta.label}
                        </span>
                        {priorityMeta && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                              priorityMeta.bg,
                              priorityMeta.color
                            )}
                          >
                            <AlertCircle className="h-2.5 w-2.5" />
                            {priorityMeta.label}
                          </span>
                        )}
                        {(task.dueDate || task.due) && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              isOverdue && "text-graveyard"
                            )}
                            title={`截止：${new Date(task.dueDate || task.due!).toLocaleString("zh-CN")}`}
                          >
                            <Calendar className="h-2.5 w-2.5" />
                            {isOverdue ? "已逾期 · " : ""}
                            {formatRelativeTime((task.dueDate || task.due || "") as string)}
                          </span>
                        )}
                        {(task.createdAt || task.created) && (
                          <span className="inline-flex items-center gap-1 opacity-70">
                            <Clock className="h-2.5 w-2.5" />
                            {formatRelativeTime((task.createdAt || task.created || "") as string)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

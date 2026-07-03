import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ListTodo,
  Search,
  RefreshCw,
  Loader2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  CloudDownload,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, formatRelativeTime } from "@/lib/utils";
import { cloudApi, getCloudEndpoint } from "@/lib/cloud-api";
import { invoke } from "@/lib/tauri";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/toast";
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

// ===== 表单字段类型 =====
interface TaskFormData {
  summary: string;
  description: string;
  due: string; // datetime-local 格式
}

const EMPTY_FORM: TaskFormData = { summary: "", description: "", due: "" };

// 将 ISO 字符串转为 datetime-local 输入框可识别的格式（yyyy-MM-ddTHH:mm）
function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 将 datetime-local 输入值转为 ISO 字符串
function localInputToIso(val: string): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function LarkTasksPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterKey>("all");
  const [syncing, setSyncing] = useState(false);
  const [feishuStatus, setFeishuStatus] = useState<{ connected: boolean; name?: string } | null>(null);
  const [feishuLoading, setFeishuLoading] = useState(false);

  // ===== 创建/编辑模态框状态 =====
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<TaskFormData>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [editTarget, setEditTarget] = useState<LarkTask | null>(null);
  const [editForm, setEditForm] = useState<TaskFormData>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);

  // ===== 删除确认模态框状态 =====
  const [deleteTarget, setDeleteTarget] = useState<LarkTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ===== 操作中的任务 ID 集合（用于按钮 loading 状态） =====
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  // 标记某任务为操作中
  const markPending = useCallback((id: string) => {
    setPendingIds((prev) => new Set(prev).add(id));
  }, []);
  // 解除某任务的操作中状态
  const unmarkPending = useCallback((id: string) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // 飞书OAuth连接状态检查
  const fetchFeishuStatus = useCallback(async () => {
    try {
      const res = await cloudApi.get<{ connected: boolean; name?: string }>("/api/feishu/status");
      setFeishuStatus({ connected: res.connected, name: res.name });
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    fetchFeishuStatus();
  }, [fetchFeishuStatus]);

  // 连接飞书（在系统浏览器中打开OAuth授权页）
  const handleConnectFeishu = async () => {
    const base = getCloudEndpoint().replace(/\/+$/, "");
    const authUrl = `${base}/api/feishu/auth`;
    try {
      await invoke("open_external", { url: authUrl });
      toast.success("已在浏览器中打开飞书授权页面，完成后请返回刷新");
    } catch {
      toast.error("无法打开浏览器，请手动访问：" + authUrl);
    }
  };

  // 断开飞书连接
  const handleDisconnectFeishu = async () => {
    setFeishuLoading(true);
    try {
      await cloudApi.post("/api/feishu/disconnect");
      setFeishuStatus({ connected: false });
      toast.success("已断开飞书连接");
      queryClient.invalidateQueries({ queryKey: ["lark-tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "断开失败");
    } finally {
      setFeishuLoading(false);
    }
  };

  const { data: tasks = [], isLoading, isFetching, refetch, error } = useQuery<LarkTask[]>({
    queryKey: ["lark-tasks"],
    queryFn: async () => {
      // P0 修复：去掉 db_only=true，让服务端走 OAuth 路径实时拉取（已绑定飞书账号的用户）
      // 保留 fast=true，DB 有缓存时快速返回并后台刷新
      const res = await cloudApi.get<unknown>("/api/lark-tasks?fast=true");
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

  // 主动触发飞书任务同步（调用云端 /api/lark-tasks/sync，云端通过 OAuth 或 lark-cli 拉取后入库）
  const handleSyncLark = async () => {
    setSyncing(true);
    try {
      const res = await cloudApi.post<{ success?: boolean; error?: string; state?: { lastSyncAt?: string } }>("/api/lark-tasks/sync");
      if (res?.success) {
        toast.success("飞书任务同步完成");
        queryClient.invalidateQueries({ queryKey: ["lark-tasks"] });
      } else {
        toast.error(res?.error || "同步失败");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  // ===== 创建任务 =====
  const openCreate = () => {
    setCreateForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const summary = createForm.summary.trim();
    if (!summary) {
      toast.error("任务标题不能为空");
      return;
    }
    setCreating(true);
    try {
      const dueIso = localInputToIso(createForm.due);
      const res = await cloudApi.post<{ success?: boolean; error?: string; task?: unknown }>("/api/lark-tasks", {
        action: "create",
        summary,
        description: createForm.description.trim() || undefined,
        due: dueIso || undefined,
      });
      if (res?.success) {
        toast.success("任务创建成功");
        setCreateOpen(false);
        queryClient.invalidateQueries({ queryKey: ["lark-tasks"] });
      } else {
        toast.error(res?.error || "创建失败");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  // ===== 编辑任务 =====
  const openEdit = (task: LarkTask) => {
    setEditTarget(task);
    setEditForm({
      summary: task.summary || task.title || "",
      description: task.description || "",
      due: isoToLocalInput(task.dueDate || task.due || ""),
    });
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const summary = editForm.summary.trim();
    if (!summary) {
      toast.error("任务标题不能为空");
      return;
    }
    setEditing(true);
    try {
      const dueIso = localInputToIso(editForm.due);
      const res = await cloudApi.patch<{ success?: boolean; error?: string }>(`/api/lark-tasks/${editTarget.id}`, {
        action: "update",
        summary,
        description: editForm.description.trim() || undefined,
        due: dueIso || undefined,
      });
      if (res?.success) {
        toast.success("任务已更新");
        setEditTarget(null);
        queryClient.invalidateQueries({ queryKey: ["lark-tasks"] });
      } else {
        toast.error(res?.error || "更新失败");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败");
    } finally {
      setEditing(false);
    }
  };

  // ===== 完成 / 重开任务 =====
  const handleToggleComplete = async (task: LarkTask) => {
    const isDone = task.completed || task.isCompleted || normalizeStatus(task) === "done";
    markPending(task.id);
    try {
      const res = await cloudApi.patch<{ success?: boolean; error?: string }>(`/api/lark-tasks/${task.id}`, {
        action: isDone ? "reopen" : "complete",
      });
      if (res?.success) {
        toast.success(isDone ? "任务已重开" : "任务已完成");
        queryClient.invalidateQueries({ queryKey: ["lark-tasks"] });
      } else {
        toast.error(res?.error || "操作失败");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      unmarkPending(task.id);
    }
  };

  // ===== 删除任务 =====
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await cloudApi.delete<{ success?: boolean; error?: string }>(`/api/lark-tasks/${deleteTarget.id}`);
      if (res?.success) {
        toast.success("任务已删除");
        setDeleteTarget(null);
        queryClient.invalidateQueries({ queryKey: ["lark-tasks"] });
      } else {
        toast.error(res?.error || "删除失败");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  };

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
          {feishuStatus?.connected ? (
            <button
              onClick={handleDisconnectFeishu}
              disabled={feishuLoading}
              title={`已连接: ${feishuStatus.name || "飞书账号"}（点击断开）`}
              className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs text-green-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="max-w-[80px] truncate">{feishuStatus.name || "已连接"}</span>
              {feishuLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </button>
          ) : (
            <button
              onClick={handleConnectFeishu}
              title="连接你的飞书账号，同步个人任务"
              className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs text-cognition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              连接飞书
            </button>
          )}
          {/* 新建任务按钮：调用 OAuth 路径创建 */}
          <button
            onClick={openCreate}
            title="新建飞书任务"
            className="btn-primary-glass flex h-8 items-center gap-1.5 px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            新建任务
          </button>
          <button
            onClick={handleSyncLark}
            disabled={syncing}
            title="从飞书同步任务"
            className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CloudDownload className="h-3.5 w-3.5" />
            )}
            同步飞书
          </button>
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
          <span>
            {feishuStatus?.connected
              ? "已连接飞书账号，正在同步任务。如无数据，请点击「同步飞书」主动拉取。"
              : "未连接飞书账号。请点击右上角「连接飞书」绑定自己的飞书账号以同步任务。"}
          </span>
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
            {(error as Error).message || "无法连接到飞书，请检查是否已连接飞书账号"}
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
              ? "请点击右上角「连接飞书」绑定账号，或点击「新建任务」创建第一个任务"
              : "尝试更换关键词或切换状态过滤"}
          </p>
          {tasks.length === 0 && (
            <button
              onClick={openCreate}
              className="btn-primary-glass mt-4 flex h-8 items-center gap-1.5 px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              新建任务
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((task) => {
              const statusMeta = getStatusMeta(task.status, task.completed, task.isCompleted);
              const priorityMeta = getPriorityMeta(task.priority);
              const isDone = task.completed || task.isCompleted || normalizeStatus(task) === "done";
              const isOverdue =
                (task.dueDate || task.due) &&
                !isDone &&
                new Date(task.dueDate || task.due!).getTime() < Date.now();
              const isPending = pendingIds.has(task.id);
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
                    {/* 完成/重开按钮（左侧圆形按钮，可点击切换状态） */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleComplete(task);
                      }}
                      disabled={isPending}
                      title={isDone ? "重开任务" : "标记完成"}
                      className="mt-0.5 shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-task" />
                      ) : normalizeStatus(task) === "in_progress" ? (
                        <Clock className="h-4 w-4 text-campaign" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 hover:border-primary" />
                      )}
                    </button>

                    {/* 主体（点击进入编辑） */}
                    <button
                      onClick={() => openEdit(task)}
                      className="min-w-0 flex-1 text-left"
                      title="点击编辑任务"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={cn(
                            "text-sm font-medium leading-snug",
                            isDone ? "text-muted-foreground line-through" : "text-foreground"
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
                    </button>

                    {/* 右侧操作按钮组：编辑 + 删除 */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(task);
                        }}
                        disabled={isPending}
                        title="编辑任务"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(task);
                        }}
                        disabled={isPending}
                        title="删除任务"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-graveyard/10 hover:text-graveyard disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ===== 创建任务模态框 ===== */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建飞书任务" size="md">
        <div className="space-y-4">
          {/* 任务标题 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              任务标题 <span className="text-graveyard">*</span>
            </label>
            <input
              autoFocus
              value={createForm.summary}
              onChange={(e) => setCreateForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="请输入任务标题"
              className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* 任务描述 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">任务描述</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="可选：补充任务详情"
              rows={3}
              className="w-full resize-none rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* 截止时间 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">截止时间</label>
            <input
              type="datetime-local"
              value={createForm.due}
              onChange={(e) => setCreateForm((f) => ({ ...f, due: e.target.value }))}
              className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCreateOpen(false)}
              disabled={creating}
              className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !createForm.summary.trim()}
              className="btn-primary-glass flex h-8 items-center gap-1.5 px-3 text-xs disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              创建
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== 编辑任务模态框 ===== */}
      <Modal open={!!editTarget} onClose={() => !editing && setEditTarget(null)} title="编辑飞书任务" size="md">
        <div className="space-y-4">
          {/* 任务标题 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">
              任务标题 <span className="text-graveyard">*</span>
            </label>
            <input
              autoFocus
              value={editForm.summary}
              onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="请输入任务标题"
              className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* 任务描述 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">任务描述</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="可选：补充任务详情"
              rows={3}
              className="w-full resize-none rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* 截止时间 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">截止时间</label>
            <input
              type="datetime-local"
              value={editForm.due}
              onChange={(e) => setEditForm((f) => ({ ...f, due: e.target.value }))}
              className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditTarget(null)}
              disabled={editing}
              className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
            >
              取消
            </button>
            <button
              onClick={handleEdit}
              disabled={editing || !editForm.summary.trim()}
              className="btn-primary-glass flex h-8 items-center gap-1.5 px-3 text-xs disabled:opacity-50"
            >
              {editing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              保存
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== 删除确认模态框 ===== */}
      <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="确认删除任务" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-graveyard/10">
              <Trash2 className="h-5 w-5 text-graveyard" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">确定要删除这个任务吗？</p>
              <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
                「{deleteTarget?.title || deleteTarget?.summary}」
              </p>
              <p className="mt-2 text-xs text-graveyard/80">此操作不可撤销，任务将从飞书永久删除。</p>
            </div>
          </div>
          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-graveyard px-3 text-xs font-medium text-white transition-colors hover:bg-graveyard/90 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              确认删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

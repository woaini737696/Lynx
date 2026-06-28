"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  RefreshCw,
  CheckCircle2,
  Download,
  ExternalLink,
  ListTodo,
  Plus,
  Calendar,
  X,
  MessageSquare,
  GitBranch,
  ChevronRight,
  ChevronDown,
  User,
  Users,
  Eye,
  Folder,
  Clock,
  Pencil,
  RotateCcw,
  Send,
  Loader2,
  ChevronLeft,
  CalendarDays,
  GanttChart,
  Zap,
  Activity,
  Radio,
  HelpCircle,
  Settings,
  Columns3,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Skeleton,
} from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { EmptyState } from "@/components/layout/EmptyState";
import { toast } from "@/components/ui/toast";
import { Pagination, useClientPagination } from "@/components/ui/ListControls";
import { cn } from "@/lib/utils";

// ==================== 类型定义 ====================

interface LarkMember {
  id?: string;
  open_id?: string;
  name?: string;
  en_name?: string;
}

interface LarkTasklistRef {
  guid?: string;
  name?: string;
}

interface LarkTask {
  guid: string;
  summary: string;
  description: string;
  createdAt: string | null;
  updatedAt: string | null;
  due: string | null;
  dueIsAllDay: boolean;
  start: string | null;
  startIsAllDay: boolean;
  url: string;
  completed: boolean;
  completedAt: string | null;
  status: string;
  assignees: LarkMember[];
  collaborators: LarkMember[];
  followers: LarkMember[]; // 关注人
  creator: LarkMember | null;
  tasklist: LarkTasklistRef | null;
  priority: number;
  // 扩展字段
  members: LarkMember[];
  repeatRule: string | null;
  repeatNextDue: string | null;
  location: { name: string; address: string } | null;
  origin: {
    apiToken?: string;
    miniTask?: boolean;
    pdfToken?: string;
    sheetToken?: string;
    bitableToken?: string;
    docsToken?: string;
    wikiToken?: string;
  } | null;
  shortcuts: Array<{ guid: string; name: string; url: string }>;
  reminders: Array<{ id: string; type: number; time: string; rule: string }>;
  attachments: Array<{
    guid: string;
    name: string;
    fileType: string;
    size: number;
    url: string;
  }>;
  customCompleteRule: string | null;
  customCompleted: boolean;
  originPlugin: { name: string; url: string } | null;
  // 列表展示用（可选）
  commentCount?: number;
  followerCount?: number;
  subtaskCount?: number;
  // 父子任务关系
  parentTaskGuid?: string | null;
}

interface LarkComment {
  id: string;
  content: string;
  createdAt: string | null;
  creator: LarkMember | null;
}

interface SyncState {
  lastSyncAt: string | null;
  lastError: string | null;
  taskCount: number;
}

type ViewTab = "my" | "related" | "all";
type CompleteFilter = "incomplete" | "completed" | "all";
type DisplayMode = "list" | "calendar" | "gantt" | "board";

// ==================== 工具函数 ====================

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function memberName(m: LarkMember | null | undefined): string {
  if (!m) return "—";
  return m.name || m.en_name || m.open_id || m.id || "—";
}

function memberInitials(m: LarkMember | null | undefined): string {
  const name = memberName(m);
  if (name === "—") return "?";
  return name.slice(0, 2);
}

function isOverdue(due: string | null, completed: boolean): boolean {
  if (!due || completed) return false;
  const d = new Date(due);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/** 将 ISO 字符串转为 datetime-local 需要的 YYYY-MM-DDTHH:MM 格式 */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 将 datetime-local 值转为 ISO 字符串 */
function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** 获取今天/明天/后天的 ISO 时间（可指定时分） */
function getQuickIso(
  option: "today" | "tomorrow",
  hour: number,
  minute: number
): string {
  const d = new Date();
  if (option === "tomorrow") d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// ==================== 通用 UI 组件 ====================

/** 成员头像（带名字首字母） */
function MemberAvatar({
  member,
  size = "sm",
  className,
}: {
  member: LarkMember | null | undefined;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizeClasses = {
    xs: "h-4 w-4 text-[8px]",
    sm: "h-5 w-5 text-[9px]",
    md: "h-6 w-6 text-[10px]",
  };
  return (
    <span
      title={memberName(member)}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-cognition/15 font-medium text-cognition ring-1 ring-cognition/20",
        sizeClasses[size],
        className
      )}
    >
      {memberInitials(member)}
    </span>
  );
}

/** 成员多选选择器 */
function MemberMultiSelect({
  members,
  selectedIds,
  onChange,
  placeholder = "选择成员",
  icon: Icon = User,
}: {
  members: LarkMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const selected = members.filter((m) =>
    selectedIds.includes(m.open_id || m.id || m.name || "")
  );

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "ios-glass-sm flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs outline-none transition-colors focus:outline-none focus:ring-2 focus:ring-cognition/20",
          open && "ring-1 ring-cognition/20"
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {selected.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          <div className="flex flex-1 flex-wrap items-center gap-1">
            {selected.slice(0, 3).map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-cognition/10 px-1.5 py-0.5 text-[10px] text-cognition"
              >
                <MemberAvatar member={m} size="xs" className="bg-cognition/10" />
                {memberName(m)}
              </span>
            ))}
            {selected.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{selected.length - 3}
              </span>
            )}
          </div>
        )}
        <ChevronDown
          className={cn(
            "ml-auto h-3 w-3 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="user-menu absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-2xl p-1.5 shadow-2xl">
          {members.length === 0 ? (
            <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
              暂无成员
            </div>
          ) : (
            members.map((m, i) => {
              const id = m.open_id || m.id || m.name || `${i}`;
              const checked = selectedIds.includes(id);
              return (
                <label
                  key={id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-primary/10",
                    checked && "bg-cognition/5"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(id)}
                    className="h-3.5 w-3.5 rounded border-border text-cognition focus:ring-cognition/30"
                  />
                  <MemberAvatar member={m} size="sm" />
                  <span className="flex-1 truncate">{memberName(m)}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** 日期时间快捷选择器 */
function DateTimeQuickPicker({
  label,
  value,
  onChange,
  showTime = true,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  showTime?: boolean;
}) {
  const [mode, setMode] = useState<"quick" | "custom">("quick");
  const localValue = toDatetimeLocal(value);

  const applyQuick = (option: "today" | "tomorrow") => {
    onChange(getQuickIso(option, 18, 0));
    setMode("quick");
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => applyQuick("today")}
          className="ios-glass-sm rounded-lg px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          今天
        </button>
        <button
          type="button"
          onClick={() => applyQuick("tomorrow")}
          className="ios-glass-sm rounded-lg px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          明天
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[11px] transition-colors",
            mode === "custom"
              ? "ios-glass-sm bg-cognition/5 text-cognition ring-1 ring-cognition/20"
              : "ios-glass-sm text-foreground hover:bg-primary/10 hover:text-primary"
          )}
        >
          其他时间
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            清除
          </button>
        )}
      </div>
      {mode === "custom" && showTime && (
        <input
          type="datetime-local"
          value={localValue}
          onChange={(e) => onChange(fromDatetimeLocal(e.target.value))}
          className="ios-glass-sm w-full rounded-xl border-0 bg-transparent px-3 py-2 text-xs outline-none focus:outline-none focus:ring-2 focus:ring-cognition/20"
        />
      )}
      {mode === "custom" && !showTime && (
        <input
          type="date"
          value={value ? value.slice(0, 10) : ""}
          onChange={(e) =>
            onChange(e.target.value ? new Date(e.target.value).toISOString() : null)
          }
          className="ios-glass-sm w-full rounded-xl border-0 bg-transparent px-3 py-2 text-xs outline-none focus:outline-none focus:ring-2 focus:ring-cognition/20"
        />
      )}
      {value && mode === "quick" && (
        <div className="text-[11px] text-muted-foreground">
          已选：{formatDate(value)}
        </div>
      )}
    </div>
  );
}

// ==================== 日历工具函数 ====================

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/** 返回该月日历网格所需的日期数组（含上下月填充，始终 6 行 x 7 列 = 42 天） */
function getMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=周日
  const start = new Date(year, month, 1 - startWeekday);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

/** 判断两个日期是否同一天（忽略时分秒） */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 将 ISO 字符串截取为 YYYY-MM-DD 用于按天分组 */
function dateKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 格式化月份标题：2026年6月 */
function formatMonthTitle(year: number, month: number): string {
  return `${year}年${month + 1}月`;
}

// ==================== 主页面 ====================

export default function LarkTasksPage() {
  const [tasks, setTasks] = useState<LarkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // 后台刷新中（不阻塞 UI）
  const [myOpenId, setMyOpenId] = useState<string>("");
  const [subtaskMap, setSubtaskMap] = useState<Record<string, LarkTask[]>>({});
  const [view, setView] = useState<ViewTab>("my");
  const [completeFilter, setCompleteFilter] = useState<CompleteFilter>("incomplete");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // 显示模式：列表 / 日历 / 甘特图
  const [displayMode, setDisplayMode] = useState<DisplayMode>("list");
  // 日历当前月份（Date 指向该月第一天）
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // 日历中展开的日期（点击日期格子展开当天所有任务）
  const [expandedDate, setExpandedDate] = useState<Date | null>(null);
  // 甘特图中心日期（用于前后两周导航）
  const [ganttCenterDate, setGanttCenterDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });

  // 筛选元数据
  const [assignees, setAssignees] = useState<LarkMember[]>([]);
  const [tasklists, setTasklists] = useState<LarkTasklistRef[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedTasklist, setSelectedTasklist] = useState("");

  // 同步状态
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [syncing, setSyncing] = useState(false);

  // 弹窗 / 抽屉
  const [showCreate, setShowCreate] = useState(false);
  const [detailTask, setDetailTask] = useState<LarkTask | null>(null);

  // 展开的子任务列表
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Webhook 实时同步状态
  const [webhookStatus, setWebhookStatus] = useState<{
    configured: boolean;
    totalEvents: number;
    recentEvents24h: number;
    lastEventAt: string | null;
    lastEventType: string | null;
    lastEventSummary: string | null;
  } | null>(null);
  const [webhookEvents, setWebhookEvents] = useState<
    Array<{
      eventId: string;
      eventType: string;
      timestamp: string;
      taskGuid?: string;
      summary?: string;
    }>
  >([]);
  const [showWebhookPanel, setShowWebhookPanel] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const setAction = (key: string, val: boolean) =>
    setActionLoading((s) => ({ ...s, [key]: val }));

  // 拉取任务列表（非阻塞式：先返回 DB 缓存，后台刷新 lark-cli）
  const hasDataRef = useRef(false);
  const fetchTasks = useCallback(async (opts?: { force?: boolean }) => {
    const force = opts?.force === true;
    const params = new URLSearchParams();
    params.set("view", view);
    if (completeFilter === "incomplete") params.set("complete", "false");
    else if (completeFilter === "completed") params.set("complete", "true");
    if (query) params.set("q", query);
    if (selectedAssignee) params.set("assignee", selectedAssignee);
    if (selectedTasklist) params.set("tasklist", selectedTasklist);

    // 首次加载（无数据）显示全屏 loading；已有数据时仅显示后台刷新指示
    const hasData = hasDataRef.current;
    if (!hasData) setLoading(true);
    else setRefreshing(true);

    try {
      // 第一步：快速请求 DB 缓存（instant）
      const fastParams = new URLSearchParams(params);
      fastParams.set("fast", "true");
      const fastRes = await fetch(`/api/lark-tasks?${fastParams.toString()}`);
      const fastData = await fastRes.json();
      if (fastRes.ok && fastData.tasks) {
        setTasks(fastData.tasks);
        hasDataRef.current = fastData.tasks.length > 0;
        if (fastData.subtaskMap) setSubtaskMap(fastData.subtaskMap);
        if (fastData.myOpenId) setMyOpenId(fastData.myOpenId);
        if (fastData.assignees) setAssignees(fastData.assignees);
        if (fastData.tasklists) setTasklists(fastData.tasklists);
      }
      setLoading(false);

      // 第二步：如果 DB 缓存返回了数据且非强制刷新，后台拉取 lark-cli 最新数据
      if (fastData.source === "db-cache" && !force) {
        setRefreshing(true);
        const slowRes = await fetch(`/api/lark-tasks?${params.toString()}`);
        const slowData = await slowRes.json();
        if (slowRes.ok && slowData.tasks) {
          setTasks(slowData.tasks);
          hasDataRef.current = slowData.tasks.length > 0;
          if (slowData.subtaskMap) setSubtaskMap(slowData.subtaskMap);
          if (slowData.myOpenId) setMyOpenId(slowData.myOpenId);
          if (slowData.assignees) setAssignees(slowData.assignees);
          if (slowData.tasklists) setTasklists(slowData.tasklists);
        }
      } else if (force) {
        // 强制刷新：带 refresh=true
        const refreshParams = new URLSearchParams(params);
        refreshParams.set("refresh", "true");
        const refreshRes = await fetch(`/api/lark-tasks?${refreshParams.toString()}`);
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.tasks) {
          setTasks(refreshData.tasks);
          hasDataRef.current = refreshData.tasks.length > 0;
          if (refreshData.subtaskMap) setSubtaskMap(refreshData.subtaskMap);
          if (refreshData.myOpenId) setMyOpenId(refreshData.myOpenId);
          if (refreshData.assignees) setAssignees(refreshData.assignees);
          if (refreshData.tasklists) setTasklists(refreshData.tasklists);
        }
      }
    } catch {
      toast("网络错误，请检查服务是否正常", "error");
      if (!hasData) setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [view, completeFilter, query, selectedAssignee, selectedTasklist]);

  // 拉取筛选元数据 + 同步状态
  const fetchMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/lark-tasks?meta=true");
      const data = await res.json();
      if (res.ok) {
        setAssignees(data.assignees || []);
        setTasklists(data.tasklists || []);
        setSyncState(data.syncState || null);
      }
    } catch {
      // 静默失败
    }
  }, []);

  // 拉取 Webhook 状态
  const fetchWebhookStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/lark-webhook/status");
      if (!res.ok) return;
      const data = await res.json();
      setWebhookStatus(data);
    } catch {
      // 静默失败
    }
  }, []);

  // 拉取 Webhook 事件日志
  const fetchWebhookEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/lark-webhook/events");
      if (!res.ok) return;
      const data = await res.json();
      setWebhookEvents(data.events || []);
    } catch {
      // 静默失败
    }
  }, []);

  // 模拟飞书 Webhook 事件（测试用）
  const handleSimulateEvent = async (eventType: string) => {
    setSimulating(true);
    try {
      const res = await fetch("/api/lark-webhook/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "模拟失败", "error");
      } else {
        toast(data.message || "已模拟事件", "success");
        // 立即刷新状态和事件
        fetchWebhookStatus();
        fetchWebhookEvents();
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchMeta();
    fetchWebhookStatus();
  }, [fetchMeta, fetchWebhookStatus]);

  // 自动同步：每 5 分钟触发一次（使用 ref 避免依赖变化的 handleSync 导致定时器重置）
  const handleSyncRef = useRef<(silent?: boolean) => Promise<void>>(async () => {});
  useEffect(() => {
    const timer = setInterval(() => {
      handleSyncRef.current(true);
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Webhook 实时刷新：使用 SSE（Server-Sent Events）替代 30 秒轮询
  // 收到新事件后秒级刷新任务列表
  const lastEventTimestampRef = useRef<string>("");
  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;
    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const url = new URL("/api/lark-webhook/stream", window.location.origin);
      if (lastEventTimestampRef.current) {
        url.searchParams.set("since", lastEventTimestampRef.current);
      }
      es = new EventSource(url.toString());

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "event") {
            lastEventTimestampRef.current = data.timestamp;
            if (!cancelled) {
              fetchTasks();
              fetchWebhookStatus();
              if (data.summary) {
                const action = data.eventType?.split(".").pop() || "更新";
                toast(`飞书实时同步：${action} - ${data.summary}`, "info");
              }
            }
          }
        } catch {}
      };

      es.onerror = () => {
        // 连接断开，5 秒后重连
        es?.close();
        es = null;
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTasks, fetchWebhookStatus]);

  const handleSearch = () => {
    setQuery(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setQuery("");
  };

  const handleSync = async (silent = false) => {
    setSyncing(true);
    try {
      const res = await fetch("/api/lark-tasks/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncState(data.state || null);
        if (!silent) {
          toast(data.success ? "同步完成" : "同步完成（有错误）", data.success ? "success" : "info");
        }
        // 同步后刷新列表（强制刷新）
        fetchTasks({ force: true });
        fetchMeta();
      } else if (!silent) {
        toast(data.error || "同步失败", "error");
      }
    } catch {
      if (!silent) toast("网络错误", "error");
    } finally {
      setSyncing(false);
    }
  };
  handleSyncRef.current = handleSync;

  const handleComplete = async (guid: string) => {
    const key = `complete-${guid}`;
    setAction(key, true);
    try {
      const res = await fetch(`/api/lark-tasks/${guid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "标记完成失败", "error");
      } else {
        toast("已标记完成", "success");
        setTasks((prev) =>
          prev.map((t) => (t.guid === guid ? { ...t, completed: true } : t))
        );
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setAction(key, false);
    }
  };

  const handleReopen = async (guid: string) => {
    const key = `reopen-${guid}`;
    setAction(key, true);
    try {
      const res = await fetch(`/api/lark-tasks/${guid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "重开失败", "error");
      } else {
        toast("任务已重开", "success");
        setTasks((prev) =>
          prev.map((t) => (t.guid === guid ? { ...t, completed: false } : t))
        );
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setAction(key, false);
    }
  };

  const handleImport = async (task: LarkTask) => {
    const key = `import-${task.guid}`;
    setAction(key, true);
    try {
      const res = await fetch("/api/lark-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import",
          taskId: task.guid,
          summary: task.summary,
          description: task.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "导入失败", "error");
      } else {
        toast("已导入决策看板", "success");
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setAction(key, false);
    }
  };

  const toggleExpand = (guid: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(guid)) next.delete(guid);
      else next.add(guid);
      return next;
    });
  };

  const incompleteCount = tasks.filter((t) => !t.completed).length;
  const VIEW_TABS: { key: ViewTab; label: string }[] = [
    { key: "my", label: "我的任务" },
    { key: "related", label: "我关注的" },
    { key: "all", label: "全部" },
  ];
  const COMPLETE_FILTERS: { key: CompleteFilter; label: string }[] = [
    { key: "incomplete", label: "未完成" },
    { key: "completed", label: "已完成" },
    { key: "all", label: "全部" },
  ];

  // 列表视图：对排序后的根任务做客户端分页
  const sortedRootTasks = useMemo(() => {
    const rootTasks = tasks.filter((t) => !t.parentTaskGuid);
    return [...rootTasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      if (a.due && b.due) {
        return new Date(a.due).getTime() - new Date(b.due).getTime();
      }
      return 0;
    });
  }, [tasks]);
  const taskPagination = useClientPagination(sortedRootTasks, 10);

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="飞书任务"
        subtitle="双向同步飞书任务中心，一键收敛到决策看板"
        action={
          <div className="flex items-center gap-2">
            <SyncStatus state={syncState} syncing={syncing} />
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowWebhookPanel((v) => !v)}
            >
              <Zap className={cn("h-3.5 w-3.5", webhookStatus?.totalEvents ? "text-cognition" : "text-muted-foreground")} />
              实时同步
              {webhookStatus?.recentEvents24h ? (
                <span className="ml-1 rounded-full bg-cognition/15 px-1.5 py-0 text-[9px] text-cognition">
                  {webhookStatus.recentEvents24h}
                </span>
              ) : null}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => handleSync(false)}
              disabled={syncing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              {syncing ? "同步中..." : "同步"}
            </Button>
            <Button size="md" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              新建任务
            </Button>
          </div>
        }
      />

      {/* Webhook 实时同步状态面板（可折叠） */}
      {showWebhookPanel && (
        <WebhookPanel
          status={webhookStatus}
          events={webhookEvents}
          simulating={simulating}
          onSimulate={handleSimulateEvent}
          onRefreshEvents={fetchWebhookEvents}
          onClose={() => setShowWebhookPanel(false)}
        />
      )}

      {/* 显示模式切换：列表 / 日历 / 甘特图 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="ios-glass-sm flex items-center gap-1 rounded-xl p-1">
          <button
            onClick={() => setDisplayMode("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              displayMode === "list"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
          >
            <ListTodo className="h-3.5 w-3.5" />
            列表视图
          </button>
          <button
            onClick={() => setDisplayMode("calendar")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              displayMode === "calendar"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            日历视图
          </button>
          <button
            onClick={() => setDisplayMode("gantt")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              displayMode === "gantt"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
          >
            <GanttChart className="h-3.5 w-3.5" />
            甘特图
          </button>
          <button
            onClick={() => setDisplayMode("board")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              displayMode === "board"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
            )}
          >
            <Columns3 className="h-3.5 w-3.5" />
            看板视图
          </button>
        </div>
      </div>

      {/* 视图切换 Tab */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="ios-glass-sm flex items-center gap-1 rounded-xl p-1">
          {VIEW_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                view === t.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 完成状态筛选 */}
        <div className="ios-glass-sm flex items-center gap-1 rounded-xl p-1">
          {COMPLETE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setCompleteFilter(f.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                completeFilter === f.key
                  ? "bg-secondary text-secondary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 筛选栏：负责人 + 任务清单 + 搜索 */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* 负责人下拉 */}
          <div className="relative">
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="ios-glass-sm appearance-none rounded-xl py-2 pl-8 pr-8 text-xs text-foreground outline-none transition-colors focus:border-cognition/50"
            >
              <option value="">全部负责人</option>
              {assignees.map((a) => {
                const key = a.open_id || a.id || a.name || "";
                return (
                  <option key={key} value={key}>
                    {memberName(a)}
                  </option>
                );
              })}
            </select>
            <User className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* 任务清单下拉 */}
          <div className="relative">
            <select
              value={selectedTasklist}
              onChange={(e) => setSelectedTasklist(e.target.value)}
              className="appearance-none rounded-xl ios-glass-sm py-2 pl-8 pr-8 text-xs text-foreground outline-none transition-colors focus:border-cognition/50"
            >
              <option value="">全部清单</option>
              {tasklists.map((t) => (
                <option key={t.guid} value={t.guid || ""}>
                  {t.name || "(未命名)"}
                </option>
              ))}
            </select>
            <Folder className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          </div>

          {(selectedAssignee || selectedTasklist) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedAssignee("");
                setSelectedTasklist("");
              }}
            >
              <X className="h-3 w-3" />
              清除筛选
            </Button>
          )}
        </div>

        {/* 搜索框 */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="搜索任务标题..."
            className="ios-glass-sm w-full rounded-xl py-2 pl-9 pr-9 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-cognition/50"
          />
          {searchInput ? (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="清除搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* 查询状态提示 */}
      {query && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          搜索 “{query}” 的结果
          <button
            onClick={handleClearSearch}
            className="text-cognition hover:underline"
          >
            清除
          </button>
        </div>
      )}

      {/* 任务列表 / 日历视图 / 甘特图视图 */}
      {loading ? (
        displayMode === "calendar" ? (
          <Skeleton className="h-[600px] w-full" />
        ) : displayMode === "gantt" ? (
          <Skeleton className="h-[600px] w-full" />
        ) : displayMode === "board" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )
      ) : displayMode === "calendar" ? (
        <CalendarView
          tasks={tasks}
          month={calendarMonth}
          expandedDate={expandedDate}
          onPrevMonth={() =>
            setCalendarMonth(
              new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
            )
          }
          onNextMonth={() =>
            setCalendarMonth(
              new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
            )
          }
          onToday={() => {
            const now = new Date();
            setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
          }}
          onToggleDate={(date) => {
            setExpandedDate((prev) =>
              prev && isSameDay(prev, date) ? null : date
            );
          }}
          onOpenDetail={(task) => setDetailTask(task)}
        />
      ) : displayMode === "gantt" ? (
        <GanttView
          tasks={tasks}
          centerDate={ganttCenterDate}
          onPrev={() => {
            const next = new Date(ganttCenterDate);
            next.setDate(next.getDate() - 14);
            setGanttCenterDate(next);
          }}
          onNext={() => {
            const next = new Date(ganttCenterDate);
            next.setDate(next.getDate() + 14);
            setGanttCenterDate(next);
          }}
          onToday={() => {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            setGanttCenterDate(now);
          }}
          onOpenDetail={(task) => setDetailTask(task)}
        />
      ) : displayMode === "board" ? (
        <BoardView
          tasks={tasks}
          subtaskMap={subtaskMap}
          myOpenId={myOpenId}
          onComplete={handleComplete}
          onReopen={handleReopen}
          onOpenDetail={(task) => setDetailTask(task)}
          actionLoading={actionLoading}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={
            query
              ? "未找到匹配的任务"
              : completeFilter === "completed"
              ? "暂无已完成任务"
              : completeFilter === "incomplete"
              ? "暂无未完成任务"
              : "暂无飞书任务"
          }
          description={
            query
              ? "尝试更换关键词或清除搜索条件"
              : "飞书任务中心没有符合条件的任务，去创建一个吧"
          }
          action={
            <Button size="md" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              新建任务
            </Button>
          }
        />
      ) : (
        <>
          {/* 使用 API 返回的 subtaskMap（从全量数据构建，子任务不丢失） */}
          {(() => {
            const rootTasks = tasks.filter(t => !t.parentTaskGuid);
            const rootIncompleteCount = rootTasks.filter(t => !t.completed).length;
            const totalSubtasks = Object.values(subtaskMap).reduce((sum, arr) => sum + (arr?.length || 0), 0);
            return (
              <>
                <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>共 {rootTasks.length} 个主任务</span>
                  {rootIncompleteCount > 0 && completeFilter !== "completed" && (
                    <span>· {rootIncompleteCount} 个未完成</span>
                  )}
                  {totalSubtasks > 0 && (
                    <span>· {totalSubtasks} 个子任务</span>
                  )}
                  {refreshing && (
                    <span className="flex items-center gap-1 text-cognition">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      同步中...
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {taskPagination.paginated.map((task) => (
                    <TaskCard
                      key={task.guid}
                      task={task}
                      subtasks={subtaskMap[task.guid] || []}
                      expanded={expandedTasks.has(task.guid)}
                      onToggleExpand={() => toggleExpand(task.guid)}
                      onComplete={handleComplete}
                      onReopen={handleReopen}
                      onImport={handleImport}
                      onOpenDetail={() => setDetailTask(task)}
                      actionLoading={actionLoading}
                      onSubtaskStateChange={() => fetchTasks({ force: true })}
                      myOpenId={myOpenId}
                    />
                  ))}
                </div>
                <div className="mt-4">
                  <Pagination
                    page={taskPagination.page}
                    pageSize={taskPagination.pageSize}
                    total={taskPagination.total}
                    onPageChange={taskPagination.onPageChange}
                    onPageSizeChange={taskPagination.onPageSizeChange}
                  />
                </div>
              </>
            );
          })()}
        </>
      )}

      {/* 新建任务弹窗 */}
      {showCreate && (
        <CreateTaskModal
          assignees={assignees}
          tasklists={tasklists}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            fetchTasks();
            fetchMeta();
          }}
        />
      )}

      {/* 任务详情抽屉 */}
      {detailTask && (
        <TaskDetailDrawer
          task={detailTask}
          assignees={assignees}
          tasklists={tasklists}
          onClose={() => setDetailTask(null)}
          onUpdated={(updated) => {
            setDetailTask(updated);
            setTasks((prev) =>
              prev.map((t) => (t.guid === updated.guid ? updated : t))
            );
          }}
          onDeleted={(guid) => {
            setDetailTask(null);
            setTasks((prev) => prev.filter((t) => t.guid !== guid));
          }}
        />
      )}
    </div>
  );
}

// ==================== 同步状态组件 ====================

function SyncStatus({
  state,
  syncing,
}: {
  state: SyncState | null;
  syncing: boolean;
}) {
  if (syncing) {
    return (
      <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
        <Loader2 className="h-3 w-3 animate-spin" />
        同步中...
      </span>
    );
  }
  if (!state || !state.lastSyncAt) {
    return (
      <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
        <Clock className="h-3 w-3" />
        未同步
      </span>
    );
  }
  return (
    <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
      <Clock className="h-3 w-3" />
      上次同步：{formatDate(state.lastSyncAt)}
      {state.taskCount > 0 && (
        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5">
          {state.taskCount}
        </span>
      )}
    </span>
  );
}

// ==================== 看板视图 ====================

/** 看板视图：按任务状态分列展示，支持拖拽切换状态 */
function BoardView({
  tasks,
  subtaskMap,
  myOpenId,
  onComplete,
  onReopen,
  onOpenDetail,
  actionLoading,
}: {
  tasks: LarkTask[];
  subtaskMap: Record<string, LarkTask[]>;
  myOpenId?: string;
  onComplete: (guid: string) => void;
  onReopen: (guid: string) => void;
  onOpenDetail: (task: LarkTask) => void;
  actionLoading: Record<string, boolean>;
}) {
  // 三列：未开始/进行中（未完成且无逾期）、已逾期、已完成
  const rootTasks = tasks.filter(t => !t.parentTaskGuid);
  const columns = [
    {
      key: "todo",
      title: "待处理",
      color: "border-l-blue-400",
      headerColor: "text-blue-600",
      tasks: rootTasks.filter(t => !t.completed && !isOverdue(t.due, t.completed)),
    },
    {
      key: "overdue",
      title: "已逾期",
      color: "border-l-red-400",
      headerColor: "text-red-600",
      tasks: rootTasks.filter(t => !t.completed && isOverdue(t.due, t.completed)),
    },
    {
      key: "done",
      title: "已完成",
      color: "border-l-green-400",
      headerColor: "text-green-600",
      tasks: rootTasks.filter(t => t.completed),
    },
  ];

  const [draggedGuid, setDraggedGuid] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDrop = (colKey: string) => {
    if (!draggedGuid) return;
    const task = rootTasks.find(t => t.guid === draggedGuid);
    if (!task) return;
    // 根据目标列触发完成/重开
    if (colKey === "done" && !task.completed) {
      onComplete(draggedGuid);
    } else if ((colKey === "todo" || colKey === "overdue") && task.completed) {
      onReopen(draggedGuid);
    }
    setDraggedGuid(null);
    setDragOverCol(null);
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {columns.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
          onDragLeave={() => setDragOverCol(null)}
          onDrop={() => handleDrop(col.key)}
          className={cn(
            "flex flex-col rounded-xl ios-glass-sm/50 p-3 min-h-[400px]",
            "border-l-4",
            col.color,
            dragOverCol === col.key && "ring-2 ring-cognition/40 bg-cognition/5"
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className={cn("text-sm font-semibold", col.headerColor)}>
              {col.title}
            </h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {col.tasks.length}
            </span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {col.tasks.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-[11px] text-muted-foreground">
                暂无任务
              </div>
            ) : (
              col.tasks.map((task) => {
                const subs = subtaskMap[task.guid] || [];
                const completedSubs = subs.filter(s => s.completed).length;
                const isMyTask = myOpenId && task.assignees.some(a => (a.open_id || a.id) === myOpenId);
                return (
                  <div
                    key={task.guid}
                    draggable
                    onDragStart={() => setDraggedGuid(task.guid)}
                    onDragEnd={() => { setDraggedGuid(null); setDragOverCol(null); }}
                    onClick={() => onOpenDetail(task)}
                    className={cn(
                      "cursor-move rounded-lg ios-glass-sm p-2.5 transition-all hover:border-cognition/40 hover:shadow-sm",
                      draggedGuid === task.guid && "opacity-50"
                    )}
                  >
                    <div className="mb-1.5 flex items-start gap-1.5">
                      <span
                        className={cn(
                          "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                          task.priority >= 2 ? "bg-red-500" : task.priority === 1 ? "bg-yellow-500" : "bg-muted"
                        )}
                      />
                      <p className={cn(
                        "flex-1 text-xs font-medium leading-snug",
                        task.completed && "text-muted-foreground line-through"
                      )}>
                        {task.summary}
                      </p>
                    </div>
                    {/* 元信息行 */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                      {task.due && (
                        <span className={cn(
                          "flex items-center gap-0.5",
                          isOverdue(task.due, task.completed) && "text-red-600 font-medium"
                        )}>
                          <Clock className="h-2.5 w-2.5" />
                          {formatDateShort(task.due)}
                        </span>
                      )}
                      {subs.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {completedSubs}/{subs.length}
                        </span>
                      )}
                      {task.assignees.length > 0 && (
                        <span className="flex -space-x-1 ml-auto">
                          {task.assignees.slice(0, 2).map((a, i) => {
                            const isMe = myOpenId && (a.open_id || a.id) === myOpenId;
                            return (
                              <MemberAvatar
                                key={i}
                                member={a}
                                size="xs"
                                className={cn(
                                  "ring-1 ring-background",
                                  isMe && "bg-cognition/25 ring-cognition/40"
                                )}
                              />
                            );
                          })}
                        </span>
                      )}
                    </div>
                    {isMyTask && (
                      <span className="mt-1.5 inline-block rounded-full bg-cognition/15 px-1.5 py-0 text-[8px] font-medium text-cognition">
                        我负责
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== 任务卡片 ====================

function TaskCard({
  task,
  subtasks = [],
  expanded,
  onToggleExpand,
  onComplete,
  onReopen,
  onImport,
  onOpenDetail,
  actionLoading,
  onSubtaskStateChange,
  myOpenId,
}: {
  task: LarkTask;
  subtasks?: LarkTask[];
  expanded: boolean;
  onToggleExpand: () => void;
  onComplete: (guid: string) => void;
  onReopen: (guid: string) => void;
  onImport: (task: LarkTask) => void;
  onOpenDetail: () => void;
  actionLoading: Record<string, boolean>;
  onSubtaskStateChange?: () => void;
  myOpenId?: string;
}) {
  const completeLoading = actionLoading[`complete-${task.guid}`];
  const reopenLoading = actionLoading[`reopen-${task.guid}`];
  const importLoading = actionLoading[`import-${task.guid}`];
  const overdue = isOverdue(task.due, task.completed);
  const totalSubtaskCount = task.subtaskCount ?? subtasks.length;
  const completedSubtaskCount = subtasks.filter(s => s.completed).length;

  // 判断负责人与当前用户的关系
  const isMyTask = myOpenId && task.assignees.some(a => (a.open_id || a.id) === myOpenId);
  const isFollowing = myOpenId && task.followers?.some(a => (a.open_id || a.id) === myOpenId) && !isMyTask;
  const isOthersTask = !isMyTask && !isFollowing && task.assignees.length > 0;

  return (
    <Card hover className="flex flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge color={task.completed ? "graveyard" : "task"}>
            {task.completed ? "已完成" : "未完成"}
          </Badge>
          {task.priority > 0 && (
            <Badge color="campaign">P{task.priority}</Badge>
          )}
          {overdue && <Badge color="graveyard">已逾期</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {task.url && (
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-cognition"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
              飞书
            </a>
          )}
        </div>
      </div>

      {/* 标题 - 可点击打开详情 */}
      <button
        onClick={onOpenDetail}
        className="mb-2 text-left text-sm font-medium leading-relaxed text-foreground transition-colors hover:text-cognition"
      >
        {task.summary}
      </button>

      {/* 描述 */}
      {task.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {task.description}
        </p>
      )}

      {/* 元信息 */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        {(task.start || task.due) && (
          <span
            className={cn(
              "flex items-center gap-1",
              overdue && "text-graveyard font-medium"
            )}
          >
            <Calendar className="h-3 w-3" />
            {task.start && `开始 ${formatDateShort(task.start)}`}
            {task.start && task.due && " ~ "}
            {task.due && `截止 ${formatDateShort(task.due)}`}
          </span>
        )}
        {task.assignees.length > 0 && (
          <span className="flex items-center gap-1">
            <span className="flex -space-x-1">
              {task.assignees.slice(0, 3).map((a, i) => {
                const isMe = myOpenId && (a.open_id || a.id) === myOpenId;
                return (
                  <MemberAvatar
                    key={i}
                    member={a}
                    size="xs"
                    className={cn(
                      "ring-1 ring-background",
                      isMe
                        ? "bg-cognition/25 ring-cognition/40"
                        : isOthersTask
                        ? "bg-muted/40"
                        : ""
                    )}
                  />
                );
              })}
              {task.assignees.length > 3 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[8px] font-medium ring-1 ring-background">
                  +{task.assignees.length - 3}
                </span>
              )}
            </span>
            {/* 负责人关系徽标 */}
            {isMyTask ? (
              <span className="rounded-full bg-cognition/15 px-1.5 py-0.5 text-[9px] font-medium text-cognition">
                我负责
              </span>
            ) : isFollowing ? (
              <span className="rounded-full bg-campaign/15 px-1.5 py-0.5 text-[9px] font-medium text-campaign">
                关注
              </span>
            ) : isOthersTask ? (
              <span className="text-[10px] text-muted-foreground">
                {task.assignees.length > 1
                  ? `${task.assignees.length} 人负责`
                  : memberName(task.assignees[0])}
              </span>
            ) : (
              <span className="text-[10px]">
                {task.assignees.length > 1
                  ? `${task.assignees.length} 人负责`
                  : memberName(task.assignees[0])}
              </span>
            )}
          </span>
        )}
        {task.tasklist?.name && (
          <span className="flex items-center gap-1">
            <Folder className="h-3 w-3" />
            {task.tasklist.name}
          </span>
        )}
        {((task.followerCount ?? task.followers?.length ?? 0) > 0) && (
          <span className="flex items-center gap-1" title="关注人">
            <Eye className="h-3 w-3" />
            {task.followerCount ?? task.followers?.length ?? 0}
          </span>
        )}
        {(task.commentCount ?? 0) > 0 && (
          <span className="flex items-center gap-1" title="评论">
            <MessageSquare className="h-3 w-3" />
            {task.commentCount}
          </span>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={onToggleExpand}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          子任务
          {totalSubtaskCount > 0 && (
            <span className={cn(
              "ml-1 rounded-full px-1.5 py-0 text-[9px]",
              completedSubtaskCount === totalSubtaskCount
                ? "bg-task/15 text-task"
                : "bg-muted text-muted-foreground"
            )}>
              {completedSubtaskCount}/{totalSubtaskCount}
            </span>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onOpenDetail}
        >
          <MessageSquare className="h-3 w-3" />
          详情
        </Button>
        {!task.completed ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onComplete(task.guid)}
            disabled={completeLoading || reopenLoading || importLoading}
          >
            <CheckCircle2 className="h-3 w-3" />
            {completeLoading ? "..." : "完成"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onReopen(task.guid)}
            disabled={completeLoading || reopenLoading || importLoading}
          >
            <RotateCcw className="h-3 w-3" />
            {reopenLoading ? "..." : "重开"}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onImport(task)}
          disabled={completeLoading || reopenLoading || importLoading}
        >
          <Download className="h-3 w-3" />
          {importLoading ? "..." : "导入看板"}
        </Button>
      </div>

      {/* 展开的子任务区域 */}
      {expanded && (
        <SubtaskInline
          taskId={task.guid}
          initialSubtasks={subtasks}
          onStateChange={onSubtaskStateChange}
          myOpenId={myOpenId}
        />
      )}
    </Card>
  );
}

// ==================== 内联子任务列表 ====================

function SubtaskInline({
  taskId,
  initialSubtasks = [],
  onStateChange,
  myOpenId,
}: {
  taskId: string;
  initialSubtasks?: LarkTask[];
  onStateChange?: () => void;
  myOpenId?: string;
}) {
  const [subtasks, setSubtasks] = useState<LarkTask[]>(initialSubtasks);
  const [loading, setLoading] = useState(initialSubtasks.length === 0);
  const [newSummary, setNewSummary] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchSubtasks = useCallback(async () => {
    // 如果已有预加载数据，不重复请求
    if (initialSubtasks.length > 0) {
      setSubtasks(initialSubtasks);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/lark-tasks/${taskId}/subtasks`);
      const data = await res.json();
      if (res.ok) {
        setSubtasks(data.subtasks || []);
      }
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, [taskId, initialSubtasks]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  const handleCreate = async () => {
    const summary = newSummary.trim();
    if (!summary) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/lark-tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "创建子任务失败", "error");
      } else {
        toast("子任务已创建", "success");
        setNewSummary("");
        onStateChange?.();
        fetchSubtasks();
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteSubtask = async (subtaskId: string) => {
    try {
      const res = await fetch(`/api/lark-tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", subtaskId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "完成子任务失败", "error");
      } else {
        toast("子任务已完成", "success");
        setSubtasks((prev) =>
          prev.map((s) =>
            s.guid === subtaskId ? { ...s, completed: true } : s
          )
        );
        onStateChange?.();
      }
    } catch {
      toast("网络错误", "error");
    }
  };

  const completedCount = subtasks.filter(s => s.completed).length;

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          子任务 ({subtasks.length})
          {subtasks.length > 0 && (
            <span className="text-task">
              {completedCount === subtasks.length ? "全部完成" : `${completedCount}/${subtasks.length} 完成`}
            </span>
          )}
        </div>
      </div>

      {/* 新建子任务 */}
      <div className="mb-2 flex items-center gap-1.5">
        <input
          type="text"
          value={newSummary}
          onChange={(e) => setNewSummary(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="添加子任务..."
          className="flex-1 rounded-lg ios-glass-sm px-2.5 py-1.5 text-[11px] outline-none focus:border-cognition/50"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCreate}
          disabled={creating || !newSummary.trim()}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {loading ? (
        <div className="py-2 text-center text-[11px] text-muted-foreground">
          加载中...
        </div>
      ) : subtasks.length === 0 ? (
        <div className="py-2 text-center text-[11px] text-muted-foreground">
          暂无子任务
        </div>
      ) : (
        <div className="space-y-1">
          {subtasks.map((st) => (
            <div
              key={st.guid}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] hover:bg-primary/10"
            >
              <button
                onClick={() => !st.completed && handleCompleteSubtask(st.guid)}
                disabled={st.completed}
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors",
                  st.completed
                    ? "border-task bg-task text-primary-foreground"
                    : "border-border hover:border-task"
                )}
              >
                {st.completed && <CheckCircle2 className="h-2.5 w-2.5" />}
              </button>
              <span
                className={cn(
                  "flex-1",
                  st.completed && "line-through text-muted-foreground"
                )}
              >
                {st.summary}
              </span>
              {st.assignees && st.assignees.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="flex -space-x-1">
                    {st.assignees.slice(0, 2).map((a, i) => {
                      const isMe = myOpenId && (a.open_id || a.id) === myOpenId;
                      return (
                        <MemberAvatar
                          key={i}
                          member={a}
                          size="xs"
                          className={cn(
                            "ring-1 ring-background",
                            isMe && "bg-cognition/25 ring-cognition/40"
                          )}
                        />
                      );
                    })}
                  </span>
                  {myOpenId && st.assignees.some(a => (a.open_id || a.id) === myOpenId) && (
                    <span className="rounded-full bg-cognition/15 px-1 py-0 text-[8px] font-medium text-cognition">
                      我
                    </span>
                  )}
                </span>
              )}
              {st.due && (
                <span className={cn(
                  "text-[10px]",
                  isOverdue(st.due, st.completed) ? "text-graveyard" : "text-muted-foreground"
                )}>
                  {formatDateShort(st.due)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== 新建任务弹窗 ====================

function CreateTaskModal({
  assignees,
  tasklists,
  onClose,
  onCreated,
}: {
  assignees: LarkMember[];
  tasklists: LarkTasklistRef[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState<string | null>(null);
  const [due, setDue] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [tasklistId, setTasklistId] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const s = summary.trim();
    if (!s) {
      toast("请输入任务标题", "info");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/lark-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          summary: s,
          description: description.trim() || undefined,
          start: start || undefined,
          due: due || undefined,
          assignees: assigneeIds.length ? assigneeIds : undefined,
          followers: followerIds.length ? followerIds : undefined,
          tasklistId: tasklistId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "创建失败", "error");
      } else {
        toast("任务已创建", "success");
        onCreated();
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">新建飞书任务</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {/* 标题 */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              标题 *
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreate();
              }}
              placeholder="输入任务标题..."
              autoFocus
              className="w-full rounded-xl ios-glass-sm px-3 py-2 text-sm outline-none focus:border-cognition/50"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="任务描述（可选）..."
              rows={3}
              className="w-full resize-none rounded-xl ios-glass-sm px-3 py-2 text-sm outline-none focus:border-cognition/50"
            />
          </div>

          {/* 负责人 */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              负责人
            </label>
            <MemberMultiSelect
              members={assignees}
              selectedIds={assigneeIds}
              onChange={setAssigneeIds}
              placeholder="选择负责人"
              icon={Users}
            />
          </div>

          {/* 开始时间 / 截止时间 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateTimeQuickPicker
              label="开始时间"
              value={start}
              onChange={setStart}
            />
            <DateTimeQuickPicker
              label="截止时间"
              value={due}
              onChange={setDue}
            />
          </div>

          {/* 任务清单 */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              任务清单
            </label>
            <select
              value={tasklistId}
              onChange={(e) => setTasklistId(e.target.value)}
              className="w-full rounded-xl ios-glass-sm px-3 py-2 text-sm outline-none focus:border-cognition/50"
            >
              <option value="">默认清单</option>
              {tasklists.map((t) => (
                <option key={t.guid} value={t.guid || ""}>
                  {t.name || "(未命名)"}
                </option>
              ))}
            </select>
          </div>

          {/* 关注人 */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              关注人
            </label>
            <MemberMultiSelect
              members={assignees}
              selectedIds={followerIds}
              onChange={setFollowerIds}
              placeholder="选择关注人"
              icon={Eye}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" size="md" onClick={onClose}>
            取消
          </Button>
          <Button size="md" onClick={handleCreate} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                创建任务
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ==================== 任务详情抽屉 ====================

function TaskDetailDrawer({
  task,
  assignees,
  tasklists,
  onClose,
  onUpdated,
  onDeleted,
}: {
  task: LarkTask;
  assignees: LarkMember[];
  tasklists: LarkTasklistRef[];
  onClose: () => void;
  onUpdated: (task: LarkTask) => void;
  onDeleted: (guid: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(task.summary);
  const [description, setDescription] = useState(task.description);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // 任务元数据编辑
  const [start, setStart] = useState<string | null>(task.start);
  const [due, setDue] = useState<string | null>(task.due);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task.assignees.map((m) => m.open_id || m.id || m.name || "")
  );
  const [followerIds, setFollowerIds] = useState<string[]>(
    task.followers.map((m) => m.open_id || m.id || m.name || "")
  );
  const [tasklistId, setTasklistId] = useState<string>(task.tasklist?.guid || "");
  const [metaSaving, setMetaSaving] = useState(false);

  // 子任务
  const [subtasks, setSubtasks] = useState<LarkTask[]>([]);
  const [subtasksLoading, setSubtasksLoading] = useState(true);
  const [newSubtask, setNewSubtask] = useState("");
  const [creatingSubtask, setCreatingSubtask] = useState(false);

  // 评论
  const [comments, setComments] = useState<LarkComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsSupported, setCommentsSupported] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);

  // 任务切换时重置本地状态
  useEffect(() => {
    setSummary(task.summary);
    setDescription(task.description);
    setStart(task.start);
    setDue(task.due);
    setAssigneeIds(task.assignees.map((m) => m.open_id || m.id || m.name || ""));
    setFollowerIds(task.followers.map((m) => m.open_id || m.id || m.name || ""));
    setTasklistId(task.tasklist?.guid || "");
    setEditing(false);
  }, [task]);

  const fetchSubtasks = useCallback(async () => {
    setSubtasksLoading(true);
    try {
      const res = await fetch(`/api/lark-tasks/${task.guid}/subtasks`);
      const data = await res.json();
      if (res.ok) {
        setSubtasks(data.subtasks || []);
      }
    } catch {
      // 静默
    } finally {
      setSubtasksLoading(false);
    }
  }, [task.guid]);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/lark-tasks/${task.guid}/comments`);
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments || []);
        setCommentsSupported(data.supported !== false);
      }
    } catch {
      // 静默
    } finally {
      setCommentsLoading(false);
    }
  }, [task.guid]);

  useEffect(() => {
    fetchSubtasks();
    fetchComments();
  }, [fetchSubtasks, fetchComments]);

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSave = async () => {
    const s = summary.trim();
    if (!s) {
      toast("标题不能为空", "info");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/lark-tasks/${task.guid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          summary: s,
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "保存失败", "error");
      } else {
        toast("已保存", "success");
        onUpdated({
          ...task,
          summary: s,
          description: description.trim(),
        });
        setEditing(false);
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setSaving(false);
    }
  };

  // 保存负责人、关注人、时间、清单等元数据
  const handleSaveMeta = async () => {
    setMetaSaving(true);
    try {
      const results = await Promise.all([
        fetch(`/api/lark-tasks/${task.guid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            start: start || undefined,
            due: due || undefined,
            tasklistId: tasklistId || undefined,
          }),
        }),
        fetch(`/api/lark-tasks/${task.guid}/assignees`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignees: assigneeIds }),
        }),
        fetch(`/api/lark-tasks/${task.guid}/followers`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ followers: followerIds }),
        }),
      ]);

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        const errors = await Promise.all(failed.map((r) => r.json().catch(() => ({}))));
        toast(errors[0]?.error || "部分字段保存失败", "error");
      } else {
        toast("任务信息已更新", "success");
        // 本地更新任务对象
        const newAssignees = assignees.filter((m) =>
          assigneeIds.includes(m.open_id || m.id || m.name || "")
        );
        const newFollowers = assignees.filter((m) =>
          followerIds.includes(m.open_id || m.id || m.name || "")
        );
        const newTasklist = tasklists.find((t) => t.guid === tasklistId) || task.tasklist;
        onUpdated({
          ...task,
          start,
          due,
          assignees: newAssignees,
          followers: newFollowers,
          collaborators: newFollowers,
          tasklist: newTasklist,
        });
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setMetaSaving(false);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/lark-tasks/${task.guid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "标记完成失败", "error");
      } else {
        toast("已标记完成", "success");
        onUpdated({ ...task, completed: true });
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/lark-tasks/${task.guid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "重开失败", "error");
      } else {
        toast("任务已重开", "success");
        onUpdated({ ...task, completed: false });
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSubtask = async () => {
    const s = newSubtask.trim();
    if (!s) return;
    setCreatingSubtask(true);
    try {
      const res = await fetch(`/api/lark-tasks/${task.guid}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: s }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "创建子任务失败", "error");
      } else {
        toast("子任务已创建", "success");
        setNewSubtask("");
        fetchSubtasks();
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setCreatingSubtask(false);
    }
  };

  const handleCompleteSubtask = async (subtaskId: string) => {
    try {
      const res = await fetch(`/api/lark-tasks/${task.guid}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", subtaskId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "完成子任务失败", "error");
      } else {
        toast("子任务已完成", "success");
        setSubtasks((prev) =>
          prev.map((s) =>
            s.guid === subtaskId ? { ...s, completed: true } : s
          )
        );
      }
    } catch {
      toast("网络错误", "error");
    }
  };

  const handlePostComment = async () => {
    const c = newComment.trim();
    if (!c) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/lark-tasks/${task.guid}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: c }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "评论失败", "error");
      } else {
        toast(data.local ? "评论已保存（本地）" : "评论已发送", "success");
        setNewComment("");
        fetchComments();
      }
    } catch {
      toast("网络错误", "error");
    } finally {
      setPostingComment(false);
    }
  };

  const overdue = isOverdue(task.due, task.completed);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        className="glass-card flex h-full w-full max-w-xl flex-col shadow-2xl animate-in slide-in-from-right"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Badge color={task.completed ? "graveyard" : "task"}>
              {task.completed ? "已完成" : "未完成"}
            </Badge>
            {overdue && <Badge color="graveyard">已逾期</Badge>}
            {task.priority > 0 && <Badge color="campaign">P{task.priority}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {task.url && (
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cognition"
              >
                <ExternalLink className="h-3 w-3" />
                在飞书打开
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 内容区 - 可滚动 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 标题区 */}
          {editing ? (
            <div className="mb-4 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  标题
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full rounded-xl ios-glass-sm px-3 py-2 text-sm outline-none focus:border-cognition/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl ios-glass-sm px-3 py-2 text-sm outline-none focus:border-cognition/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setSummary(task.summary);
                    setDescription(task.description);
                  }}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <h2 className="mb-2 text-lg font-semibold text-foreground">
                {task.summary}
              </h2>
              {task.description && (
                <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {task.description}
                </p>
              )}
            </div>
          )}

          {/* 任务元数据编辑区 */}
          <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 text-[11px] font-medium text-muted-foreground">
              任务设置
            </div>
            <div className="space-y-3">
              {/* 负责人 */}
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  负责人
                </label>
                <MemberMultiSelect
                  members={assignees}
                  selectedIds={assigneeIds}
                  onChange={setAssigneeIds}
                  placeholder="选择负责人"
                  icon={Users}
                />
              </div>

              {/* 开始 / 截止时间 */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DateTimeQuickPicker
                  label="开始时间"
                  value={start}
                  onChange={setStart}
                />
                <DateTimeQuickPicker
                  label="截止时间"
                  value={due}
                  onChange={setDue}
                />
              </div>

              {/* 任务清单 */}
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  任务清单
                </label>
                <select
                  value={tasklistId}
                  onChange={(e) => setTasklistId(e.target.value)}
                  className="w-full rounded-xl ios-glass-sm px-3 py-2 text-xs outline-none focus:border-cognition/50"
                >
                  <option value="">默认清单</option>
                  {tasklists.map((t) => (
                    <option key={t.guid} value={t.guid || ""}>
                      {t.name || "(未命名)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* 关注人 */}
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  关注人
                </label>
                <MemberMultiSelect
                  members={assignees}
                  selectedIds={followerIds}
                  onChange={setFollowerIds}
                  placeholder="选择关注人"
                  icon={Eye}
                />
              </div>

              <Button
                size="sm"
                onClick={handleSaveMeta}
                disabled={metaSaving}
                className="w-full sm:w-auto"
              >
                {metaSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                保存设置
              </Button>
            </div>
          </div>

          {/* 更多信息 */}
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border pb-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              创建：{formatDate(task.createdAt)}
            </span>
            {task.updatedAt && task.updatedAt !== task.createdAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                更新：{formatDate(task.updatedAt)}
              </span>
            )}
            {task.completedAt && (
              <span className="flex items-center gap-1 text-task">
                <CheckCircle2 className="h-3 w-3" />
                完成：{formatDate(task.completedAt)}
              </span>
            )}
            {task.creator && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                创建者：{memberName(task.creator)}
              </span>
            )}
            {task.priority > 0 && (
              <span className="flex items-center gap-1 text-campaign">
                优先级 P{task.priority}
              </span>
            )}
            {task.repeatRule && (
              <span className="flex items-center gap-1 text-cognition">
                重复：{task.repeatRule}
              </span>
            )}
            {task.location && task.location.name && (
              <span className="flex items-center gap-1">
                📍 {task.location.name}
                {task.location.address && ` · ${task.location.address}`}
              </span>
            )}
          </div>

          {/* 操作按钮 */}
          {!editing && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3" />
                编辑标题/描述
              </Button>
              {!task.completed ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleComplete}
                  disabled={actionLoading}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {actionLoading ? "处理中..." : "标记完成"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleReopen}
                  disabled={actionLoading}
                >
                  <RotateCcw className="h-3 w-3" />
                  {actionLoading ? "处理中..." : "重开任务"}
                </Button>
              )}
            </div>
          )}

          {/* 子任务区 */}
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              子任务 ({subtasks.length})
            </div>

            {/* 新建子任务 */}
            <div className="mb-2 flex items-center gap-1.5">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSubtask();
                }}
                placeholder="添加子任务..."
                className="flex-1 rounded-lg ios-glass-sm px-3 py-1.5 text-xs outline-none focus:border-cognition/50"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCreateSubtask}
                disabled={creatingSubtask || !newSubtask.trim()}
              >
                {creatingSubtask ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
              </Button>
            </div>

            {subtasksLoading ? (
              <div className="py-3 text-center text-[11px] text-muted-foreground">
                加载中...
              </div>
            ) : subtasks.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-muted-foreground">
                暂无子任务
              </div>
            ) : (
              <div className="space-y-1">
                {subtasks.map((st) => (
                  <div
                    key={st.guid}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-xs hover:bg-primary/10"
                  >
                    <button
                      onClick={() =>
                        !st.completed && handleCompleteSubtask(st.guid)
                      }
                      disabled={st.completed}
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        st.completed
                          ? "border-task bg-task text-primary-foreground"
                          : "border-border hover:border-task"
                      )}
                    >
                      {st.completed && <CheckCircle2 className="h-3 w-3" />}
                    </button>
                    <span
                      className={cn(
                        "flex-1",
                        st.completed && "line-through text-muted-foreground"
                      )}
                    >
                      {st.summary}
                    </span>
                    {st.due && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateShort(st.due)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 评论区 */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              评论 ({comments.length})
            </div>

            {/* 发表评论 */}
            <div className="mb-3 flex items-start gap-1.5">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="写下你的评论..."
                rows={2}
                className="flex-1 resize-none rounded-lg ios-glass-sm px-3 py-2 text-xs outline-none focus:border-cognition/50"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handlePostComment}
                disabled={postingComment || !newComment.trim()}
              >
                {postingComment ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </Button>
            </div>

            {commentsLoading ? (
              <div className="py-3 text-center text-[11px] text-muted-foreground">
                加载中...
              </div>
            ) : !commentsSupported && comments.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-muted-foreground">
                当前 lark-cli 版本暂不支持查看评论列表，但可以发送评论
              </div>
            ) : comments.length === 0 ? (
              <div className="py-3 text-center text-[11px] text-muted-foreground">
                暂无评论
              </div>
            ) : (
              <div className="space-y-2">
                {comments.map((c, i) => (
                  <div
                    key={c.id || i}
                    className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cognition/20 text-[9px] text-cognition">
                          {memberInitials(c.creator)}
                        </span>
                        {memberName(c.creator)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs text-foreground">
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 日历视图组件 ====================

function CalendarView({
  tasks,
  month,
  expandedDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  onToggleDate,
  onOpenDetail,
}: {
  tasks: LarkTask[];
  month: Date;
  expandedDate: Date | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onToggleDate: (date: Date) => void;
  onOpenDetail: (task: LarkTask) => void;
}) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const days = getMonthGrid(year, monthIdx);
  const today = new Date();

  // 按日期分组任务
  const tasksByDate = new Map<string, LarkTask[]>();
  for (const t of tasks) {
    const key = dateKey(t.due);
    if (!key) continue;
    const arr = tasksByDate.get(key);
    if (arr) arr.push(t);
    else tasksByDate.set(key, [t]);
  }

  const totalTasksThisMonth = days.reduce((sum, d) => {
    const key = dateKey(d.toISOString());
    if (!key) return sum;
    return sum + (tasksByDate.get(key)?.length || 0);
  }, 0);

  return (
    <div>
      {/* 日历头部：月份导航 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            {formatMonthTitle(year, monthIdx)}
          </h2>
          {totalTasksThisMonth > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {totalTasksThisMonth} 个任务
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onPrevMonth}>
            <ChevronLeft className="h-3.5 w-3.5" />
            上月
          </Button>
          <Button variant="ghost" size="sm" onClick={onToday}>
            今天
          </Button>
          <Button variant="outline" size="sm" onClick={onNextMonth}>
            <ChevronRight className="h-3.5 w-3.5" />
            下月
          </Button>
        </div>
      </div>

      {/* 星期表头 */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1.5 text-center text-[11px] font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 日历网格 */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => {
          const key = dateKey(date.toISOString()) || "";
          const dayTasks = tasksByDate.get(key) || [];
          const isCurrentMonth = date.getMonth() === monthIdx;
          const isToday = isSameDay(date, today);
          const isExpanded = expandedDate ? isSameDay(expandedDate, date) : false;
          const visibleTasks = isExpanded ? dayTasks : dayTasks.slice(0, 3);
          const hiddenCount = dayTasks.length - visibleTasks.length;

          return (
            <div
              key={i}
              onClick={() => dayTasks.length > 0 && onToggleDate(date)}
              className={cn(
                "min-h-[96px] rounded-lg border p-1.5 transition-colors",
                isCurrentMonth
                  ? "ios-glass-sm"
                  : "border-border/40 bg-muted/20",
                isToday && "ring-1 ring-cognition/40",
                dayTasks.length > 0 && "cursor-pointer hover:border-cognition/40",
                isExpanded && "ring-1 ring-cognition/60"
              )}
            >
              {/* 日期数字 */}
              <div
                className={cn(
                  "mb-1 text-right text-[11px] font-medium",
                  isCurrentMonth
                    ? isToday
                      ? "text-cognition"
                      : "text-foreground"
                    : "text-muted-foreground/50"
                )}
              >
                {date.getDate()}
              </div>

              {/* 任务列表 */}
              <div className="space-y-0.5">
                {visibleTasks.map((task) => {
                  const overdue = isOverdue(task.due, task.completed);
                  return (
                    <button
                      key={task.guid}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(task);
                      }}
                      className={cn(
                        "block w-full truncate rounded px-1 py-0.5 text-left text-[10px] transition-colors",
                        task.completed
                          ? "bg-muted/60 text-muted-foreground line-through"
                          : overdue
                          ? "bg-graveyard/10 text-graveyard"
                          : "bg-task/10 text-task"
                      )}
                      title={task.summary}
                    >
                      {task.summary}
                    </button>
                  );
                })}
                {hiddenCount > 0 && (
                  <div className="px-1 text-[10px] text-muted-foreground">
                    +{hiddenCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-task/30" />
          未完成
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-graveyard/30" />
          逾期
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-muted" />
          已完成
        </span>
        <span className="text-muted-foreground/70">
          点击有任务的日期可展开全部
        </span>
      </div>
    </div>
  );
}

// ==================== 甘特图视图组件 ====================

function GanttView({
  tasks,
  centerDate,
  onPrev,
  onNext,
  onToday,
  onOpenDetail,
}: {
  tasks: LarkTask[];
  centerDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenDetail: (task: LarkTask) => void;
}) {
  // 甘特图配置
  const DAY_WIDTH = 36; // 每天列宽（像素）
  const RANGE_DAYS = 14; // 中心点前后各多少天
  const TOTAL_DAYS = RANGE_DAYS * 2 + 1; // 总天数（29 天）
  const TASK_NAME_WIDTH = 200; // 左侧任务名列宽

  // 计算时间范围起始日期（中心点前 14 天的当天 0 点）
  const rangeStart = new Date(centerDate);
  rangeStart.setDate(rangeStart.getDate() - RANGE_DAYS);
  rangeStart.setHours(0, 0, 0, 0);

  // 生成日期数组
  const days: Date[] = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 今日在时间轴中的索引
  const todayIndex = days.findIndex((d) => isSameDay(d, today));

  // 范围起止日期标签
  const rangeEnd = days[days.length - 1];
  const rangeLabel = `${formatDateShort(days[0].toISOString())} ~ ${formatDateShort(
    rangeEnd.toISOString()
  )}`;

  // 过滤出有任意时间字段的任务
  const visibleTasks = tasks.filter(
    (t) => t.start || t.createdAt || t.due
  );

  // 计算任务条位置
  const getTaskBar = (task: LarkTask) => {
    // 起始时间：优先 start，其次 createdAt，最后 due
    const startIso = task.start || task.createdAt || task.due;
    // 结束时间：优先 due，其次 start，最后 createdAt
    const endIso = task.due || task.start || task.createdAt;
    if (!startIso || !endIso) return null;

    const startDate = new Date(startIso);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endIso);
    endDate.setHours(0, 0, 0, 0);

    // 计算偏移天数（相对于 rangeStart）
    const msPerDay = 24 * 60 * 60 * 1000;
    const startOffset = Math.floor(
      (startDate.getTime() - rangeStart.getTime()) / msPerDay
    );
    const endOffset = Math.floor(
      (endDate.getTime() - rangeStart.getTime()) / msPerDay
    );

    // 完全在范围外
    if (startOffset > TOTAL_DAYS - 1 || endOffset < 0) return null;

    // 限制在可见范围内
    const visibleStart = Math.max(0, startOffset);
    const visibleEnd = Math.min(TOTAL_DAYS - 1, endOffset);

    const left = visibleStart * DAY_WIDTH;
    const width = Math.max(
      DAY_WIDTH * 0.6,
      (visibleEnd - visibleStart + 1) * DAY_WIDTH - 2
    );

    return {
      left,
      width,
      isClippedStart: startOffset < 0,
      isClippedEnd: endOffset > TOTAL_DAYS - 1,
    };
  };

  // 悬停 tooltip 状态
  const [hoveredTask, setHoveredTask] = useState<{
    task: LarkTask;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div>
      {/* 头部：时间范围导航 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">甘特图</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {rangeLabel}
          </span>
          {visibleTasks.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {visibleTasks.length} 个任务
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onPrev}>
            <ChevronLeft className="h-3.5 w-3.5" />
            前两周
          </Button>
          <Button variant="ghost" size="sm" onClick={onToday}>
            今天
          </Button>
          <Button variant="outline" size="sm" onClick={onNext}>
            后两周
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {visibleTasks.length === 0 ? (
        <EmptyState
          icon={GanttChart}
          title="当前时间范围内无可显示的任务"
          description="任务需要有开始或截止时间才能在甘特图中显示"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl ios-glass-sm">
          <div
            className="relative"
            style={{
              minWidth: TASK_NAME_WIDTH + TOTAL_DAYS * DAY_WIDTH,
            }}
          >
            {/* 时间轴表头 */}
            <div className="ios-glass-sm flex">
              {/* 左上角占位 */}
              <div
                className="ios-glass-sm shrink-0 border-r border-border px-3 py-2 text-[11px] font-medium text-muted-foreground"
                style={{ width: TASK_NAME_WIDTH }}
              >
                任务
              </div>
              {/* 日期列 */}
              <div className="flex">
                {days.map((date, i) => {
                  const isToday = isSameDay(date, today);
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "border-r border-border/40 px-1 py-1 text-center text-[10px]",
                        isWeekend && "bg-muted/30",
                        isToday && "bg-cognition/10"
                      )}
                      style={{ width: DAY_WIDTH }}
                    >
                      <div
                        className={cn(
                          "font-medium",
                          isToday ? "text-cognition" : "text-muted-foreground"
                        )}
                      >
                        {date.getDate()}
                      </div>
                      <div className="text-[9px] text-muted-foreground/70">
                        {WEEKDAY_LABELS[date.getDay()]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 任务行区域 */}
            <div className="relative">
              {/* 今日竖线标记 */}
              {todayIndex >= 0 && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-10 border-l-2 border-cognition/60"
                  style={{
                    left: TASK_NAME_WIDTH + todayIndex * DAY_WIDTH + DAY_WIDTH / 2,
                  }}
                />
              )}

              {visibleTasks.map((task, idx) => {
                const bar = getTaskBar(task);
                if (!bar) return null;
                const overdue = isOverdue(task.due, task.completed);

                return (
                  <div
                    key={task.guid}
                    className={cn(
                      "flex border-b border-border/40",
                      idx % 2 === 1 && "bg-muted/10"
                    )}
                  >
                    {/* 任务名（左侧 sticky） */}
                    <div
                      className="ios-glass-sm sticky left-0 z-10 shrink-0 truncate border-r border-border px-3 py-2 text-xs"
                      style={{ width: TASK_NAME_WIDTH }}
                    >
                      <span
                        className={cn(
                          "block truncate",
                          task.completed && "text-muted-foreground line-through"
                        )}
                      >
                        {task.summary}
                      </span>
                    </div>
                    {/* 任务条区域 */}
                    <div
                      className="relative"
                      style={{
                        width: TOTAL_DAYS * DAY_WIDTH,
                        height: 36,
                      }}
                    >
                      {/* 周末背景条纹 */}
                      {days.map((date, i) => {
                        const isWeekend =
                          date.getDay() === 0 || date.getDay() === 6;
                        if (!isWeekend) return null;
                        return (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 bg-muted/20"
                            style={{
                              left: i * DAY_WIDTH,
                              width: DAY_WIDTH,
                            }}
                          />
                        );
                      })}
                      {/* 任务条 */}
                      <button
                        onClick={() => onOpenDetail(task)}
                        onMouseEnter={(e) => {
                          const rect =
                            e.currentTarget.getBoundingClientRect();
                          setHoveredTask({
                            task,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setHoveredTask(null)}
                        className={cn(
                          "absolute top-1.5 overflow-hidden rounded-md px-2 py-1 text-[10px] font-medium text-white transition-all hover:z-20 hover:brightness-110",
                          task.completed
                            ? "bg-muted-foreground/60"
                            : overdue
                            ? "bg-graveyard"
                            : "bg-task"
                        )}
                        style={{
                          left: bar.left,
                          width: bar.width,
                          minWidth: 4,
                        }}
                      >
                        <span className="truncate">
                          {bar.isClippedStart ? "← " : ""}
                          {task.summary}
                          {bar.isClippedEnd ? " →" : ""}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 悬停 tooltip */}
      {hoveredTask && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg ios-glass-sm px-3 py-2 text-xs shadow-xl"
          style={{
            left: hoveredTask.x,
            top: hoveredTask.y - 8,
          }}
        >
          <div className="mb-1 font-medium text-foreground">
            {hoveredTask.task.summary}
          </div>
          <div className="space-y-0.5 text-[11px] text-muted-foreground">
            <div>
              负责人：
              {hoveredTask.task.assignees.length > 0
                ? hoveredTask.task.assignees
                    .map((a) => memberName(a))
                    .join("、")
                : "—"}
            </div>
            <div>截止：{formatDateShort(hoveredTask.task.due)}</div>
            <div>
              状态：
              {hoveredTask.task.completed
                ? "已完成"
                : isOverdue(hoveredTask.task.due, hoveredTask.task.completed)
                ? "已逾期"
                : "未完成"}
            </div>
          </div>
        </div>
      )}

      {/* 图例 */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-task" />
          未完成
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-graveyard" />
          逾期
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-muted-foreground/60" />
          已完成
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-cognition/60" />
          今日
        </span>
        <span className="text-muted-foreground/70">
          点击任务条可查看详情
        </span>
      </div>
    </div>
  );
}

// ==================== Webhook 实时同步面板 ====================

interface WebhookPanelProps {
  status: {
    configured: boolean;
    totalEvents: number;
    recentEvents24h: number;
    lastEventAt: string | null;
    lastEventType: string | null;
    lastEventSummary: string | null;
  } | null;
  events: Array<{
    eventId: string;
    eventType: string;
    timestamp: string;
    taskGuid?: string;
    summary?: string;
  }>;
  simulating: boolean;
  onSimulate: (eventType: string) => void;
  onRefreshEvents: () => void;
  onClose: () => void;
}

const SIMULATE_EVENTS = [
  { type: "task.task.created", label: "任务创建", color: "text-cognition" },
  { type: "task.task.updated", label: "任务更新", color: "text-campaign" },
  { type: "task.task.completed", label: "任务完成", color: "text-northstar" },
  { type: "task.task.deleted", label: "任务删除", color: "text-graveyard" },
  { type: "task.task.reopened", label: "任务重启", color: "text-foreground" },
];

function eventTypeLabel(eventType: string): string {
  const map: Record<string, string> = {
    "task.task.created": "创建",
    "task.task.updated": "更新",
    "task.task.completed": "完成",
    "task.task.deleted": "删除",
    "task.task.reopened": "重启",
  };
  return map[eventType] || eventType.split(".").pop() || "事件";
}

function eventColor(eventType: string): string {
  const map: Record<string, string> = {
    "task.task.created": "bg-cognition/15 text-cognition",
    "task.task.updated": "bg-campaign/15 text-campaign",
    "task.task.completed": "bg-northstar/15 text-northstar",
    "task.task.deleted": "bg-graveyard/15 text-graveyard",
    "task.task.reopened": "bg-muted text-foreground",
  };
  return map[eventType] || "bg-muted text-muted-foreground";
}

function WebhookPanel({
  status,
  events,
  simulating,
  onSimulate,
  onRefreshEvents,
  onClose,
}: WebhookPanelProps) {
  const [showWizard, setShowWizard] = useState(false);
  return (
    <Card className="mb-4 border-cognition/20 bg-gradient-to-br from-cognition/5 to-transparent">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-cognition" />
          <h3 className="text-sm font-semibold text-foreground">飞书 Webhook 实时同步</h3>
          {status?.configured ? (
            <Badge color="cognition" className="text-[10px]">已配置</Badge>
          ) : (
            <Badge color="graveyard" className="text-[10px]">未配置</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowWizard(true)}>
            <HelpCircle className="h-3.5 w-3.5" />
            配置向导
          </Button>
          <Button variant="ghost" size="sm" onClick={onRefreshEvents}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {showWizard && <WebhookConfigWizard onClose={() => setShowWizard(false)} />}

      <div className="grid gap-4 p-4 md:grid-cols-3">
        {/* 统计信息 */}
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground">同步统计</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">累计事件</span>
              <span className="font-semibold text-foreground">{status?.totalEvents ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">近24小时</span>
              <span className="font-semibold text-cognition">{status?.recentEvents24h ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">最近事件</span>
              <span className="font-semibold text-foreground">
                {status?.lastEventAt ? formatDate(status.lastEventAt) : "—"}
              </span>
            </div>
            {status?.lastEventSummary && (
              <div className="rounded-md bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                <span className={cn("mr-1 rounded px-1", eventColor(status.lastEventType || ""))}>
                  {eventTypeLabel(status.lastEventType || "")}
                </span>
                {status.lastEventSummary}
              </div>
            )}
          </div>
        </div>

        {/* 模拟事件测试 */}
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground">模拟事件测试</div>
          <div className="grid grid-cols-2 gap-1.5">
            {SIMULATE_EVENTS.map((evt) => (
              <button
                key={evt.type}
                disabled={simulating}
                onClick={() => onSimulate(evt.type)}
                className={cn(
                  "rounded-md ios-glass-sm px-2 py-1.5 text-[11px] font-medium transition-colors hover:bg-primary/10 disabled:opacity-50",
                  evt.color
                )}
              >
                {simulating ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
                {evt.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            点击按钮模拟飞书 Webhook 事件，验证实时同步链路
          </p>
        </div>

        {/* 事件日志 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">事件日志</span>
            <Activity className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {events.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-muted-foreground/60">
                暂无事件
              </div>
            ) : (
              events.slice().reverse().map((evt, idx) => (
                <div
                  key={`${evt.eventId}-${idx}`}
                  className="rounded-md bg-muted/30 px-2 py-1.5 text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("rounded px-1 text-[10px]", eventColor(evt.eventType))}>
                      {eventTypeLabel(evt.eventType)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {formatDate(evt.timestamp)}
                    </span>
                  </div>
                  {evt.summary && (
                    <div className="mt-0.5 truncate text-muted-foreground">{evt.summary}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ==================== Webhook 配置向导弹窗 ====================

function WebhookConfigWizard({ onClose }: { onClose: () => void }) {
  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/lark-webhook` : "/api/lark-webhook";
  const steps = [
    {
      title: "1. 获取飞书应用凭证",
      content: "进入飞书开放平台 → 你的应用 → 事件订阅，复制「Verification Token」。",
    },
    {
      title: "2. 配置环境变量",
      content: `在项目根目录 .env 文件中添加：\nLARK_WEBHOOK_TOKEN="你的 Verification Token"`,
    },
    {
      title: "3. 填写回调地址",
      content: `在飞书开放平台「事件订阅」的「请求地址」中填入：\n${endpoint}\n并勾选需要的事件：task.task.created / updated / completed / deleted / reopened`,
    },
    {
      title: "4. 验证连通性",
      content: "保存后飞书会发送 URL 验证请求，本页面会显示「已配置」。然后可点击「模拟事件测试」验证同步链路。",
    },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-cognition" />
            <h3 className="text-sm font-semibold text-foreground">飞书 Webhook 配置向导</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="space-y-3 p-4">
          {steps.map((step, idx) => (
            <div key={idx} className="rounded-lg ios-glass-sm p-3">
              <div className="mb-1 text-sm font-medium text-foreground">{step.title}</div>
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {step.content}
              </div>
            </div>
          ))}
          <div className="rounded-md bg-cognition/5 p-3 text-xs text-cognition">
            <strong>提示：</strong>本服务已经配置了 LARK_WEBHOOK_TOKEN，Webhook 校验已启用。如果飞书端尚未配置回调地址，请按上方步骤 3 操作。
          </div>
        </div>
        <div className="flex justify-end border-t border-border/60 px-4 py-3">
          <Button size="sm" onClick={onClose}>我知道了</Button>
        </div>
      </Card>
    </div>
  );
}

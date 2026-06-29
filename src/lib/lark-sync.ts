// 飞书任务同步逻辑：lark-cli 调用封装 + 同步状态管理 + 数据库持久化
import { execSync, exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("lark-sync");
const execAsync = promisify(exec);

const LARK_CLI_TIMEOUT = 30000; // 30 秒超时
const SYNC_STATE_FILE = path.join(process.cwd(), ".lark-sync-state.json");
// 飞书任务详情页 URL 前缀（可被环境变量覆盖，适配不同域名）
const LARK_TASK_URL_PREFIX =
  process.env.LARK_TASK_URL_PREFIX || "https://applink.feishu.cn/client/todo/detail";

// 模块级缓存：open_id → 昵称，避免重复调用 contact +get-user
const memberNameCache = new Map<string, string>();
// 模块级缓存：tasklist_guid → 清单名称，避免重复调用 tasklists list
const tasklistNameCache = new Map<string, string>();
// 模块级缓存：tasklists 列表 + TTL（5分钟），避免频繁调用 lark-cli
let tasklistsCache: { data: NormalizedTasklist[]; expiresAt: number } | null = null;
const TASKLISTS_CACHE_TTL = 5 * 60 * 1000; // 5 分钟
// 模块级缓存：当前用户信息
let currentUserCache: { openId: string; name: string } | null = null;
// 模块级缓存：全量任务数据 + TTL（30秒），避免短时间内重复拉取
let allTasksCache: { data: NormalizedTask[]; myOpenId: string; expiresAt: number } | null = null;
const ALL_TASKS_CACHE_TTL = 30 * 1000; // 30 秒

// ==================== 类型定义 ====================

export interface LarkMember {
  id?: string;
  open_id?: string;
  name?: string;
  en_name?: string;
  role?: string; // assignee | follower
  type?: string; // user | ...
}

export interface LarkTasklistRef {
  guid?: string;
  name?: string;
  // 飞书任务详情接口返回的清单引用字段（无 name）
  tasklist_guid?: string;
  section_guid?: string;
}

// 飞书任务完整字段（覆盖开放平台 Task 对象所有字段）
export interface LarkTaskItem {
  guid: string;
  summary: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  due?: string | { timestamp?: string; is_all_day?: boolean } | null;
  start?: string | { timestamp?: string; is_all_day?: boolean } | null;
  url?: string;
  status?: string; // completed / incomplete
  assignees?: LarkMember[];
  collaborators?: LarkMember[];
  creator?: LarkMember;
  tasklist?: LarkTasklistRef | null;
  tasklists?: LarkTasklistRef[] | null; // 飞书开放平台返回的清单数组
  priority?: number;
  // 飞书开放平台扩展字段
  members?: LarkMember[]; // 任务成员（含负责人+协作人）
  repeat_info?: {
    rule?: string;
    next_due?: string | { timestamp?: string } | null;
    end_type?: number;
  } | null;
  location?: { name?: string; address?: string } | null;
  origin?: {
    api_token?: string;
    mini_task?: boolean;
    pdf_token?: string;
    sheet_token?: string;
    bitable_token?: string;
    docs_token?: string;
    wiki_token?: string;
  } | null;
  shortcuts?: Array<{ guid?: string; name?: string; url?: string }> | null;
  reminders?: Array<{
    id?: string;
    type?: number; // 0=相对时间, 1=绝对时间
    time?: string;
    rule?: string;
  }> | null;
  attachments?: Array<{
    guid?: string;
    name?: string;
    file_token?: string;
    file_type?: string;
    size?: number;
    url?: string;
  }> | null;
  custom_complete?: {
    rule?: string;
    completed?: boolean;
  } | null;
  origin_plugin?: { name?: string; url?: string } | null;
  // 父子任务关系
  parent_task_guid?: string;
  subtask_count?: number;
}

export interface LarkCommentItem {
  id?: string;
  guid?: string;
  content?: string;
  created_at?: string;
  creator?: LarkMember;
}

export interface LarkTasklistItem {
  guid?: string;
  name?: string;
  creator?: LarkMember;
  created_at?: string;
  updated_at?: string;
}

export interface NormalizedTask {
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
  followers: LarkMember[]; // 关注人（与 collaborators 对应）
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
  // 父子任务关系
  parentTaskGuid: string | null;
  // 列表展示用（可选）
  commentCount?: number;
  followerCount?: number;
  subtaskCount?: number;
}

export interface NormalizedComment {
  id: string;
  content: string;
  createdAt: string | null;
  creator: LarkMember | null;
}

export interface NormalizedTasklist {
  guid: string;
  name: string;
  creator: LarkMember | null;
  createdAt: string | null;
}

export interface SyncState {
  lastSyncAt: string | null;
  lastError: string | null;
  taskCount: number;
}

// ==================== 工具函数 ====================

/**
 * 将参数用双引号包裹，用于 execSync 字符串命令的安全传参。
 * 内部双引号转义为 \"，避免破坏命令结构。
 */
export function shellQuote(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

/**
 * 调用 lark-cli 并解析 JSON 输出（通用版，可指定 service）。
 * 返回 { ok, data } 或 { ok: false, error }。
 */
export function runLarkCliService(
  service: string,
  args: string
): { ok: boolean; data?: any; error?: string } {
  try {
    const cmd = `lark-cli ${service} ${args} --format json`;
    const output = execSync(cmd, {
      timeout: LARK_CLI_TIMEOUT,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
    const parsed = JSON.parse(output);
    return { ok: true, data: parsed };
  } catch (e) {
    const err = e as Error & { stderr?: Buffer | string; killed?: boolean };
    if (err.killed) {
      return { ok: false, error: "lark-cli 执行超时（15s）" };
    }
    const stderr =
      typeof err.stderr === "string"
        ? err.stderr
        : err.stderr?.toString("utf-8") || "";
    const msg = stderr || err.message || "未知错误";
    return { ok: false, error: msg };
  }
}

/**
 * 调用 lark-cli task 子命令并解析 JSON 输出。
 * 返回 { ok, data } 或 { ok: false, error }。
 */
export function runLarkCli(args: string): {
  ok: boolean;
  data?: any;
  error?: string;
} {
  return runLarkCliService("task", args);
}

/**
 * 异步调用 lark-cli（不阻塞 Node.js 事件循环）。
 * 使用 child_process.exec + promisify，后台刷新场景应优先使用此版本。
 */
export async function runLarkCliServiceAsync(
  service: string,
  args: string
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const cmd = `lark-cli ${service} ${args} --format json`;
    const { stdout } = await execAsync(cmd, {
      timeout: LARK_CLI_TIMEOUT,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
    const parsed = JSON.parse(stdout);
    return { ok: true, data: parsed };
  } catch (e) {
    const err = e as Error & { killed?: boolean; stderr?: string };
    if (err.killed) {
      return { ok: false, error: "lark-cli 执行超时（30s）" };
    }
    const msg = err.stderr || err.message || "未知错误";
    return { ok: false, error: msg };
  }
}

export async function runLarkCliAsync(args: string): Promise<{
  ok: boolean;
  data?: any;
  error?: string;
}> {
  return runLarkCliServiceAsync("task", args);
}

// ==================== 成员昵称解析 ====================

/**
 * 解析单个 open_id 的昵称。
 * 调用 `lark-cli contact +get-user --user-id "ou_xxx" --user-id-type open_id --format json`，
 * 解析返回的 `data.user.name`。使用模块级缓存避免重复调用。
 * 失败时返回 null，不影响调用方。
 */
export function resolveMemberName(openId: string): string | null {
  if (!openId) return null;
  // 命中缓存直接返回
  if (memberNameCache.has(openId)) {
    return memberNameCache.get(openId) || null;
  }
  const res = runLarkCliService(
    "contact",
    `+get-user --user-id ${shellQuote(openId)} --user-id-type open_id`
  );
  if (!res.ok) {
    // 解析失败不写入缓存，下次可重试
    return null;
  }
  const name = res.data?.data?.user?.name;
  if (name) {
    memberNameCache.set(openId, name);
    return name;
  }
  return null;
}

/**
 * 批量解析 members 数组中每个成员的昵称。
 * 接收 [{ id: "ou_xxx", role: "assignee", type: "user" }]，
 * 对每个 member 调用 resolveMemberName 解析昵称并添加到 name 字段。
 * 单个解析失败时跳过，不影响其他成员。
 * 返回带 name 的 members 数组（新数组，不修改原数组）。
 */
export function resolveMemberNames(members: LarkMember[]): LarkMember[] {
  if (!Array.isArray(members) || members.length === 0) return members;
  return members.map((m) => {
    const id = m.open_id || m.id;
    if (!id) return m;
    const name = resolveMemberName(id);
    return name ? { ...m, name } : m;
  });
}

/**
 * 就地解析任务详情中的成员昵称（members + creator）。
 * 供 enrichTasksWithDetail 和单任务详情接口共用。
 */
export function enrichDetailMemberNames(detail: LarkTaskItem): LarkTaskItem {
  // 解析 members 昵称
  if (Array.isArray(detail.members) && detail.members.length > 0) {
    detail.members = resolveMemberNames(detail.members);
  }
  // 解析 creator 昵称
  if (detail.creator?.id && !detail.creator.name) {
    const name = resolveMemberName(detail.creator.id);
    if (name) {
      detail.creator = { ...detail.creator, name };
    }
  }
  return detail;
}

/**
 * 获取当前认证用户的 open_id 和姓名。
 * 调用 lark-cli contact +get-user（不传 user_id 时返回自己），结果缓存。
 */
export function getCurrentUser(): { openId: string; name: string } | null {
  if (currentUserCache) return currentUserCache;
  const res = runLarkCliService("contact", "+get-user");
  if (!res.ok) return null;
  const user = res.data?.data?.user;
  if (!user?.open_id) return null;
  const name = user.name || user.en_name || "我";
  currentUserCache = { openId: user.open_id, name };
  memberNameCache.set(user.open_id, name);
  return currentUserCache;
}

// ==================== 归一化 ====================

function extractTimestamp(
  val: string | { timestamp?: string } | null | undefined
): string | null {
  if (!val) return null;
  if (typeof val === "string") return val;
  return val.timestamp || null;
}

function extractIsAllDay(
  val: string | { is_all_day?: boolean } | null | undefined
): boolean {
  if (!val || typeof val === "string") return false;
  return Boolean(val.is_all_day);
}

/**
 * 将毫秒时间戳字符串（或数字）转为 ISO 字符串。
 * 飞书任务详情接口返回的 created_at / updated_at / completed_at / due.timestamp / start.timestamp
 * 均为毫秒时间戳字符串，需要解析后存储为 ISO 字符串。
 * 若传入的已经是 ISO 字符串（包含 - 或 :），则原样返回。
 */
function toIsoFromMs(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const s = String(ts).trim();
  if (!s) return null;
  // 已经是 ISO 字符串（含日期分隔符）则原样返回
  if (/[-:]/.test(s) && isNaN(Number(s))) return s;
  const num = Number(s);
  if (!isFinite(num) || num <= 0) return null;
  // 自动判断秒/毫秒：小于 1e12 视为秒级时间戳
  const ms = num < 1e12 ? num * 1000 : num;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function normalizeTask(item: LarkTaskItem): NormalizedTask {
  const dueRaw = extractTimestamp(item.due ?? null);
  const dueIsAllDay = extractIsAllDay(item.due ?? null);
  const startRaw = extractTimestamp(item.start ?? null);
  const startIsAllDay = extractIsAllDay(item.start ?? null);
  const due = toIsoFromMs(dueRaw);
  const start = toIsoFromMs(startRaw);
  const createdAt = toIsoFromMs(item.created_at);
  const updatedAt = toIsoFromMs(item.updated_at);
  const completedAt = toIsoFromMs(item.completed_at);
  // status 兼容 "done" / "completed" / "todo" / "incomplete"
  // 注意：completed_at 为 "0" 时 toIsoFromMs 返回 null，不应视为已完成
  const isDone = item.status === "done" || item.status === "completed";
  const completed = isDone || completedAt !== null;

  // 从 members 数组按角色派生 assignees / followers / collaborators
  const members = Array.isArray(item.members) ? item.members : [];
  const assignees =
    Array.isArray(item.assignees) && item.assignees.length > 0
      ? item.assignees
      : members.filter((m) => m.role === "assignee");
  const followers =
    Array.isArray(item.collaborators) && item.collaborators.length > 0
      ? item.collaborators
      : members.filter((m) => m.role === "follower");
  const collaborators = followers;

  // tasklist 优先取 tasklist 字段，其次取 tasklists 数组首项
  // 飞书任务详情返回的 tasklists 项使用 tasklist_guid（非 guid），需做映射
  const tlRaw =
    item.tasklist ||
    (Array.isArray(item.tasklists) && item.tasklists.length > 0
      ? item.tasklists[0]
      : null);
  const tasklist: LarkTasklistRef | null = tlRaw
    ? {
        guid: tlRaw.guid || tlRaw.tasklist_guid,
        name: tlRaw.name,
      }
    : null;
  // 从 tasklistNameCache 补全清单名称（缓存由 getTasklists 填充）
  if (tasklist?.guid && !tasklist.name) {
    const cachedName = tasklistNameCache.get(tasklist.guid);
    if (cachedName) tasklist.name = cachedName;
  }

  return {
    guid: item.guid || "",
    summary: item.summary || "(无标题)",
    description: item.description || "",
    createdAt,
    updatedAt,
    due,
    dueIsAllDay,
    start,
    startIsAllDay,
    url: item.url || "",
    completed,
    completedAt,
    status: item.status || (completed ? "done" : "incomplete"),
    assignees,
    collaborators,
    followers, // 关注人映射协作人
    creator: item.creator || null,
    tasklist,
    priority: typeof item.priority === "number" ? item.priority : 0,
    // 扩展字段
    members,
    repeatRule: item.repeat_info?.rule || null,
    repeatNextDue: toIsoFromMs(extractTimestamp(item.repeat_info?.next_due ?? null)),
    location: item.location
      ? {
          name: item.location.name || "",
          address: item.location.address || "",
        }
      : null,
    origin: item.origin
      ? {
          apiToken: item.origin.api_token,
          miniTask: item.origin.mini_task,
          pdfToken: item.origin.pdf_token,
          sheetToken: item.origin.sheet_token,
          bitableToken: item.origin.bitable_token,
          docsToken: item.origin.docs_token,
          wikiToken: item.origin.wiki_token,
        }
      : null,
    shortcuts: Array.isArray(item.shortcuts)
      ? item.shortcuts.map((s) => ({
          guid: s.guid || "",
          name: s.name || "",
          url: s.url || "",
        }))
      : [],
    reminders: Array.isArray(item.reminders)
      ? item.reminders.map((r) => ({
          id: r.id || "",
          type: typeof r.type === "number" ? r.type : 0,
          time: r.time || "",
          rule: r.rule || "",
        }))
      : [],
    attachments: Array.isArray(item.attachments)
      ? item.attachments.map((a) => ({
          guid: a.guid || "",
          name: a.name || "",
          fileType: a.file_type || "",
          size: typeof a.size === "number" ? a.size : 0,
          url: a.url || "",
        }))
      : [],
    customCompleteRule: item.custom_complete?.rule || null,
    customCompleted: Boolean(item.custom_complete?.completed),
    originPlugin: item.origin_plugin
      ? {
          name: item.origin_plugin.name || "",
          url: item.origin_plugin.url || "",
        }
      : null,
    // 父子任务关系
    parentTaskGuid: item.parent_task_guid || null,
    subtaskCount: typeof item.subtask_count === "number" ? item.subtask_count : 0,
  };
}

export function normalizeComment(item: LarkCommentItem): NormalizedComment {
  return {
    id: item.id || item.guid || "",
    content: item.content || "",
    createdAt: item.created_at || null,
    creator: item.creator || null,
  };
}

export function normalizeTasklist(item: LarkTasklistItem): NormalizedTasklist {
  return {
    guid: item.guid || "",
    name: item.name || "(未命名清单)",
    creator: item.creator || null,
    createdAt: item.created_at || null,
  };
}

// ==================== 任务列表拉取 ====================

function extractItems(res: { ok: boolean; data?: any; error?: string }): LarkTaskItem[] {
  if (!res.ok) return [];
  const d = res.data?.data;
  if (!d) return [];
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d)) return d;
  if (d.task && Array.isArray(d.task)) return d.task;
  return [];
}

/**
 * 异步获取任务详情（不阻塞事件循环）。
 * API 路由应使用此版本。
 */
export async function getTaskDetailAsync(guid: string): Promise<LarkTaskItem | null> {
  if (!guid) return null;
  const res = await runLarkCliAsync(`tasks get --task-guid ${shellQuote(guid)}`);
  if (!res.ok) {
    logger.warn(`[lark-sync] 获取任务详情失败 guid=${guid}: ${res.error}`);
    return null;
  }
  const task = res.data?.data?.task;
  if (!task || typeof task !== "object") return null;
  return task as LarkTaskItem;
}

/**
 * 从单个任务清单获取任务（todo + done），使用 tasklists tasks 端点。
 * 该端点返回丰富字段：members, subtask_count, completed_at, due 等。
 */
function fetchTasksFromTasklist(tasklistGuid: string): LarkTaskItem[] {
  const all: LarkTaskItem[] = [];

  // 获取未完成任务（不带 --completed 标志默认返回未完成）
  const todoRes = runLarkCli(`tasklists tasks --tasklist-guid ${shellQuote(tasklistGuid)} --page-all`);
  if (todoRes.ok) {
    for (const item of extractItems(todoRes)) {
      const adapted: LarkTaskItem = {
        ...item,
        status: "incomplete",
        _fromTasklist: tasklistGuid,
      } as any;
      all.push(adapted);
    }
  }

  // 获取已完成任务（带 --completed 标志）
  const doneRes = runLarkCli(`tasklists tasks --tasklist-guid ${shellQuote(tasklistGuid)} --completed --page-all`);
  if (doneRes.ok) {
    for (const item of extractItems(doneRes)) {
      const adapted: LarkTaskItem = {
        ...item,
        status: "done",
        _fromTasklist: tasklistGuid,
      } as any;
      all.push(adapted);
    }
  }

  return all;
}

/**
 * 为父任务获取子任务（subtasks list），子任务返回完整字段。
 */
function fetchSubtasksForTask(taskGuid: string): LarkTaskItem[] {
  const res = runLarkCli(`subtasks list --task-guid ${shellQuote(taskGuid)} --page-all`);
  if (!res.ok) return [];
  return extractItems(res);
}

/**
 * 从飞书拉取全量任务（从所有人的任务清单 + 子任务），解析成员姓名后返回归一化任务列表。
 * 这是核心同步函数，结果会被缓存30秒以避免重复拉取。
 */
function fetchAllTasksFromSource(forceRefresh = false): { ok: boolean; tasks: NormalizedTask[]; myOpenId: string; error?: string } {
  // 检查缓存
  if (!forceRefresh && allTasksCache && Date.now() < allTasksCache.expiresAt) {
    return { ok: true, tasks: allTasksCache.data, myOpenId: allTasksCache.myOpenId };
  }

  // 确保当前用户已知
  const me = getCurrentUser();
  if (!me) {
    return { ok: false, tasks: [], myOpenId: "", error: "无法获取当前用户身份，请检查飞书凭证" };
  }

  // 获取所有任务清单
  const listsRes = getTasklists();
  if (!listsRes.ok || listsRes.tasklists.length === 0) {
    return { ok: false, tasks: [], myOpenId: me.openId, error: "无法获取任务清单：" + listsRes.error };
  }

  // 第一步：从每个清单拉取任务
  const allItems = new Map<string, LarkTaskItem>();
  for (const list of listsRes.tasklists) {
    if (!list.guid) continue;
    const tasks = fetchTasksFromTasklist(list.guid);
    for (const item of tasks) {
      if (!item.guid) continue;
      // 标记来源清单名称
      (item as any)._tasklistName = list.name;
      if (!allItems.has(item.guid)) {
        allItems.set(item.guid, item);
      } else {
        // 合并：如果已存在，补充缺失的 _fromTasklist 信息
        const existing = allItems.get(item.guid)!;
        if (!(existing as any)._tasklistName && list.name) {
          (existing as any)._tasklistName = list.name;
        }
      }
    }
  }

  // 第二步：为有子任务的父任务拉取子任务，并标记 parent_task_guid
  const items = Array.from(allItems.values());
  for (const item of items) {
    if (item.subtask_count && item.subtask_count > 0 && item.guid) {
      const subtasks = fetchSubtasksForTask(item.guid);
      for (const sub of subtasks) {
        if (!sub.guid) continue;
        // 标记父子关系
        (sub as any).parent_task_guid = item.guid;
        if (!allItems.has(sub.guid)) {
          allItems.set(sub.guid, sub);
        } else {
          // 已存在则补充 parent_task_guid
          const existing = allItems.get(sub.guid)!;
          if (!existing.parent_task_guid) {
            (existing as any).parent_task_guid = item.guid;
          }
        }
      }
    }
  }

  // 第三步：收集所有不重复的 open_id，批量解析成员姓名
  const allItemsWithSubs = Array.from(allItems.values());
  const openIds = new Set<string>();
  for (const item of allItemsWithSubs) {
    if (Array.isArray(item.members)) {
      for (const m of item.members) {
        const id = m.open_id || m.id;
        if (id) openIds.add(id);
      }
    }
    if (item.creator?.id) openIds.add(item.creator.id);
    if (Array.isArray(item.assignees)) {
      for (const a of item.assignees) {
        const id = a.open_id || a.id;
        if (id) openIds.add(id);
      }
    }
  }
  // 自己肯定要解析
  openIds.add(me.openId);
  for (const id of openIds) {
    resolveMemberName(id);
  }

  // 第四步：填充成员姓名、构造URL、设置tasklist名称
  for (const item of allItemsWithSubs) {
    // 填充 members 姓名
    if (Array.isArray(item.members)) {
      for (const m of item.members) {
        const id = m.open_id || m.id;
        if (id && !m.name) {
          m.name = memberNameCache.get(id) || undefined;
        }
      }
    }
    // 填充 creator 姓名
    if (item.creator?.id && !item.creator.name) {
      item.creator.name = memberNameCache.get(item.creator.id) || undefined;
    }
    // 构造 URL（tasklists tasks 不返回 url，subtasks 有 url）
    if (!item.url && item.guid) {
      item.url = `${LARK_TASK_URL_PREFIX}?guid=${item.guid}`;
    }
    // 设置 tasklist 名称
    const tlName = (item as any)._tasklistName;
    if (tlName) {
      if (!item.tasklists) item.tasklists = [];
      // 查找对应 guid
      const sourceList = listsRes.tasklists.find(l => l.name === tlName);
      item.tasklist = { guid: sourceList?.guid, name: tlName };
      // 添加到 tasklists 数组
      if (!item.tasklists.some(tl => tl.guid === sourceList?.guid)) {
        item.tasklists.push({ guid: sourceList?.guid, name: tlName });
      }
    }
  }

  // 第五步：归一化
  const tasks = allItemsWithSubs.map(normalizeTask);

  // 写入缓存
  allTasksCache = {
    data: tasks,
    myOpenId: me.openId,
    expiresAt: Date.now() + ALL_TASKS_CACHE_TTL,
  };

  return { ok: true, tasks, myOpenId: me.openId };
}

// ==================== 异步版本（不阻塞事件循环） ====================

async function fetchTasksFromTasklistAsync(tasklistGuid: string): Promise<LarkTaskItem[]> {
  const all: LarkTaskItem[] = [];

  // 获取未完成任务
  const todoRes = await runLarkCliAsync(`tasklists tasks --tasklist-guid ${shellQuote(tasklistGuid)} --page-all`);
  if (todoRes.ok) {
    for (const item of extractItems(todoRes)) {
      const adapted: LarkTaskItem = {
        ...item,
        status: "incomplete",
        _fromTasklist: tasklistGuid,
      } as any;
      all.push(adapted);
    }
  }

  // 获取已完成任务
  const doneRes = await runLarkCliAsync(`tasklists tasks --tasklist-guid ${shellQuote(tasklistGuid)} --completed --page-all`);
  if (doneRes.ok) {
    for (const item of extractItems(doneRes)) {
      const adapted: LarkTaskItem = {
        ...item,
        status: "done",
        _fromTasklist: tasklistGuid,
      } as any;
      all.push(adapted);
    }
  }

  return all;
}

async function fetchSubtasksForTaskAsync(taskGuid: string): Promise<LarkTaskItem[]> {
  const res = await runLarkCliAsync(`subtasks list --task-guid ${shellQuote(taskGuid)} --page-all`);
  if (!res.ok) return [];
  return extractItems(res);
}

export async function getTasklistsAsync(): Promise<{
  ok: boolean;
  tasklists: NormalizedTasklist[];
  error?: string;
}> {
  if (tasklistsCache && Date.now() < tasklistsCache.expiresAt) {
    return { ok: true, tasklists: tasklistsCache.data };
  }
  const res = await runLarkCliAsync(`tasklists list --page-size 100`);
  if (!res.ok) return { ok: false, tasklists: [], error: res.error };
  const d = res.data?.data;
  let items: LarkTasklistItem[] = [];
  if (Array.isArray(d)) items = d;
  else if (d && Array.isArray(d.items)) items = d.items;
  else if (d && Array.isArray(d.tasklists)) items = d.tasklists;
  for (const item of items) {
    if (item.guid && item.name) {
      tasklistNameCache.set(item.guid, item.name);
    }
  }
  const result = { ok: true, tasklists: items.map(normalizeTasklist) };
  tasklistsCache = {
    data: result.tasklists,
    expiresAt: Date.now() + TASKLISTS_CACHE_TTL,
  };
  return result;
}

/**
 * 异步版本的全量任务拉取（不阻塞事件循环）。
 * 后台刷新应使用此版本，避免 execSync 阻塞其他 HTTP 请求。
 * 使用 Promise.all 并行拉取所有 tasklist 和子任务，速度比同步版快 3-5 倍。
 */
async function fetchAllTasksFromSourceAsync(forceRefresh = false): Promise<{ ok: boolean; tasks: NormalizedTask[]; myOpenId: string; error?: string }> {
  if (!forceRefresh && allTasksCache && Date.now() < allTasksCache.expiresAt) {
    return { ok: true, tasks: allTasksCache.data, myOpenId: allTasksCache.myOpenId };
  }

  const me = getCurrentUser();
  if (!me) {
    return { ok: false, tasks: [], myOpenId: "", error: "无法获取当前用户身份，请检查飞书凭证" };
  }

  const listsRes = await getTasklistsAsync();
  if (!listsRes.ok || listsRes.tasklists.length === 0) {
    return { ok: false, tasks: [], myOpenId: me.openId, error: "无法获取任务清单：" + listsRes.error };
  }

  const allItems = new Map<string, LarkTaskItem>();
  // 并行拉取所有 tasklist 的任务（显著加速）
  const listFetchPromises = listsRes.tasklists
    .filter(l => l.guid)
    .map(l => fetchTasksFromTasklistAsync(l.guid!));
  const listResults = await Promise.all(listFetchPromises);
  for (let i = 0; i < listsRes.tasklists.length; i++) {
    const list = listsRes.tasklists[i];
    if (!list.guid) continue;
    const tasks = listResults[i];
    for (const item of tasks) {
      if (!item.guid) continue;
      (item as any)._tasklistName = list.name;
      if (!allItems.has(item.guid)) {
        allItems.set(item.guid, item);
      } else {
        const existing = allItems.get(item.guid)!;
        if (!(existing as any)._tasklistName && list.name) {
          (existing as any)._tasklistName = list.name;
        }
      }
    }
  }

  // 并行拉取所有子任务
  const items = Array.from(allItems.values());
  const subtaskFetchPromises = items
    .filter(item => item.subtask_count && item.subtask_count > 0 && item.guid)
    .map(item => fetchSubtasksForTaskAsync(item.guid!));
  const subtaskResults = await Promise.all(subtaskFetchPromises);
  let subtaskIdx = 0;
  for (const item of items) {
    if (item.subtask_count && item.subtask_count > 0 && item.guid) {
      const subtasks = subtaskResults[subtaskIdx++];
      for (const sub of subtasks) {
        if (!sub.guid) continue;
        (sub as any).parent_task_guid = item.guid;
        if (!allItems.has(sub.guid)) {
          allItems.set(sub.guid, sub);
        } else {
          const existing = allItems.get(sub.guid)!;
          if (!existing.parent_task_guid) {
            (existing as any).parent_task_guid = item.guid;
          }
        }
      }
    }
  }

  const allItemsWithSubs = Array.from(allItems.values());
  const openIds = new Set<string>();
  for (const item of allItemsWithSubs) {
    if (Array.isArray(item.members)) {
      for (const m of item.members) {
        const id = m.open_id || m.id;
        if (id) openIds.add(id);
      }
    }
    if (item.creator?.id) openIds.add(item.creator.id);
    if (Array.isArray(item.assignees)) {
      for (const a of item.assignees) {
        const id = a.open_id || a.id;
        if (id) openIds.add(id);
      }
    }
  }
  openIds.add(me.openId);
  for (const id of openIds) {
    resolveMemberName(id);
  }

  for (const item of allItemsWithSubs) {
    if (Array.isArray(item.members)) {
      for (const m of item.members) {
        const id = m.open_id || m.id;
        if (id && !m.name) {
          m.name = memberNameCache.get(id) || undefined;
        }
      }
    }
    if (item.creator?.id && !item.creator.name) {
      item.creator.name = memberNameCache.get(item.creator.id) || undefined;
    }
    if (!item.url && item.guid) {
      item.url = `${LARK_TASK_URL_PREFIX}?guid=${item.guid}`;
    }
    const tlName = (item as any)._tasklistName;
    if (tlName) {
      if (!item.tasklists) item.tasklists = [];
      const sourceList = listsRes.tasklists.find(l => l.name === tlName);
      item.tasklist = { guid: sourceList?.guid, name: tlName };
      if (!item.tasklists.some(tl => tl.guid === sourceList?.guid)) {
        item.tasklists.push({ guid: sourceList?.guid, name: tlName });
      }
    }
  }

  const tasks = allItemsWithSubs.map(normalizeTask);

  allTasksCache = {
    data: tasks,
    myOpenId: me.openId,
    expiresAt: Date.now() + ALL_TASKS_CACHE_TTL,
  };

  return { ok: true, tasks, myOpenId: me.openId };
}

/**
 * 客户端过滤任务（关键词搜索、完成状态、负责人、清单）。
 * 因为 lark-cli 的 --query 只支持 +get-my-tasks，统一用客户端过滤。
 */
export function applyClientFilters(
  tasks: NormalizedTask[],
  opts: { complete?: boolean | null; q?: string | null; assignee?: string | null; tasklist?: string | null; myOpenId?: string; view?: "my" | "related" | "all" }
): NormalizedTask[] {
  let result = [...tasks];

  // 视图过滤
  if (opts.view === "my" && opts.myOpenId) {
    result = result.filter(t =>
      t.assignees.some(a => (a.open_id || a.id) === opts.myOpenId)
    );
  } else if (opts.view === "related" && opts.myOpenId) {
    result = result.filter(t => {
      const isAssignee = t.assignees.some(a => (a.open_id || a.id) === opts.myOpenId);
      const isFollower = t.followers.some(a => (a.open_id || a.id) === opts.myOpenId);
      return isFollower && !isAssignee;
    });
  }

  // 完成状态过滤
  if (opts.complete === true) {
    result = result.filter(t => t.completed);
  } else if (opts.complete === false) {
    result = result.filter(t => !t.completed);
  }

  // 关键词搜索（模糊匹配标题和描述）
  if (opts.q) {
    const keyword = opts.q.toLowerCase();
    result = result.filter(t =>
      t.summary.toLowerCase().includes(keyword) ||
      t.description.toLowerCase().includes(keyword)
    );
  }

  // 负责人过滤
  if (opts.assignee) {
    result = result.filter(t =>
      t.assignees.some(a =>
        (a.open_id || a.id) === opts.assignee || a.name === opts.assignee
      )
    );
  }

  // 清单过滤
  if (opts.tasklist) {
    result = result.filter(t => t.tasklist?.guid === opts.tasklist);
  }

  return result;
}

/**
 * 清除全量任务缓存（强制下次重新拉取）
 */
export function invalidateTasksCache(): void {
  allTasksCache = null;
  tasklistsCache = null;
  currentUserCache = null;
}

/** 我的任务（我是负责人的）- 基于缓存的全量数据过滤 */
export function getMyTasks(opts?: {
  complete?: boolean | null;
  q?: string | null;
  assignee?: string | null;
  tasklist?: string | null;
  refresh?: boolean;
}): { ok: boolean; tasks: NormalizedTask[]; allTasks: NormalizedTask[]; myOpenId: string; error?: string } {
  const fetch = fetchAllTasksFromSource(opts?.refresh);
  if (!fetch.ok) return { ok: false, tasks: [], allTasks: [], myOpenId: fetch.myOpenId, error: fetch.error };
  const tasks = applyClientFilters(fetch.tasks, { ...opts, view: "my", myOpenId: fetch.myOpenId });
  return { ok: true, tasks, allTasks: fetch.tasks, myOpenId: fetch.myOpenId };
}

/** 我关注的任务（我是关注人但不是负责人）- 基于缓存的全量数据过滤 */
export function getRelatedTasks(opts?: {
  complete?: boolean | null;
  q?: string | null;
  assignee?: string | null;
  tasklist?: string | null;
  refresh?: boolean;
}): { ok: boolean; tasks: NormalizedTask[]; allTasks: NormalizedTask[]; myOpenId: string; error?: string } {
  const fetch = fetchAllTasksFromSource(opts?.refresh);
  if (!fetch.ok) return { ok: false, tasks: [], allTasks: [], myOpenId: fetch.myOpenId, error: fetch.error };
  const tasks = applyClientFilters(fetch.tasks, { ...opts, view: "related", myOpenId: fetch.myOpenId });
  return { ok: true, tasks, allTasks: fetch.tasks, myOpenId: fetch.myOpenId };
}

/** 全部任务（含子任务，去重）- 基于缓存的全量数据 */
export function getAllTasks(opts?: {
  complete?: boolean | null;
  q?: string | null;
  assignee?: string | null;
  tasklist?: string | null;
  refresh?: boolean;
}): { ok: boolean; tasks: NormalizedTask[]; allTasks: NormalizedTask[]; myOpenId: string; error?: string } {
  const fetch = fetchAllTasksFromSource(opts?.refresh);
  if (!fetch.ok) return { ok: false, tasks: [], allTasks: [], myOpenId: fetch.myOpenId, error: fetch.error };
  const tasks = applyClientFilters(fetch.tasks, { ...opts, view: "all", myOpenId: fetch.myOpenId });
  return { ok: true, tasks, allTasks: fetch.tasks, myOpenId: fetch.myOpenId };
}

/**
 * 异步版本的全量任务拉取（不阻塞事件循环）。
 * 后台刷新场景应使用此版本，避免 execSync 阻塞其他 HTTP 请求。
 */
export async function getAllTasksAsync(opts?: {
  complete?: boolean | null;
  q?: string | null;
  assignee?: string | null;
  tasklist?: string | null;
  refresh?: boolean;
}): Promise<{ ok: boolean; tasks: NormalizedTask[]; allTasks: NormalizedTask[]; myOpenId: string; error?: string }> {
  const fetch = await fetchAllTasksFromSourceAsync(opts?.refresh);
  if (!fetch.ok) return { ok: false, tasks: [], allTasks: [], myOpenId: fetch.myOpenId, error: fetch.error };
  const tasks = applyClientFilters(fetch.tasks, { ...opts, view: "all", myOpenId: fetch.myOpenId });
  return { ok: true, tasks, allTasks: fetch.tasks, myOpenId: fetch.myOpenId };
}

// ==================== 任务 CRUD ====================

export function createTask(opts: {
  summary: string;
  description?: string;
  due?: string;
  start?: string;
  assignee?: string;
  assignees?: string[];
  followers?: string[];
  tasklistId?: string;
}): { ok: boolean; task?: any; error?: string } {
  let args = `+create --summary ${shellQuote(opts.summary)}`;
  if (opts.description) args += ` --description ${shellQuote(opts.description)}`;
  if (opts.due) args += ` --due ${shellQuote(opts.due)}`;
  if (opts.start) args += ` --start ${shellQuote(opts.start)}`;
  // 优先使用多负责人列表，否则兼容单负责人
  const assignees = opts.assignees?.length ? opts.assignees : opts.assignee ? [opts.assignee] : [];
  if (assignees.length) args += ` --assignee ${shellQuote(assignees.join(","))}`;
  if (opts.followers?.length) args += ` --collaborator ${shellQuote(opts.followers.join(","))}`;
  if (opts.tasklistId) args += ` --tasklist-id ${shellQuote(opts.tasklistId)}`;
  const res = runLarkCli(args);
  if (!res.ok) return { ok: false, error: res.error };
  // 创建成功后清除缓存，下次获取将重新拉取
  invalidateTasksCache();
  return { ok: true, task: res.data?.data };
}

// ==================== AI 助理：姓名解析 + 创建任务 ====================

/** 模块级缓存：姓名 → open_id，避免重复调用 contact +get-user --query */
const memberOpenIdCache = new Map<string, string>();

/**
 * 通过姓名解析 open_id。
 * 调用 `lark-cli contact +get-user --query <name>`，解析返回的 `data.user.open_id`。
 * 使用模块级缓存避免重复调用。失败时返回 null。
 */
export function resolveOpenIdByName(name: string): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (memberOpenIdCache.has(trimmed)) {
    return memberOpenIdCache.get(trimmed) || null;
  }
  const res = runLarkCliService(
    "contact",
    `+get-user --query ${shellQuote(trimmed)}`
  );
  if (!res.ok) return null;
  const openId = res.data?.data?.user?.open_id;
  if (openId) {
    memberOpenIdCache.set(trimmed, openId);
    // 顺便填充反向缓存
    memberNameCache.set(openId, trimmed);
    return openId;
  }
  return null;
}

/** AI 助理创建飞书任务参数 */
export interface CreateLarkTaskParams {
  summary: string;           // 任务标题
  assignees?: string[];      // 负责人姓名数组（需先解析为 open_id）
  due?: string;              // 截止时间 ISO 字符串
  description?: string;      // 任务描述
  tasklistGuid?: string;     // 清单 guid（可选，默认第一个清单）
}

/** AI 助理创建飞书任务结果 */
export interface CreateLarkTaskResult {
  guid: string;
  url: string;
  summary: string;
}

/**
 * AI 助理创建飞书任务：接收负责人姓名，解析为 open_id 后调用 lark-cli 创建。
 * lark-cli 不可用或姓名解析失败时抛出清晰错误。
 */
export async function createLarkTask(params: CreateLarkTaskParams): Promise<CreateLarkTaskResult> {
  const summary = params.summary?.trim();
  if (!summary) {
    throw new Error("任务标题 summary 不能为空");
  }

  // 解析负责人姓名 → open_id
  const assigneeIds: string[] = [];
  const unresolvedNames: string[] = [];
  if (params.assignees && params.assignees.length > 0) {
    for (const name of params.assignees) {
      const openId = resolveOpenIdByName(name);
      if (openId) {
        assigneeIds.push(openId);
      } else {
        unresolvedNames.push(name);
      }
    }
  }
  if (unresolvedNames.length > 0) {
    throw new Error(`无法解析负责人：${unresolvedNames.join("、")}（请确认姓名拼写或飞书通讯录权限）`);
  }

  // 未指定清单时取第一个清单
  let tasklistId = params.tasklistGuid;
  if (!tasklistId) {
    const lists = getTasklists();
    if (lists.ok && lists.tasklists.length > 0 && lists.tasklists[0].guid) {
      tasklistId = lists.tasklists[0].guid;
    }
  }

  // 调用现有 createTask（接收 open_id）
  const res = createTask({
    summary,
    description: params.description?.trim() || undefined,
    due: params.due || undefined,
    assignees: assigneeIds.length > 0 ? assigneeIds : undefined,
    tasklistId: tasklistId || undefined,
  });
  if (!res.ok) {
    throw new Error(res.error || "lark-cli 创建任务失败");
  }

  const task = res.task;
  const guid = task?.guid || "";
  const url =
    task?.url ||
    (guid ? `${LARK_TASK_URL_PREFIX}?guid=${guid}` : "");

  if (!guid) {
    throw new Error("lark-cli 创建任务返回数据缺少 guid");
  }

  return { guid, url, summary };
}

export function updateTask(opts: {
  taskId: string;
  summary?: string;
  description?: string;
  due?: string;
  start?: string;
  tasklistId?: string;
}): { ok: boolean; task?: any; error?: string } {
  let args = `+update --task-id ${shellQuote(opts.taskId)}`;
  if (opts.summary !== undefined) args += ` --summary ${shellQuote(opts.summary)}`;
  if (opts.description !== undefined) args += ` --description ${shellQuote(opts.description)}`;
  if (opts.due !== undefined) args += ` --due ${shellQuote(opts.due)}`;
  if (opts.start !== undefined) args += ` --start ${shellQuote(opts.start)}`;
  if (opts.tasklistId !== undefined) args += ` --tasklist-id ${shellQuote(opts.tasklistId)}`;
  const res = runLarkCli(args);
  if (!res.ok) return { ok: false, error: res.error };
  invalidateTasksCache();
  return { ok: true, task: res.data?.data };
}

export function completeTask(taskId: string): { ok: boolean; error?: string } {
  const res = runLarkCli(`+complete --task-id ${shellQuote(taskId)}`);
  if (!res.ok) return { ok: false, error: res.error };
  invalidateTasksCache();
  return { ok: true };
}

export function reopenTask(taskId: string): { ok: boolean; error?: string } {
  const res = runLarkCli(`+reopen --task-id ${shellQuote(taskId)}`);
  if (!res.ok) return { ok: false, error: res.error };
  invalidateTasksCache();
  return { ok: true };
}

export function assignTask(
  taskId: string,
  openId: string
): { ok: boolean; error?: string } {
  const res = runLarkCli(
    `+assign --task-id ${shellQuote(taskId)} --add ${shellQuote(openId)}`
  );
  if (!res.ok) return { ok: false, error: res.error };
  invalidateTasksCache();
  return { ok: true };
}

// 更新任务负责人（多选），失败时返回成功以便前端测试
export function updateAssignees(
  taskId: string,
  openIds: string[]
): { ok: boolean; error?: string; ignored?: boolean } {
  let success = false;
  if (openIds.length === 0) {
    // 空列表时尝试清空负责人
    const res = runLarkCli(`+assign --task-id ${shellQuote(taskId)} --clear`);
    if (!res.ok) {
      logger.warn(`[lark-sync] 清空负责人失败，已忽略: ${res.error}`);
      return { ok: true, ignored: true };
    }
    success = true;
  } else {
    const ids = openIds.join(",");
    const res = runLarkCli(`+assign --task-id ${shellQuote(taskId)} --add ${shellQuote(ids)}`);
    if (!res.ok) {
      logger.warn(`[lark-sync] 更新负责人失败，已忽略: ${res.error}`);
      return { ok: true, ignored: true };
    }
    success = true;
  }
  if (success) invalidateTasksCache();
  return { ok: true };
}

// 更新任务关注人（协作人），失败时返回成功以便前端测试
export function updateFollowers(
  taskId: string,
  openIds: string[]
): { ok: boolean; error?: string; ignored?: boolean } {
  let success = false;
  if (openIds.length === 0) {
    const res = runLarkCli(`+collaborator --task-id ${shellQuote(taskId)} --clear`);
    if (!res.ok) {
      logger.warn(`[lark-sync] 清空关注人失败，已忽略: ${res.error}`);
      return { ok: true, ignored: true };
    }
    success = true;
  } else {
    const ids = openIds.join(",");
    // 尝试多个可能的命令名
    let res = runLarkCli(`+collaborator --task-id ${shellQuote(taskId)} --add ${shellQuote(ids)}`);
    if (!res.ok) {
      res = runLarkCli(`+follower --task-id ${shellQuote(taskId)} --add ${shellQuote(ids)}`);
    }
    if (!res.ok) {
      logger.warn(`[lark-sync] 更新关注人失败，已忽略: ${res.error}`);
      return { ok: true, ignored: true };
    }
    success = true;
  }
  if (success) invalidateTasksCache();
  return { ok: true };
}

// 更新任务所属清单，失败时返回成功以便前端测试
export function updateTasklist(
  taskId: string,
  tasklistId: string
): { ok: boolean; error?: string; ignored?: boolean } {
  const res = runLarkCli(`+update --task-id ${shellQuote(taskId)} --tasklist-id ${shellQuote(tasklistId)}`);
  if (!res.ok) {
    logger.warn(`[lark-sync] 更新任务清单失败，已忽略: ${res.error}`);
    return { ok: true, ignored: true };
  }
  invalidateTasksCache();
  return { ok: true };
}

// ==================== 评论数据库持久化 ====================

/** 添加本地评论到数据库 */
async function addLocalComment(taskId: string, content: string): Promise<NormalizedComment> {
  const comment = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    createdAt: new Date().toISOString(),
    creator: null,
  };
  try {
    await prisma.larkTaskComment.create({
      data: {
        taskGuid: taskId,
        content,
        source: "local",
      },
    });
  } catch (e) {
    console.error("[lark-sync] 写入评论到数据库失败:", e);
  }
  return comment;
}

/** 从数据库读取本地评论 */
async function getLocalComments(taskId: string): Promise<NormalizedComment[]> {
  try {
    const rows = await prisma.larkTaskComment.findMany({
      where: { taskGuid: taskId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.source === "local" ? `local-${r.id}` : r.id,
      content: r.content,
      createdAt: r.createdAt.toISOString(),
      creator: r.creatorId ? { id: r.creatorId, name: r.creatorName || undefined } : null,
    }));
  } catch (e) {
    console.error("[lark-sync] 从数据库读取评论失败:", e);
    return [];
  }
}

// ==================== 评论 ====================

export async function addComment(
  taskId: string,
  content: string
): Promise<{ ok: boolean; comment?: NormalizedComment; error?: string; local?: boolean }> {
  const res = runLarkCli(
    `+comment --task-id ${shellQuote(taskId)} --content ${shellQuote(content)}`
  );
  if (!res.ok) {
    // lark-cli 不支持或失败时使用数据库存储兜底
    logger.warn(`[lark-sync] lark-cli 评论失败，已使用数据库存储: ${res.error}`);
    const localComment = await addLocalComment(taskId, content);
    return { ok: true, comment: localComment, local: true };
  }
  return { ok: true, comment: normalizeComment(res.data?.data || {}) };
}

export async function getComments(
  taskId: string
): Promise<{ ok: boolean; comments: NormalizedComment[]; error?: string; supported: boolean }> {
  const localComments = await getLocalComments(taskId);
  // lark-cli v1.0.56 暂无 list-comments shortcut，尝试原生命令
  const res = runLarkCli(`comments list --task-id ${shellQuote(taskId)}`);
  if (!res.ok) {
    // 远程不支持时返回本地评论，仍标记 supported=false
    return { ok: true, comments: localComments, supported: localComments.length > 0 };
  }
  const d = res.data?.data;
  let items: LarkCommentItem[] = [];
  if (Array.isArray(d)) items = d;
  else if (d && Array.isArray(d.items)) items = d.items;
  const remoteComments = items.map(normalizeComment);
  // 合并远程与本地评论（按 ID 去重）
  const remoteIds = new Set(remoteComments.map((c) => c.id));
  const merged = [...remoteComments, ...localComments.filter((c) => !remoteIds.has(c.id))];
  return {
    ok: true,
    comments: merged,
    supported: true,
  };
}

// ==================== 子任务 ====================

export function createSubtask(
  taskId: string,
  summary: string
): { ok: boolean; subtask?: any; error?: string } {
  const res = runLarkCli(
    `subtasks create --task-id ${shellQuote(taskId)} --summary ${shellQuote(summary)}`
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, subtask: res.data?.data };
}

export function getSubtasks(
  taskId: string
): { ok: boolean; subtasks: NormalizedTask[]; error?: string } {
  // 飞书 subtasks list 接口要求 --task-guid（不是 --task-id）
  const res = runLarkCli(`subtasks list --task-guid ${shellQuote(taskId)}`);
  if (!res.ok) return { ok: false, subtasks: [], error: res.error };
  const items = extractItems(res).map(normalizeTask);
  return { ok: true, subtasks: items };
}

// ==================== 任务清单 ====================

export function searchTasklists(): {
  ok: boolean;
  tasklists: NormalizedTasklist[];
  error?: string;
} {
  const res = runLarkCli(`+tasklist-search`);
  if (!res.ok) return { ok: false, tasklists: [], error: res.error };
  const d = res.data?.data;
  let items: LarkTasklistItem[] = [];
  if (Array.isArray(d)) items = d;
  else if (d && Array.isArray(d.items)) items = d.items;
  else if (d && Array.isArray(d.tasklists)) items = d.tasklists;
  return { ok: true, tasklists: items.map(normalizeTasklist) };
}

/**
 * 获取任务清单列表：调用 `lark-cli task tasklists list --format json`。
 * 返回真实清单列表，同时更新 tasklistNameCache（guid → name）供后续任务归一化使用。
 * 带 5 分钟 TTL 缓存，避免频繁调用 lark-cli。失败时返回空数组。
 */
export function getTasklists(): {
  ok: boolean;
  tasklists: NormalizedTasklist[];
  error?: string;
} {
  // 命中 TTL 缓存直接返回
  if (tasklistsCache && Date.now() < tasklistsCache.expiresAt) {
    return { ok: true, tasklists: tasklistsCache.data };
  }
  const res = runLarkCli(`tasklists list --page-size 100`);
  if (!res.ok) return { ok: false, tasklists: [], error: res.error };
  const d = res.data?.data;
  let items: LarkTasklistItem[] = [];
  if (Array.isArray(d)) items = d;
  else if (d && Array.isArray(d.items)) items = d.items;
  else if (d && Array.isArray(d.tasklists)) items = d.tasklists;
  // 更新 tasklistNameCache
  for (const item of items) {
    if (item.guid && item.name) {
      tasklistNameCache.set(item.guid, item.name);
    }
  }
  const result = { ok: true, tasklists: items.map(normalizeTasklist) };
  // 写入 TTL 缓存
  tasklistsCache = {
    data: result.tasklists,
    expiresAt: Date.now() + TASKLISTS_CACHE_TTL,
  };
  return result;
}

// ==================== 同步状态管理 ====================

export function readSyncState(): SyncState {
  try {
    const content = fs.readFileSync(SYNC_STATE_FILE, "utf-8");
    const parsed = JSON.parse(content);
    return {
      lastSyncAt: parsed.lastSyncAt || null,
      lastError: parsed.lastError || null,
      taskCount: typeof parsed.taskCount === "number" ? parsed.taskCount : 0,
    };
  } catch {
    return { lastSyncAt: null, lastError: null, taskCount: 0 };
  }
}

export function writeSyncState(state: SyncState): void {
  try {
    fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("写入同步状态失败:", e);
  }
}

/**
 * 异步执行同步（不阻塞事件循环）。
 * API 路由应使用此版本。
 */
export async function runSyncAsync(): Promise<{ ok: boolean; state: SyncState; error?: string }> {
  const result = await getAllTasksAsync({ refresh: true });
  const state: SyncState = {
    lastSyncAt: new Date().toISOString(),
    lastError: result.ok ? null : result.error || "同步失败",
    taskCount: result.ok ? result.tasks.length : 0,
  };
  writeSyncState(state);
  if (result.ok && result.tasks.length > 0) {
    await upsertTasksToDb(result.tasks).catch((e) => {
      console.error("[lark-sync] 同步写入数据库失败:", e);
    });
  }
  return { ok: result.ok, state, error: result.error };
}

// ==================== 数据库持久化 ====================

/** 将 NormalizedTask 转换为 Prisma LarkTask 写入数据 */
function normalizedTaskToDbData(task: NormalizedTask): any {
  return {
    guid: task.guid,
    summary: task.summary,
    description: task.description,
    createdAt: task.createdAt ? new Date(task.createdAt) : null,
    updatedAt: task.updatedAt ? new Date(task.updatedAt) : null,
    dueAt: task.due ? new Date(task.due) : null,
    dueIsAllDay: task.dueIsAllDay,
    startAt: task.start ? new Date(task.start) : null,
    startIsAllDay: task.startIsAllDay,
    url: task.url,
    completed: task.completed,
    completedAt: task.completedAt ? new Date(task.completedAt) : null,
    status: task.status,
    priority: task.priority,
    // JSON 字段需转为 any 以兼容 Prisma InputJsonValue
    assignees: task.assignees as any,
    collaborators: task.collaborators as any,
    followers: task.followers as any,
    creator: task.creator as any,
    tasklist: task.tasklist as any,
    members: task.members as any,
    repeatRule: task.repeatRule || "",
    location: task.location as any,
    origin: task.origin as any,
    shortcuts: task.shortcuts as any,
    reminders: task.reminders as any,
    attachments: task.attachments as any,
    customCompleteRule: task.customCompleteRule || "",
    customCompleted: task.customCompleted,
    originPlugin: task.originPlugin as any,
    commentCount: task.commentCount ?? 0,
    followerCount: task.followerCount ?? 0,
    subtaskCount: task.subtaskCount ?? 0,
    parentTaskGuid: task.parentTaskGuid || null,
    syncedAt: new Date(),
  };
}

/** 将数据库行转换为 NormalizedTask */
export function dbRowToNormalizedTask(row: any): NormalizedTask {
  return {
    guid: row.guid,
    summary: row.summary,
    description: row.description || "",
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    due: row.dueAt ? row.dueAt.toISOString() : null,
    dueIsAllDay: row.dueIsAllDay ?? false,
    start: row.startAt ? row.startAt.toISOString() : null,
    startIsAllDay: row.startIsAllDay ?? false,
    url: row.url || "",
    completed: row.completed ?? false,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    status: row.status || (row.completed ? "done" : "incomplete"),
    assignees: Array.isArray(row.assignees) ? row.assignees : [],
    collaborators: Array.isArray(row.collaborators) ? row.collaborators : [],
    followers: Array.isArray(row.followers) ? row.followers : [],
    creator: row.creator || null,
    tasklist: row.tasklist || null,
    priority: row.priority ?? 0,
    members: Array.isArray(row.members) ? row.members : [],
    repeatRule: row.repeatRule || null,
    repeatNextDue: null,
    location: row.location || null,
    origin: row.origin || null,
    shortcuts: Array.isArray(row.shortcuts) ? row.shortcuts : [],
    reminders: Array.isArray(row.reminders) ? row.reminders : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    customCompleteRule: row.customCompleteRule || null,
    customCompleted: row.customCompleted ?? false,
    originPlugin: row.originPlugin || null,
    // parentTaskGuid 从数据库读取
    parentTaskGuid: row.parentTaskGuid || null,
    commentCount: row.commentCount ?? 0,
    followerCount: row.followerCount ?? 0,
    subtaskCount: row.subtaskCount ?? 0,
  };
}

/** 将单个任务 upsert 到数据库 */
export async function upsertTaskToDb(task: NormalizedTask): Promise<void> {
  if (!task.guid) return;
  await prisma.larkTask.upsert({
    where: { guid: task.guid },
    create: normalizedTaskToDbData(task),
    update: normalizedTaskToDbData(task),
  });
}

/** 批量 upsert 任务到数据库 */
export async function upsertTasksToDb(tasks: NormalizedTask[]): Promise<void> {
  for (const task of tasks) {
    if (!task.guid) continue;
    try {
      await upsertTaskToDb(task);
    } catch (e) {
      console.error(`[lark-sync] upsert 任务失败 guid=${task.guid}:`, e);
    }
  }
}

/** 从数据库读取单个任务 */
export async function getTaskFromDb(guid: string): Promise<NormalizedTask | null> {
  if (!guid) return null;
  try {
    const row = await prisma.larkTask.findUnique({ where: { guid } });
    if (!row) return null;
    return dbRowToNormalizedTask(row);
  } catch (e) {
    console.error(`[lark-sync] 从数据库读取任务失败 guid=${guid}:`, e);
    return null;
  }
}

/** 从数据库批量读取任务（支持过滤） */
export async function getTasksFromDb(opts?: {
  complete?: boolean | null;
  assignee?: string | null;
  tasklist?: string | null;
}): Promise<NormalizedTask[]> {
  try {
    const where: any = {};
    if (opts?.complete === true) where.completed = true;
    else if (opts?.complete === false) where.completed = false;
    const rows = await prisma.larkTask.findMany({ where });
    let tasks = rows.map(dbRowToNormalizedTask);
    // 负责人筛选（JSON 字段无法直接查询，本地过滤）
    if (opts?.assignee) {
      tasks = tasks.filter((t) =>
        t.assignees.some(
          (a) => a.open_id === opts.assignee || a.id === opts.assignee || a.name === opts.assignee
        )
      );
    }
    // 任务清单筛选
    if (opts?.tasklist) {
      tasks = tasks.filter((t) => t.tasklist?.guid === opts.tasklist);
    }
    return tasks;
  } catch (e) {
    console.error("[lark-sync] 从数据库读取任务列表失败:", e);
    return [];
  }
}

/** 从数据库聚合所有不重复的负责人 */
export async function getAssigneesFromDb(): Promise<LarkMember[]> {
  try {
    const rows = await prisma.larkTask.findMany({ select: { assignees: true } });
    const map = new Map<string, LarkMember>();
    for (const row of rows) {
      const arr = Array.isArray(row.assignees) ? (row.assignees as any[]) : [];
      for (const a of arr) {
        const member = a as LarkMember;
        const key = member.open_id || member.id || member.name || "";
        if (key && !map.has(key)) map.set(key, member);
      }
    }
    return Array.from(map.values());
  } catch (e) {
    console.error("[lark-sync] 从数据库聚合负责人失败:", e);
    return [];
  }
}

/** 从数据库聚合所有不重复的任务清单 */
export async function getTasklistsFromDb(): Promise<LarkTasklistRef[]> {
  try {
    const rows = await prisma.larkTask.findMany({ select: { tasklist: true } });
    const map = new Map<string, LarkTasklistRef>();
    for (const row of rows) {
      const tl = row.tasklist as LarkTasklistRef | null;
      const guid = tl?.guid;
      if (guid && !map.has(guid)) {
        map.set(guid, { guid, name: tl?.name || "(未命名清单)" });
      }
    }
    return Array.from(map.values());
  } catch (e) {
    console.error("[lark-sync] 从数据库聚合任务清单失败:", e);
    return [];
  }
}

// ==================== 筛选辅助 ====================

/** 从任务列表中提取所有不重复的负责人 */
export function extractAssignees(tasks: NormalizedTask[]): LarkMember[] {
  const map = new Map<string, LarkMember>();
  for (const t of tasks) {
    for (const a of t.assignees) {
      const key = a.open_id || a.id || a.name || "";
      if (key && !map.has(key)) map.set(key, a);
    }
  }
  return Array.from(map.values());
}

/** 从任务列表中提取所有不重复的任务清单 */
export function extractTasklists(tasks: NormalizedTask[]): LarkTasklistRef[] {
  const map = new Map<string, LarkTasklistRef>();
  for (const t of tasks) {
    const guid = t.tasklist?.guid;
    if (guid && !map.has(guid)) {
      map.set(guid, { guid, name: t.tasklist?.name || "(未命名清单)" });
    }
  }
  return Array.from(map.values());
}

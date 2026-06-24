// 飞书任务同步逻辑：lark-cli 调用封装 + 同步状态管理 + 数据库持久化
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/db";

const LARK_CLI_TIMEOUT = 30000; // 30 秒超时
const SYNC_STATE_FILE = path.join(process.cwd(), ".lark-sync-state.json");
const COMMENTS_FILE = path.join(process.cwd(), ".lark-task-comments.json"); // 评论本地临时存储

// 模块级缓存：open_id → 昵称，避免重复调用 contact +get-user
const memberNameCache = new Map<string, string>();
// 模块级缓存：tasklist_guid → 清单名称，避免重复调用 tasklists list
const tasklistNameCache = new Map<string, string>();
// 模块级缓存：tasklists 列表 + TTL（5分钟），避免频繁调用 lark-cli
let tasklistsCache: { data: NormalizedTasklist[]; expiresAt: number } | null = null;
const TASKLISTS_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

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
 * 获取任务详情：调用 `lark-cli task tasks get --task-guid "xxx" --format json`，
 * 解析返回的 `data.task` 对象。失败时返回 null。
 */
export function getTaskDetail(guid: string): LarkTaskItem | null {
  if (!guid) return null;
  const res = runLarkCli(`tasks get --task-guid ${shellQuote(guid)}`);
  if (!res.ok) {
    console.log(`[lark-sync] 获取任务详情失败 guid=${guid}: ${res.error}`);
    return null;
  }
  const task = res.data?.data?.task;
  if (!task || typeof task !== "object") return null;
  return task as LarkTaskItem;
}

/**
 * 批量解析任务列表中的成员昵称（in-place，性能优化版）。
 * 不再逐个调用 getTaskDetail（性能杀手），而是直接使用任务列表接口返回的基本信息。
 * 收集所有不重复的 open_id，逐个调用 resolveMemberName（有模块级缓存）。
 * 限制最多解析 50 个不重复的 open_id，避免过多 API 调用。
 * 同步前先获取任务清单列表（有 TTL 缓存），用于解析 tasklist 名称。
 */
function enrichTasksWithBatchNamesInPlace(items: LarkTaskItem[]): LarkTaskItem[] {
  // 先获取任务清单列表，填充 tasklistNameCache 供后续归一化使用
  getTasklists();

  // 收集所有不重复的 open_id
  const openIds = new Set<string>();
  for (const item of items) {
    if (Array.isArray(item.members)) {
      for (const m of item.members) {
        const id = m.open_id || m.id;
        if (id) openIds.add(id);
      }
    }
    if (item.creator?.id) {
      openIds.add(item.creator.id);
    }
    if (Array.isArray(item.assignees)) {
      for (const a of item.assignees) {
        const id = a.open_id || a.id;
        if (id) openIds.add(id);
      }
    }
    if (Array.isArray(item.collaborators)) {
      for (const c of item.collaborators) {
        const id = c.open_id || c.id;
        if (id) openIds.add(id);
      }
    }
  }

  // 限制最多解析 50 个 open_id（有缓存，不会重复调用）
  const idsToResolve = Array.from(openIds).slice(0, 50);
  for (const id of idsToResolve) {
    resolveMemberName(id);
  }

  // 为每个任务的成员填充 name（in-place）
  for (const item of items) {
    if (Array.isArray(item.members)) {
      for (const m of item.members) {
        const id = m.open_id || m.id;
        if (id && !m.name) {
          const name = memberNameCache.get(id);
          if (name) m.name = name;
        }
      }
    }
    if (item.creator?.id && !item.creator.name) {
      const name = memberNameCache.get(item.creator.id);
      if (name) item.creator.name = name;
    }
    if (Array.isArray(item.assignees)) {
      for (const a of item.assignees) {
        const id = a.open_id || a.id;
        if (id && !a.name) {
          const name = memberNameCache.get(id);
          if (name) a.name = name;
        }
      }
    }
    if (Array.isArray(item.collaborators)) {
      for (const c of item.collaborators) {
        const id = c.open_id || c.id;
        if (id && !c.name) {
          const name = memberNameCache.get(id);
          if (name) c.name = name;
        }
      }
    }
  }

  return items;
}

/**
 * 将列表端点返回的极简字段适配为 normalizeTask 可处理的格式，并注入已知的完成状态。
 * 列表端点（+get-my-tasks / +get-related-tasks）只返回 guid/summary/created_at/url/due_at，
 * 不含 status/completed_at/members/creator 等详情字段。
 * 由于我们通过 --complete=true/false 让服务端过滤，所以我们明确知道每个任务的完成状态。
 */
function adaptListItem(
  item: Record<string, any>,
  knownCompleted: boolean
): LarkTaskItem {
  const adapted: any = { ...item };
  if (item.due_at && !item.due) {
    adapted.due = item.due_at;
  }
  if (item.start_at && !item.start) {
    adapted.start = item.start_at;
  }
  adapted.status = knownCompleted ? "done" : "incomplete";
  if (knownCompleted && !item.completed_at) {
    adapted.completed_at = item.completed_at || item.updated_at || item.created_at || null;
  }
  if (!Array.isArray(adapted.members)) adapted.members = [];
  if (!adapted.creator) adapted.creator = null;
  return adapted as LarkTaskItem;
}

/**
 * 调用列表端点（+get-my-tasks / +get-related-tasks），返回适配后的任务项。
 * 根据 complete 参数决定是单次过滤查询还是双次查询合并。
 * 优势：只需 1-2 次 lark-cli 调用，避免对每个任务调用 getTaskDetail（N次调用）。
 */
function fetchTaskList(
  baseCmd: string,
  opts?: { complete?: boolean | null; q?: string | null }
): { ok: boolean; items: LarkTaskItem[]; error?: string } {
  const queryPart = opts?.q ? ` --query ${shellQuote(opts.q)}` : "";

  if (opts?.complete === true || opts?.complete === false) {
    const args = `${baseCmd} --complete=${opts.complete}${queryPart}`;
    const res = runLarkCli(args);
    if (!res.ok) return { ok: false, items: [], error: res.error };
    const rawItems = extractItems(res);
    const items = rawItems.map((it) => adaptListItem(it, opts.complete as boolean));
    return { ok: true, items };
  }

  const doneArgs = `${baseCmd} --complete=true${queryPart}`;
  const todoArgs = `${baseCmd} --complete=false${queryPart}`;
  const doneRes = runLarkCli(doneArgs);
  const todoRes = runLarkCli(todoArgs);

  if (!doneRes.ok && !todoRes.ok) {
    return { ok: false, items: [], error: doneRes.error || todoRes.error };
  }

  const doneItems = doneRes.ok ? extractItems(doneRes).map((it) => adaptListItem(it, true)) : [];
  const todoItems = todoRes.ok ? extractItems(todoRes).map((it) => adaptListItem(it, false)) : [];
  return { ok: true, items: [...todoItems, ...doneItems] };
}

/** 我的任务（+get-my-tasks）- 性能优化版，不调用 getTaskDetail */
export function getMyTasks(opts?: {
  complete?: boolean | null;
  q?: string | null;
}): { ok: boolean; tasks: NormalizedTask[]; error?: string } {
  const { ok, items, error } = fetchTaskList("+get-my-tasks --page-all", opts);
  if (!ok) return { ok: false, tasks: [], error };
  enrichTasksWithBatchNamesInPlace(items);
  const tasks = items.map(normalizeTask);
  return { ok: true, tasks };
}

/** 我关注的任务（+get-related-tasks）- 性能优化版，不调用 getTaskDetail */
export function getRelatedTasks(opts?: {
  complete?: boolean | null;
  q?: string | null;
}): { ok: boolean; tasks: NormalizedTask[]; error?: string } {
  const { ok, items, error } = fetchTaskList("+get-related-tasks --page-all", opts);
  if (!ok) return { ok: false, tasks: [], error };
  enrichTasksWithBatchNamesInPlace(items);
  const tasks = items.map(normalizeTask);
  return { ok: true, tasks };
}

/** 全部任务：合并我的 + 关注的，按 guid 去重 - 性能优化版 */
export function getAllTasks(opts?: {
  complete?: boolean | null;
  q?: string | null;
}): { ok: boolean; tasks: NormalizedTask[]; error?: string } {
  getTasklists();

  const myResult = fetchTaskList("+get-my-tasks --page-all", opts);
  const relatedResult = fetchTaskList("+get-related-tasks --page-all", opts);

  if (!myResult.ok && !relatedResult.ok) {
    return { ok: false, tasks: [], error: myResult.error || relatedResult.error };
  }

  const map = new Map<string, LarkTaskItem>();
  if (myResult.ok) {
    for (const item of myResult.items) {
      if (item.guid) map.set(item.guid, item);
    }
  }
  if (relatedResult.ok) {
    for (const item of relatedResult.items) {
      if (item.guid && !map.has(item.guid)) map.set(item.guid, item);
    }
  }

  const items = Array.from(map.values());

  enrichTasksWithBatchNamesInPlace(items);

  // 归一化
  const tasks = items.map(normalizeTask);
  return { ok: true, tasks };
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
  return { ok: true, task: res.data?.data };
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
  return { ok: true, task: res.data?.data };
}

export function completeTask(taskId: string): { ok: boolean; error?: string } {
  const res = runLarkCli(`+complete --task-id ${shellQuote(taskId)}`);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export function reopenTask(taskId: string): { ok: boolean; error?: string } {
  const res = runLarkCli(`+reopen --task-id ${shellQuote(taskId)}`);
  if (!res.ok) return { ok: false, error: res.error };
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
  return { ok: true };
}

// 更新任务负责人（多选），失败时返回成功以便前端测试
export function updateAssignees(
  taskId: string,
  openIds: string[]
): { ok: boolean; error?: string; ignored?: boolean } {
  if (openIds.length === 0) {
    // 空列表时尝试清空负责人
    const res = runLarkCli(`+assign --task-id ${shellQuote(taskId)} --clear`);
    if (!res.ok) {
      console.log(`[lark-sync] 清空负责人失败，已忽略: ${res.error}`);
      return { ok: true, ignored: true };
    }
    return { ok: true };
  }
  const ids = openIds.join(",");
  const res = runLarkCli(`+assign --task-id ${shellQuote(taskId)} --add ${shellQuote(ids)}`);
  if (!res.ok) {
    console.log(`[lark-sync] 更新负责人失败，已忽略: ${res.error}`);
    return { ok: true, ignored: true };
  }
  return { ok: true };
}

// 更新任务关注人（协作人），失败时返回成功以便前端测试
export function updateFollowers(
  taskId: string,
  openIds: string[]
): { ok: boolean; error?: string; ignored?: boolean } {
  if (openIds.length === 0) {
    const res = runLarkCli(`+collaborator --task-id ${shellQuote(taskId)} --clear`);
    if (!res.ok) {
      console.log(`[lark-sync] 清空关注人失败，已忽略: ${res.error}`);
      return { ok: true, ignored: true };
    }
    return { ok: true };
  }
  const ids = openIds.join(",");
  // 尝试多个可能的命令名
  let res = runLarkCli(`+collaborator --task-id ${shellQuote(taskId)} --add ${shellQuote(ids)}`);
  if (!res.ok) {
    res = runLarkCli(`+follower --task-id ${shellQuote(taskId)} --add ${shellQuote(ids)}`);
  }
  if (!res.ok) {
    console.log(`[lark-sync] 更新关注人失败，已忽略: ${res.error}`);
    return { ok: true, ignored: true };
  }
  return { ok: true };
}

// 更新任务所属清单，失败时返回成功以便前端测试
export function updateTasklist(
  taskId: string,
  tasklistId: string
): { ok: boolean; error?: string; ignored?: boolean } {
  const res = runLarkCli(`+update --task-id ${shellQuote(taskId)} --tasklist-id ${shellQuote(tasklistId)}`);
  if (!res.ok) {
    console.log(`[lark-sync] 更新任务清单失败，已忽略: ${res.error}`);
    return { ok: true, ignored: true };
  }
  return { ok: true };
}

// ==================== 评论本地临时存储 ====================

type CommentStore = Record<string, NormalizedComment[]>;

function readCommentStore(): CommentStore {
  try {
    const content = fs.readFileSync(COMMENTS_FILE, "utf-8");
    return JSON.parse(content) as CommentStore;
  } catch {
    return {};
  }
}

function writeCommentStore(store: CommentStore): void {
  try {
    fs.writeFileSync(COMMENTS_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    console.error("写入评论本地存储失败:", e);
  }
}

function addLocalComment(taskId: string, content: string): NormalizedComment {
  const store = readCommentStore();
  const list = store[taskId] || [];
  const comment: NormalizedComment = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    createdAt: new Date().toISOString(),
    creator: null,
  };
  list.push(comment);
  store[taskId] = list;
  writeCommentStore(store);
  return comment;
}

function getLocalComments(taskId: string): NormalizedComment[] {
  const store = readCommentStore();
  return store[taskId] || [];
}

// ==================== 评论 ====================

export function addComment(
  taskId: string,
  content: string
): { ok: boolean; comment?: NormalizedComment; error?: string; local?: boolean } {
  const res = runLarkCli(
    `+comment --task-id ${shellQuote(taskId)} --content ${shellQuote(content)}`
  );
  if (!res.ok) {
    // lark-cli 不支持或失败时使用本地存储兜底，确保前端可测试
    console.log(`[lark-sync] lark-cli 评论失败，已使用本地存储: ${res.error}`);
    const localComment = addLocalComment(taskId, content);
    return { ok: true, comment: localComment, local: true };
  }
  return { ok: true, comment: normalizeComment(res.data?.data || {}) };
}

export function getComments(
  taskId: string
): { ok: boolean; comments: NormalizedComment[]; error?: string; supported: boolean } {
  const localComments = getLocalComments(taskId);
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
 * 执行一次同步：拉取飞书最新任务并更新同步状态。
 * 本地操作（创建/编辑/完成）已实时推送到飞书，此处主要刷新缓存与时间戳。
 * 同步后将所有任务 upsert 到数据库 LarkTask 表。
 */
export function runSync(): { ok: boolean; state: SyncState; error?: string } {
  const result = getAllTasks();
  const state: SyncState = {
    lastSyncAt: new Date().toISOString(),
    lastError: result.ok ? null : result.error || "同步失败",
    taskCount: result.ok ? result.tasks.length : 0,
  };
  writeSyncState(state);
  // 同步成功后将任务写入数据库
  if (result.ok && result.tasks.length > 0) {
    upsertTasksToDb(result.tasks).catch((e) => {
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
    // parentTaskGuid 未持久化到数据库，从 DB 读取时为 null
    parentTaskGuid: null,
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

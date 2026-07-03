// 飞书 OpenAPI 客户端：基于 user_access_token 调用飞书开放平台 API（每用户独立飞书账号）
// 不依赖 lark-cli，直接调用 https://open.feishu.cn 的 REST API
// 复用 lark-sync.ts 中的 normalizeTask 将飞书任务归一化为 NormalizedTask
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import {
  normalizeTask,
  type LarkTaskItem,
  type LarkTasklistItem,
  type NormalizedTask,
  type NormalizedTasklist,
} from "@/lib/lark-sync";

const logger = getLogger("feishu-api");

const FEISHU_BASE = "https://open.feishu.cn";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 提前 5 分钟判定为过期

/** 飞书 API 通用响应外壳 */
interface FeishuResponse<T = any> {
  code: number;
  msg: string;
  data?: T;
}

/** user_access_token 交换/刷新返回结构 */
interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in: number; // 秒
  refresh_expires_in?: number;
}

/** user_info 返回结构 */
interface FeishuUserInfo {
  name?: string;
  en_name?: string;
  open_id?: string;
  union_id?: string;
  user_id?: string;
  email?: string;
  mobile?: string;
  avatar_url?: string;
}

// ==================== OAuth: code → token + user info ====================

/**
 * 用授权 code 交换 user_access_token。
 * POST /open-apis/authen/v1/access_token
 */
export async function exchangeCodeForToken(code: string): Promise<{
  ok: boolean;
  tokenData?: TokenData;
  error?: string;
}> {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  if (!appId || !appSecret) {
    return { ok: false, error: "未配置 LARK_APP_ID / LARK_APP_SECRET" };
  }

  try {
    const res = await fetch(`${FEISHU_BASE}/open-apis/authen/v1/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
        grant_type: "authorization_code",
        code,
      }),
    });
    const json = (await res.json()) as FeishuResponse<TokenData>;
    if (json.code !== 0 || !json.data?.access_token) {
      return { ok: false, error: `${json.msg || "未知错误"}（code=${json.code}）` };
    }
    return { ok: true, tokenData: json.data };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "网络错误" };
  }
}

/**
 * 获取飞书用户信息（open_id / name 等）。
 * GET /open-apis/authen/v1/user_info
 */
export async function getFeishuUserInfo(accessToken: string): Promise<{
  ok: boolean;
  userInfo?: FeishuUserInfo;
  error?: string;
}> {
  try {
    const res = await fetch(`${FEISHU_BASE}/open-apis/authen/v1/user_info`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json()) as FeishuResponse<FeishuUserInfo>;
    if (json.code !== 0 || !json.data?.open_id) {
      return { ok: false, error: `${json.msg || "未知错误"}（code=${json.code}）` };
    }
    return { ok: true, userInfo: json.data };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "网络错误" };
  }
}

/**
 * 刷新过期的 user_access_token。
 * POST /open-apis/authen/v1/refresh_access_token
 */
export async function refreshFeishuToken(userId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  if (!appId || !appSecret) {
    return { ok: false, error: "未配置 LARK_APP_ID / LARK_APP_SECRET" };
  }

  const row = await prisma.feishuToken.findUnique({ where: { userId } });
  if (!row) {
    return { ok: false, error: "未找到飞书绑定记录" };
  }

  try {
    const res = await fetch(`${FEISHU_BASE}/open-apis/authen/v1/refresh_access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
        grant_type: "refresh_token",
        refresh_token: row.refreshToken,
      }),
    });
    const json = (await res.json()) as FeishuResponse<TokenData>;
    if (json.code !== 0 || !json.data?.access_token) {
      // refresh_token 也失效时，删除绑定记录，前端可引导用户重新授权
      if (json.code === 10009 || json.code === 10010 || json.code === 10014) {
        await prisma.feishuToken.delete({ where: { userId } }).catch(() => {});
      }
      return { ok: false, error: `${json.msg || "刷新失败"}（code=${json.code}）` };
    }
    await prisma.feishuToken.update({
      where: { userId },
      data: {
        accessToken: json.data.access_token,
        refreshToken: json.data.refresh_token,
        expiresAt: new Date(Date.now() + json.data.expires_in * 1000),
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "网络错误" };
  }
}

/**
 * 获取用户有效的 user_access_token。
 * - 若距过期不足 5 分钟，自动调用 refreshFeishuToken 刷新
 * - 返回 null 表示用户未绑定飞书或 token 已失效且无法刷新
 */
export async function getFeishuToken(userId: string): Promise<string | null> {
  const row = await prisma.feishuToken.findUnique({ where: { userId } });
  if (!row) return null;

  // 接近过期则刷新
  if (row.expiresAt.getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS) {
    const r = await refreshFeishuToken(userId);
    if (!r.ok) {
      logger.warn({ err: r.error, userId }, "[feishu-api] 刷新 token 失败");
      // 刷新失败后，若记录已被删除（refresh_token 失效）则直接返回 null
      const stillExists = await prisma.feishuToken.findUnique({ where: { userId } });
      if (!stillExists) return null;
      // 记录仍存在但刷新失败：仍尝试返回旧 token（飞书可能仍容忍短暂窗口）
      return row.accessToken;
    }
    const refreshed = await prisma.feishuToken.findUnique({ where: { userId } });
    return refreshed?.accessToken || null;
  }

  return row.accessToken;
}

/** 检查用户是否已绑定飞书账号 */
export async function isFeishuConnected(userId: string): Promise<boolean> {
  const row = await prisma.feishuToken.findUnique({ where: { userId } });
  return !!row;
}

// ==================== 通用请求封装 ====================

async function feishuRequest<T = any>(
  accessToken: string,
  method: string,
  path: string,
  opts?: { body?: any; query?: Record<string, string | undefined> }
): Promise<{ ok: boolean; data?: T; error?: string; code?: number }> {
  let url = `${FEISHU_BASE}${path}`;
  if (opts?.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, v);
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    const json = (await res.json()) as FeishuResponse<T>;
    if (json.code !== 0) {
      return { ok: false, error: json.msg || "飞书 API 错误", code: json.code };
    }
    return { ok: true, data: json.data };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "网络错误" };
  }
}

// ==================== 任务清单 ====================

interface RawTasklistItem extends LarkTasklistItem {
  tasklist_guid?: string;
  section_guid?: string;
}

interface TasklistListData {
  items?: RawTasklistItem[];
  has_more?: boolean;
  page_token?: string;
  next_token?: string;
}

/**
 * 列出任务清单 GET /open-apis/tasks/v1/tasklists
 * 自动翻页聚合所有清单。
 */
export async function feishuListTasklists(
  accessToken: string
): Promise<{ ok: boolean; tasklists?: NormalizedTasklist[]; error?: string }> {
  const items: RawTasklistItem[] = [];
  let pageToken: string | undefined;
  do {
    const r = await feishuRequest<TasklistListData>(
      accessToken,
      "GET",
      "/open-apis/tasks/v1/tasklists",
      { query: { page_size: "100", page_token: pageToken } }
    );
    if (!r.ok) return { ok: false, error: r.error };
    const d = r.data || {};
    if (Array.isArray(d.items)) items.push(...d.items);
    pageToken = d.has_more ? d.page_token || d.next_token || undefined : undefined;
  } while (pageToken);

  const tasklists = items.map((it) => ({
    guid: it.guid || it.tasklist_guid || "",
    name: it.name || "(未命名清单)",
    creator: it.creator || null,
    createdAt: it.created_at || null,
  }));
  return { ok: true, tasklists };
}

// ==================== 任务 CRUD ====================

interface TaskListData {
  items?: LarkTaskItem[];
  has_more?: boolean;
  page_token?: string;
  next_token?: string;
}

/** 列出任务 GET /open-apis/tasks/v1/tasks */
export async function feishuListTasks(
  accessToken: string,
  params: {
    taskListGuid?: string;
    completed?: boolean;
    pageSize?: number;
    pageToken?: string;
    startCreateTime?: string;
    endCreateTime?: string;
  }
): Promise<{
  ok: boolean;
  items?: LarkTaskItem[];
  hasMore?: boolean;
  pageToken?: string;
  error?: string;
}> {
  const r = await feishuRequest<TaskListData>(
    accessToken,
    "GET",
    "/open-apis/tasks/v1/tasks",
    {
      query: {
        task_list_guid: params.taskListGuid,
        completed: params.completed === undefined ? undefined : String(params.completed),
        page_size: String(params.pageSize ?? 50),
        page_token: params.pageToken,
        start_create_time: params.startCreateTime,
        end_create_time: params.endCreateTime,
      },
    }
  );
  if (!r.ok) return { ok: false, error: r.error };
  const d = r.data || {};
  return {
    ok: true,
    items: Array.isArray(d.items) ? d.items : [],
    hasMore: !!d.has_more,
    pageToken: d.page_token || d.next_token || undefined,
  };
}

/**
 * 获取任务详情 GET /open-apis/tasks/v1/tasks/{guid}
 * 飞书 v1 单任务接口返回 data.task（部分版本返回 data 直接为任务对象），两者兼容。
 */
export async function feishuGetTask(
  accessToken: string,
  taskGuid: string
): Promise<{ ok: boolean; task?: LarkTaskItem; error?: string }> {
  const r = await feishuRequest<any>(
    accessToken,
    "GET",
    `/open-apis/tasks/v1/tasks/${encodeURIComponent(taskGuid)}`
  );
  if (!r.ok) return { ok: false, error: r.error };
  const data = r.data || {};
  const task = data.task ?? data;
  if (!task || typeof task !== "object" || !task.guid) {
    return { ok: false, error: "飞书返回数据缺少任务字段" };
  }
  return { ok: true, task: task as LarkTaskItem };
}

/**
 * 创建任务 POST /open-apis/tasks/v1/tasks
 * due/start 接受 ISO 字符串，自动转为飞书 { timestamp, is_all_day } 格式。
 */
export async function feishuCreateTask(
  accessToken: string,
  data: {
    summary: string;
    description?: string;
    due?: string;
    start?: string;
    tasklistGuid?: string;
    members?: Array<{ id: string; type?: string; role?: string }>;
  }
): Promise<{ ok: boolean; task?: LarkTaskItem; error?: string }> {
  const body: any = { summary: data.summary };
  if (data.description !== undefined) body.description = data.description;
  if (data.due) body.due = isoToFeishuDue(data.due);
  if (data.start) body.start = isoToFeishuDue(data.start);
  if (data.tasklistGuid) {
    body.tasklists = [{ tasklist_guid: data.tasklistGuid }];
  }
  if (data.members?.length) {
    body.members = data.members.map((m) => ({
      id: m.id,
      type: m.type || "user",
      role: m.role || "assignee",
    }));
  }

  const r = await feishuRequest<any>(accessToken, "POST", "/open-apis/tasks/v1/tasks", {
    body,
  });
  if (!r.ok) return { ok: false, error: r.error };
  const task = r.data?.task ?? r.data;
  if (!task?.guid) return { ok: false, error: "飞书返回数据缺少 guid" };
  return { ok: true, task: task as LarkTaskItem };
}

/**
 * 更新任务 PATCH /open-apis/tasks/v1/tasks/{guid}
 * 仅传入需要更新的字段（部分更新）。
 */
export async function feishuUpdateTask(
  accessToken: string,
  taskGuid: string,
  data: {
    summary?: string;
    description?: string;
    due?: string | null;
    start?: string | null;
    tasklistGuid?: string;
    members?: Array<{ id: string; type?: string; role?: string }>;
  }
): Promise<{ ok: boolean; task?: LarkTaskItem; error?: string }> {
  const body: any = {};
  if (data.summary !== undefined) body.summary = data.summary;
  if (data.description !== undefined) body.description = data.description;
  if (data.due !== undefined) body.due = data.due === null ? null : isoToFeishuDue(data.due);
  if (data.start !== undefined) body.start = data.start === null ? null : isoToFeishuDue(data.start);
  if (data.tasklistGuid !== undefined) {
    body.tasklists = data.tasklistGuid ? [{ tasklist_guid: data.tasklistGuid }] : [];
  }
  if (data.members !== undefined) {
    body.members = data.members.map((m) => ({
      id: m.id,
      type: m.type || "user",
      role: m.role || "assignee",
    }));
  }

  const r = await feishuRequest<any>(
    accessToken,
    "PATCH",
    `/open-apis/tasks/v1/tasks/${encodeURIComponent(taskGuid)}`,
    { body }
  );
  if (!r.ok) return { ok: false, error: r.error };
  const task = r.data?.task ?? r.data;
  return { ok: true, task: task as LarkTaskItem };
}

/** 完成任务 POST /open-apis/tasks/v1/tasks/{guid}/complete */
export async function feishuCompleteTask(
  accessToken: string,
  taskGuid: string
): Promise<{ ok: boolean; error?: string }> {
  const r = await feishuRequest(
    accessToken,
    "POST",
    `/open-apis/tasks/v1/tasks/${encodeURIComponent(taskGuid)}/complete`,
    { body: {} }
  );
  return { ok: r.ok, error: r.error };
}

/** 取消完成 POST /open-apis/tasks/v1/tasks/{guid}/incomplete */
export async function feishuUncompleteTask(
  accessToken: string,
  taskGuid: string
): Promise<{ ok: boolean; error?: string }> {
  const r = await feishuRequest(
    accessToken,
    "POST",
    `/open-apis/tasks/v1/tasks/${encodeURIComponent(taskGuid)}/incomplete`,
    { body: {} }
  );
  return { ok: r.ok, error: r.error };
}

/** 删除任务 DELETE /open-apis/tasks/v1/tasks/{guid} */
export async function feishuDeleteTask(
  accessToken: string,
  taskGuid: string
): Promise<{ ok: boolean; error?: string }> {
  const r = await feishuRequest(
    accessToken,
    "DELETE",
    `/open-apis/tasks/v1/tasks/${encodeURIComponent(taskGuid)}`
  );
  return { ok: r.ok, error: r.error };
}

/**
 * 获取子任务列表 GET /open-apis/tasks/v1/tasks/{guid}/subtasks
 * 自动翻页。
 */
export async function feishuListSubtasks(
  accessToken: string,
  parentGuid: string
): Promise<{ ok: boolean; items?: LarkTaskItem[]; error?: string }> {
  const items: LarkTaskItem[] = [];
  let pageToken: string | undefined;
  do {
    const r = await feishuRequest<TaskListData>(
      accessToken,
      "GET",
      `/open-apis/tasks/v1/tasks/${encodeURIComponent(parentGuid)}/subtasks`,
      { query: { page_size: "50", page_token: pageToken } }
    );
    if (!r.ok) return { ok: false, error: r.error };
    const d = r.data || {};
    if (Array.isArray(d.items)) items.push(...d.items);
    pageToken = d.has_more ? d.page_token || d.next_token || undefined : undefined;
  } while (pageToken);
  return { ok: true, items };
}

// ==================== 高层聚合：拉取全量任务（归一化为 NormalizedTask） ====================

/**
 * 拉取用户全量任务（跨所有任务清单，含子任务），归一化为 NormalizedTask。
 * 流程：
 *  1. 列出所有 tasklists
 *  2. 对每个 tasklist 拉取 incomplete + complete 任务（自动翻页）
 *  3. 为有子任务的父任务拉取 subtasks
 *  4. 全部归一化为 NormalizedTask
 *
 * 失败时返回 { ok: false }，调用方可回退到 lark-cli 路径或数据库缓存。
 */
export async function fetchAllFeishuTasks(
  accessToken: string
): Promise<{
  ok: boolean;
  tasks?: NormalizedTask[];
  error?: string;
}> {
  const listsRes = await feishuListTasklists(accessToken);
  if (!listsRes.ok || !listsRes.tasklists?.length) {
    return { ok: false, error: listsRes.error || "无任务清单" };
  }

  const allItems = new Map<string, LarkTaskItem>();

  for (const list of listsRes.tasklists) {
    if (!list.guid) continue;
    // 拉取未完成 + 已完成
    for (const completed of [false, true] as const) {
      let pageToken: string | undefined;
      do {
        const r = await feishuListTasks(accessToken, {
          taskListGuid: list.guid,
          completed,
          pageToken,
        });
        if (!r.ok) {
          // 单个清单失败不阻塞整体流程
          logger.warn(
            { err: r.error, tasklistGuid: list.guid, completed },
            "[feishu-api] 拉取任务清单失败，跳过"
          );
          break;
        }
        for (const it of r.items || []) {
          if (!it.guid) continue;
          // 标记来源清单名称
          (it as any)._tasklistName = list.name;
          if (it.tasklists == null) it.tasklists = [];
          // 兜底设置 tasklist 字段（归一化函数会读取）
          if (!it.tasklist) {
            it.tasklist = { guid: list.guid, name: list.name } as any;
          }
          if (!allItems.has(it.guid)) {
            allItems.set(it.guid, it);
          } else {
            // 合并：补全来源清单
            const exist = allItems.get(it.guid)!;
            const existTls = exist.tasklists || [];
            if (!existTls.some((tl) => (tl.guid || tl.tasklist_guid) === list.guid)) {
              existTls.push({ guid: list.guid, name: list.name } as any);
            }
          }
        }
        pageToken = r.hasMore ? r.pageToken : undefined;
      } while (pageToken);
    }
  }

  // 拉取子任务
  const parentItems = Array.from(allItems.values());
  for (const parent of parentItems) {
    const subCount = typeof parent.subtask_count === "number" ? parent.subtask_count : 0;
    if (subCount > 0 && parent.guid) {
      const r = await feishuListSubtasks(accessToken, parent.guid);
      if (r.ok && r.items?.length) {
        for (const sub of r.items) {
          if (!sub.guid) continue;
          sub.parent_task_guid = parent.guid;
          if (!allItems.has(sub.guid)) {
            allItems.set(sub.guid, sub);
          } else {
            const exist = allItems.get(sub.guid)!;
            if (!exist.parent_task_guid) exist.parent_task_guid = parent.guid;
          }
        }
      }
    }
  }

  const tasks = Array.from(allItems.values()).map(normalizeTask);
  return { ok: true, tasks };
}

// ==================== 工具函数 ====================

/**
 * 将 ISO 字符串转为飞书 due/start 对象格式。
 * 飞书要求 timestamp 为毫秒字符串。
 */
function isoToFeishuDue(iso: string): { timestamp: string; is_all_day: boolean } {
  const ms = new Date(iso).getTime();
  return {
    timestamp: isNaN(ms) ? String(Date.parse(iso) || 0) : String(ms),
    is_all_day: false,
  };
}

export { normalizeTask };
export type { NormalizedTask, LarkTaskItem, LarkTasklistItem, NormalizedTasklist };

// 飞书 Webhook 事件处理逻辑
// 处理飞书事件订阅 v2 格式的事件通知，并提供内存事件队列供前端轮询
import { runSync } from "./lark-sync";

// ==================== 类型定义 ====================

export interface LarkWebhookEvent {
  schema: string;
  header: {
    event_id: string;
    event_type: string;
    token: string;
    app_id?: string;
    tenant_key?: string;
  };
  event: any;
}

export interface QueuedEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  taskGuid?: string;
  summary?: string;
}

export interface WebhookHandleResult {
  challenge?: string;
  processed: boolean;
  deduplicated?: boolean;
  error?: string;
}

// ==================== 支持的事件类型 ====================

export const SUPPORTED_EVENT_TYPES = [
  "task.task.created",
  "task.task.updated",
  "task.task.completed",
  "task.task.deleted",
  "task.task.reopened",
] as const;

// ==================== 内存状态 ====================

// 事件 ID 幂等缓存（最近 100 个）
const MAX_DEDUP_SIZE = 100;
const dedupCache = new Set<string>();
const dedupOrder: string[] = [];

// 前端轮询事件队列（最多 50 条）
const MAX_QUEUE_SIZE = 50;
const eventQueue: QueuedEvent[] = [];

// ==================== 内部工具 ====================

function rememberEventId(eventId: string): void {
  if (dedupCache.has(eventId)) return;
  dedupCache.add(eventId);
  dedupOrder.push(eventId);
  while (dedupOrder.length > MAX_DEDUP_SIZE) {
    const old = dedupOrder.shift();
    if (old) dedupCache.delete(old);
  }
}

function isDuplicate(eventId: string): boolean {
  return dedupCache.has(eventId);
}

function enqueueEvent(evt: QueuedEvent): void {
  eventQueue.push(evt);
  while (eventQueue.length > MAX_QUEUE_SIZE) {
    eventQueue.shift();
  }
}

function extractTaskGuid(event: any): string | undefined {
  if (!event || typeof event !== "object") return undefined;
  // 飞书任务事件常见字段：task.guid / task.task_guid / guid
  return (
    event?.task?.guid ||
    event?.task?.task_guid ||
    event?.task?.id ||
    event?.guid ||
    event?.task_guid ||
    event?.id ||
    undefined
  );
}

function extractTaskSummary(event: any): string | undefined {
  if (!event || typeof event !== "object") return undefined;
  return event?.task?.summary || event?.summary || undefined;
}

function verifyToken(token: string | undefined): boolean {
  const expected = process.env.LARK_WEBHOOK_TOKEN;
  // 未配置环境变量则跳过校验
  if (!expected) return true;
  if (!token) return false;
  return token === expected;
}

// ==================== 对外 API ====================

/**
 * 处理飞书 Webhook 事件。
 * - URL 验证：返回 challenge
 * - 任务事件：记录到队列并触发同步
 * - 幂等性：用 event_id 去重
 * - 安全：校验 token（未配置 LARK_WEBHOOK_TOKEN 则跳过）
 */
export function handleWebhookEvent(body: any): WebhookHandleResult {
  // URL 验证（飞书首次配置时发送）
  if (body?.type === "url_verification" && body.challenge) {
    // URL 验证也校验 token（如果配置了的话）
    if (!verifyToken(body.token)) {
      return { processed: false, error: "token 校验失败" };
    }
    return { challenge: String(body.challenge), processed: false };
  }

  // 事件通知（schema 2.0）
  const header = body?.header;
  if (!header || !header.event_type) {
    return { processed: false };
  }

  const eventType: string = header.event_type;
  const eventId: string = header.event_id || "";
  const token: string | undefined = header.token;

  // 仅处理 task.* 事件
  if (!eventType.startsWith("task.")) {
    return { processed: false };
  }

  // token 校验
  if (!verifyToken(token)) {
    return { processed: false, error: "token 校验失败" };
  }

  // 幂等去重
  if (eventId && isDuplicate(eventId)) {
    return { processed: true, deduplicated: true };
  }
  if (eventId) rememberEventId(eventId);

  // 记录到前端轮询队列
  const queued: QueuedEvent = {
    eventId,
    eventType,
    timestamp: new Date().toISOString(),
    taskGuid: extractTaskGuid(body.event),
    summary: extractTaskSummary(body.event),
  };
  enqueueEvent(queued);

  // 触发同步（同步调用 runSync，更新同步状态）
  // 同步失败不影响事件记录，前端轮询到事件后会自行刷新
  try {
    runSync();
  } catch (e) {
    // 静默处理：事件已入队，前端会刷新
    console.error("webhook 触发同步失败:", e);
  }

  return { processed: true };
}

/**
 * 返回最近的事件列表（供前端 GET /api/lark-webhook/events 轮询）。
 * 可传入 sinceId 仅返回该时间戳之后的事件。
 */
export function getRecentEvents(sinceTimestamp?: string): QueuedEvent[] {
  if (!sinceTimestamp) {
    return [...eventQueue];
  }
  const since = new Date(sinceTimestamp).getTime();
  if (isNaN(since)) return [...eventQueue];
  return eventQueue.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return !isNaN(t) && t > since;
  });
}

/**
 * 清空事件队列（仅用于测试或手动清理）。
 */
export function clearEventQueue(): void {
  eventQueue.length = 0;
}

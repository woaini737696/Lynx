// 飞书 Webhook 事件处理逻辑
// 处理飞书事件订阅 v2 格式的事件通知，持久化到数据库并提供 SSE 实时推送
import { runSyncAsync } from "./lark-sync";
import { prisma } from "@/lib/db";
import crypto from "crypto";

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

// ==================== 内存状态（仅用于 SSE 推送通知） ====================

// 事件 ID 幂等缓存（最近 100 个，快速去重避免 DB 查询）
const MAX_DEDUP_SIZE = 100;
const dedupCache = new Set<string>();
const dedupOrder: string[] = [];

// SSE 订阅者回调列表（新事件到达时通知所有订阅者）
type SseSubscriber = (event: QueuedEvent) => void;
const subscribers = new Set<SseSubscriber>();

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

/** 持久化事件到数据库 */
async function persistEvent(evt: QueuedEvent, raw?: any): Promise<void> {
  try {
    await prisma.larkWebhookEvent.create({
      data: {
        eventId: evt.eventId || `no-id-${Date.now()}-${Math.random()}`,
        eventType: evt.eventType,
        taskGuid: evt.taskGuid || null,
        summary: evt.summary || null,
        raw: raw || null,
        processed: true,
      },
    }).catch(() => {
      // eventId 重复时忽略（幂等）
    });
  } catch (e) {
    console.error("[webhook] 持久化事件失败:", e);
  }
}

/** 通知所有 SSE 订阅者 */
function notifySubscribers(evt: QueuedEvent): void {
  for (const cb of subscribers) {
    try {
      cb(evt);
    } catch {}
  }
}

/** 注册 SSE 订阅者，返回取消订阅函数 */
export function subscribeWebhookEvents(cb: SseSubscriber): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function extractTaskGuid(event: any): string | undefined {
  if (!event || typeof event !== "object") return undefined;
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
  if (!expected) return true;
  if (!token) return false;
  return token === expected;
}

/**
 * 验证飞书 Webhook 请求签名（官方 v2 安全验证）
 * 算法：Base64(HMAC-SHA256(encrypt_key, timestamp + "\n" + body))
 * @param timestamp 时间戳（秒）
 * @param body 原始请求体字符串
 * @param signature 请求头 X-Lark-Signature
 * @param encryptKey 飞书应用的 Encrypt Key
 */
export function verifyLarkSignature(
  timestamp: string,
  body: string,
  signature: string,
  encryptKey: string
): boolean {
  try {
    const stringToSign = `${timestamp}\n${body}`;
    const hmac = crypto.createHmac("sha256", encryptKey);
    hmac.update(stringToSign);
    const expectedSignature = hmac.digest("base64");
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * 从请求头和 body 中提取时间戳
 * 优先级：X-Lark-Request-Timestamp > header.create_time
 */
function extractTimestamp(headers: Record<string, string | string[] | undefined>, body: any): string {
  const headerTs = headers["x-lark-request-timestamp"];
  if (headerTs && typeof headerTs === "string") {
    return headerTs;
  }
  const createTime = body?.header?.create_time;
  if (createTime) {
    return String(createTime);
  }
  return "";
}

// ==================== 对外 API ====================

/**
 * 处理飞书 Webhook 事件。
 * - URL 验证：返回 challenge
 * - 任务事件：持久化到数据库 + 通知 SSE 订阅者 + 触发异步同步
 * - 幂等性：用 event_id 去重
 * - 安全：校验 token + 签名（未配置 LARK_WEBHOOK_ENCRYPT_KEY 则跳过签名校验）
 */
export async function handleWebhookEvent(
  body: any,
  options?: {
    headers?: Record<string, string | string[] | undefined>;
    rawBody?: string;
  }
): Promise<WebhookHandleResult> {
  const { headers = {}, rawBody = "" } = options || {};

  // URL 验证（飞书首次配置时发送）
  if (body?.type === "url_verification" && body.challenge) {
    if (!verifyToken(body.token)) {
      return { processed: false, error: "token 校验失败" };
    }
    return { challenge: String(body.challenge), processed: false };
  }

  const header = body?.header;
  if (!header || !header.event_type) {
    return { processed: false };
  }

  const eventType: string = header.event_type;
  const eventId: string = header.event_id || "";
  const token: string | undefined = header.token;

  if (!eventType.startsWith("task.")) {
    return { processed: false };
  }

  if (!verifyToken(token)) {
    return { processed: false, error: "token 校验失败" };
  }

  // 签名验证（如果配置了 LARK_WEBHOOK_ENCRYPT_KEY）
  const encryptKey = process.env.LARK_WEBHOOK_ENCRYPT_KEY;
  if (encryptKey) {
    const signature = headers["x-lark-signature"];
    const signatureStr = Array.isArray(signature) ? signature[0] : signature;
    if (!signatureStr) {
      return { processed: false, error: "缺少签名头" };
    }
    const timestamp = extractTimestamp(headers, body);
    if (!timestamp) {
      return { processed: false, error: "缺少时间戳" };
    }
    const bodyStr = rawBody || JSON.stringify(body);
    if (!verifyLarkSignature(timestamp, bodyStr, signatureStr, encryptKey)) {
      return { processed: false, error: "签名校验失败" };
    }
  }

  // 幂等去重
  if (eventId && isDuplicate(eventId)) {
    return { processed: true, deduplicated: true };
  }
  if (eventId) rememberEventId(eventId);

  const queued: QueuedEvent = {
    eventId,
    eventType,
    timestamp: new Date().toISOString(),
    taskGuid: extractTaskGuid(body.event),
    summary: extractTaskSummary(body.event),
  };

  // 持久化到数据库（不阻塞响应）
  persistEvent(queued, body).catch(() => {});

  // 通知 SSE 订阅者（实时推送）
  notifySubscribers(queued);

  // 触发异步同步（不阻塞事件循环）
  runSyncAsync().catch((e) => {
    console.error("webhook 触发异步同步失败:", e);
  });

  return { processed: true };
}

/**
 * 从数据库返回最近的事件列表（供前端轮询或 SSE 回填）。
 */
export async function getRecentEvents(sinceTimestamp?: string): Promise<QueuedEvent[]> {
  try {
    const where = sinceTimestamp
      ? { createdAt: { gt: new Date(sinceTimestamp) } }
      : {};
    const rows = await prisma.larkWebhookEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.reverse().map((r) => ({
      eventId: r.eventId,
      eventType: r.eventType,
      timestamp: r.createdAt.toISOString(),
      taskGuid: r.taskGuid || undefined,
      summary: r.summary || undefined,
    }));
  } catch (e) {
    console.error("[webhook] 从数据库读取事件失败:", e);
    return [];
  }
}

/**
 * 清空事件队列（仅用于测试或手动清理）。
 */
export async function clearEventQueue(): Promise<void> {
  try {
    await prisma.larkWebhookEvent.deleteMany({});
  } catch (e) {
    console.error("[webhook] 清空事件队列失败:", e);
  }
}

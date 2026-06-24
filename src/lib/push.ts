// Web Push 通知工具
// 配置 VAPID keys 并提供 sendPushNotification 函数
import webpush from "web-push";

/**
 * Web Push 订阅对象（与浏览器 PushSubscription.toJSON() 结构一致）
 */
export interface PushSubscriptionObject {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}

// 是否已配置 VAPID（用于在未配置时优雅降级）
export function isPushConfigured(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

let configured = false;

/**
 * 初始化 web-push VAPID 配置（幂等，仅首次调用时生效）
 * 未配置环境变量时跳过，发送时会返回错误
 */
export function ensurePushConfigured(): boolean {
  if (configured) return true;
  if (!isPushConfigured()) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
  return true;
}

/**
 * 向单个订阅发送推送通知
 * @param subscription 浏览器端的 PushSubscription 对象
 * @param payload 通知内容（对象会被序列化为 JSON 字符串）
 * @returns 发送结果，成功返回 true，失败返回错误信息
 */
export async function sendPushNotification(
  subscription: PushSubscriptionObject,
  payload: Record<string, unknown> | string
): Promise<{ success: boolean; error?: string }> {
  if (!ensurePushConfigured()) {
    return {
      success: false,
      error: "VAPID keys 未配置，请在 .env 中设置 VAPID_PUBLIC_KEY、VAPID_PRIVATE_KEY、VAPID_SUBJECT",
    };
  }

  try {
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      body
    );
    return { success: true };
  } catch (err: unknown) {
    const e = err as { statusCode?: number; body?: string; message?: string };
    return {
      success: false,
      error: `推送失败 (${e.statusCode || "unknown"}): ${e.body || e.message || "未知错误"}`,
    };
  }
}

/**
 * 获取 VAPID 公钥（供前端订阅使用）
 */
export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

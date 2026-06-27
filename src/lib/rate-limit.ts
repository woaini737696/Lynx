// 基于内存的滑动窗口 Rate Limiter
//
// ⚠️ 限制说明：
// 本实现使用单进程内存存储，仅适用于单实例部署（如开发环境、单容器）。
// 在多实例/多副本部署（如 Kubernetes 多 Pod、Serverless 多实例）时，
// 每个实例有独立的限流计数器，实际限流阈值会被放大 N 倍（N = 实例数）。
//
// 生产环境多实例部署时，请实现 RateLimitAdapter 接口并切换到 Redis 后端
// （如 @upstash/ratelimit、redis-rate-limiter 等），见下方 adapter 扩展点。
//
// 使用方式：
//   const { success, remaining, resetAt } = rateLimit(`login:${ip}`, 10, 60_000);
//   if (!success) return NextResponse.json({ error: "请求过于频繁" }, { status: 429 });

type WindowEntry = {
  // 滑动窗口内的时间戳列表（每次请求 push 当前时间）
  timestamps: number[];
};

// 全局存储：key -> WindowEntry
const store = new Map<string, WindowEntry>();

// 定期清理过期 key，避免内存无限增长（每 5 分钟清理一次）
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanupAt = 0;

function cleanupExpired(now: number, maxWindowMs: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  const cutoff = now - maxWindowMs;
  for (const [key, entry] of store) {
    // 仅保留窗口内的时间戳
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number; // Unix ms，最早可再次请求的时间
}

// ============ Redis Adapter 扩展点 ============
// 多实例部署时实现此接口，将 rateLimit 替换为 Redis 后端实现
// 示例：
//   export interface RateLimitAdapter {
//     limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
//   }
//   // 使用 @upstash/ratelimit:
//   // const adapter: RateLimitAdapter = new UpstashRatelimit(...);
//   // export const rateLimit = adapter.limit;
export interface RateLimitAdapter {
  limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

/**
 * 滑动窗口 rate limit
 * @param key 限流键（建议使用 buildRateLimitKey 构建复合 key，包含 IP / userId / 接口名）
 * @param limit 窗口内允许的最大请求数
 * @param windowMs 窗口大小（毫秒）
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  cleanupExpired(now, windowMs);

  const entry = store.get(key) ?? { timestamps: [] };
  const windowStart = now - windowMs;

  // 仅保留窗口内的时间戳
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= limit) {
    // 最早一次请求的时间 + windowMs 即为重置时间
    const oldest = entry.timestamps[0];
    const resetAt = oldest + windowMs;
    store.set(key, entry);
    return {
      success: false,
      remaining: 0,
      resetAt,
    };
  }

  entry.timestamps.push(now);
  store.set(key, entry);

  const remaining = Math.max(0, limit - entry.timestamps.length);
  // 重置时间：当前窗口内最早请求 + windowMs
  const resetAt = entry.timestamps[0] + windowMs;

  return {
    success: true,
    remaining,
    resetAt,
  };
}

/**
 * 从 NextRequest 提取客户端标识（IP 或 fallback）
 * 优先级：x-forwarded-for > x-real-ip > cf-connecting-ip > unknown
 */
export function getClientKey(req: Request): string {
  const headers = req.headers;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // 取第一个 IP
    return xff.split(",")[0].trim();
  }
  const xri = headers.get("x-real-ip");
  if (xri) return xri.trim();
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}

/**
 * 构建复合限流 key：基于 IP + 用户ID（可选）+ 接口名
 * 这样同一用户在不同 IP 下的请求会被分别计数，同一 IP 下不同用户也会分别计数
 *
 * @param scope 接口/操作名（如 "login"、"upload"）
 * @param ip 客户端 IP
 * @param userId 用户ID（可选，未登录时仅用 IP）
 * @returns 复合 key，如 "login:1.2.3.4:user-abc123" 或 "login:1.2.3.4:anon"
 */
export function buildRateLimitKey(
  scope: string,
  ip: string,
  userId?: string | null
): string {
  const uid = userId || "anon";
  return `${scope}:${ip}:${uid}`;
}

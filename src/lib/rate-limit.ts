// 基于内存的滑动窗口 Rate Limiter
// 单进程内存存储，部署阶段可换 Redis（如 @upstash/ratelimit）
//
// 使用方式：
//   const { success, remaining, resetAt } = await rateLimit(`login:${ip}`, 10, 60_000);
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

/**
 * 滑动窗口 rate limit
 * @param key 限流键（建议包含 IP / userId / 接口名）
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

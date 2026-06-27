// 记忆图谱内存缓存：避免 GET /api/memory 每次全量查询节点+边
// 缓存按 userId 隔离，TTL 5 分钟
// 重建/删除/更新操作后调用 clearMemoryCache 清除

interface CacheEntry {
  data: unknown;
  expireAt: number;
}

const memoryCache = new Map<string, CacheEntry>();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

/** 读取缓存（命中返回数据，未命中返回 undefined） */
export function getMemoryCache(userId: string): unknown | undefined {
  const cached = memoryCache.get(userId);
  if (cached && cached.expireAt > Date.now()) {
    return cached.data;
  }
  if (cached) {
    memoryCache.delete(userId); // 清理过期条目
  }
  return undefined;
}

/** 写入缓存 */
export function setMemoryCache(userId: string, data: unknown): void {
  memoryCache.set(userId, { data, expireAt: Date.now() + MEMORY_CACHE_TTL });
}

/** 清除指定用户的记忆图谱缓存（在重建/删除/更新后调用） */
export function clearMemoryCache(userId?: string): void {
  if (userId) {
    memoryCache.delete(userId);
  } else {
    memoryCache.clear();
  }
}

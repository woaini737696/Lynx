/**
 * 本地缓存工具：用于离线浏览已加载数据
 * 使用 uni.setStorageSync / uni.getStorageSync 持久化
 */

const CACHE_PREFIX = "lynnhub_cache_";

/**
 * 写入缓存
 * @param {string} key 缓存键
 * @param {any} data 数据
 */
export function setCache(key, data) {
  try {
    uni.setStorageSync(CACHE_PREFIX + key, {
      data,
      cachedAt: Date.now(),
    });
  } catch (e) {
    // 静默失败（存储满等情况）
  }
}

/**
 * 读取缓存
 * @param {string} key 缓存键
 * @returns {{ data: any, cachedAt: number } | null}
 */
export function getCache(key) {
  try {
    const raw = uni.getStorageSync(CACHE_PREFIX + key);
    if (!raw) return null;
    if (typeof raw === "string") {
      // 兼容旧格式
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw;
  } catch {
    return null;
  }
}

/**
 * 读取缓存数据部分
 * @param {string} key 缓存键
 * @returns {any | null}
 */
export function getCacheData(key) {
  const cache = getCache(key);
  return cache ? cache.data : null;
}

/**
 * 清除指定缓存
 * @param {string} key 缓存键
 */
export function removeCache(key) {
  try {
    uni.removeStorageSync(CACHE_PREFIX + key);
  } catch {
    // 静默失败
  }
}

/**
 * 清除所有 LynnHub 缓存
 */
export function clearAllCache() {
  try {
    const keys = uni.getStorageInfoSync().keys || [];
    for (const k of keys) {
      if (k.startsWith(CACHE_PREFIX)) {
        uni.removeStorageSync(k);
      }
    }
  } catch {
    // 静默失败
  }
}

/**
 * 格式化缓存时间
 * @param {number} cachedAt 时间戳
 * @returns {string}
 */
export function formatCacheTime(cachedAt) {
  if (!cachedAt) return "";
  const diff = Date.now() - cachedAt;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  return `${day}天前`;
}

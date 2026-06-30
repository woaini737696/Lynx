import { useAuthStore } from "@/stores/authStore";

// ============ 云端 endpoint 管理（localStorage 持久化）============
const CLOUD_ENDPOINT_KEY = "lynx-cloud-endpoint";
const DEFAULT_CLOUD_ENDPOINT = "https://ai.lynxdo.com";

export function getCloudEndpoint(): string {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(CLOUD_ENDPOINT_KEY) || DEFAULT_CLOUD_ENDPOINT;
  }
  return DEFAULT_CLOUD_ENDPOINT;
}

export function setCloudEndpoint(endpoint: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CLOUD_ENDPOINT_KEY, endpoint);
  }
}

// 全局事件：401 时通知上层清除登录态并跳转登录页
export const AUTH_EXPIRED_EVENT = "lynx-auth-expired";
// 全局事件：未登录需要弹出登录弹窗
export const LOGIN_REQUIRED_EVENT = "lynx-login-required";

// 应用启动时间戳，用于防抖：启动后 3 秒内的 401 视为初始加载，不弹窗
const APP_START_TIME = Date.now();
const LOGIN_DEBOUNCE_MS = 3000;
let lastLoginPromptTime = 0;

function notifyAuthExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

function notifyLoginRequired() {
  if (typeof window === "undefined") return;
  // 启动后 3 秒内的 401 视为初始加载，不弹窗
  if (Date.now() - APP_START_TIME < LOGIN_DEBOUNCE_MS) return;
  // 防抖：5 秒内只弹一次
  if (Date.now() - lastLoginPromptTime < 5000) return;
  lastLoginPromptTime = Date.now();
  window.dispatchEvent(new CustomEvent(LOGIN_REQUIRED_EVENT));
}

// ============ 离线缓存层（GET 请求缓存 + 断网回退）============
// 内存缓存 + localStorage 持久化，TTL 5 分钟
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_PREFIX = "lynx-cache:";
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function readCache<T>(url: string): T | null {
  // 内存缓存优先
  const mem = memoryCache.get(url);
  if (mem && mem.expiresAt > Date.now()) {
    return mem.data as T;
  }
  // 回退 localStorage
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (entry.expiresAt > Date.now()) {
      memoryCache.set(url, entry);
      return entry.data;
    }
    localStorage.removeItem(CACHE_PREFIX + url);
  } catch {
    // localStorage 损坏或配额满，忽略
  }
  return null;
}

function writeCache<T>(url: string, data: T): void {
  const entry: CacheEntry<T> = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  memoryCache.set(url, entry);
  try {
    localStorage.setItem(CACHE_PREFIX + url, JSON.stringify(entry));
  } catch {
    // 配额满：清旧缓存后重试一次
    try {
      clearExpiredCache();
      localStorage.setItem(CACHE_PREFIX + url, JSON.stringify(entry));
    } catch {
      // 仍失败则放弃持久化，仅保留内存缓存
    }
  }
}

function clearExpiredCache(): void {
  const now = Date.now();
  memoryCache.forEach((v, k) => {
    if (v.expiresAt <= now) memoryCache.delete(k);
  });
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(CACHE_PREFIX)) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(key) || "{}");
        if (entry.expiresAt <= now) localStorage.removeItem(key);
      } catch {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // 忽略
  }
}

/** 供用户手动清空缓存的公开方法 */
export function clearApiCache(): void {
  memoryCache.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // 忽略
  }
}

// ============ fetch 实现的 cloudApi ============
// 走 WebView2 (Edge Chromium) 网络栈，与浏览器完全一致，彻底解决 reqwest TLS 指纹/SNI 阻断问题
export async function cloudRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const base = getCloudEndpoint().replace(/\/+$/, "");
  const url = path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${base}/${path.replace(/^\/+/, "")}`;

  // GET 请求：先查缓存，断网时直接返回缓存
  const isGet = method === "GET";
  if (isGet) {
    const cached = readCache<T>(url);
    if (cached !== null) {
      // 后台静默刷新（不阻塞 UI），失败则保留缓存
      fetch(url, { headers: { "Content-Type": "application/json", ...(useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : {}) } })
        .then((r) => (r.ok ? r.text() : Promise.reject()))
        .then((text) => { if (text) { try { writeCache(url, JSON.parse(text)); } catch { /* ignore */ } } })
        .catch(() => { /* 断网保留缓存 */ });
      return cached;
    }
  }

  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // fetch 网络层错误（DNS/连接/SSL）—— 显示具体错误而非兜底文案
    throw new Error(
      err instanceof Error
        ? `网络请求失败: ${err.message}`
        : "网络请求失败，请检查网络连接"
    );
  }

  // 解析 JSON 响应（空响应返回 null）
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  // 401 处理：
  // - 登录接口 (/api/auth/token) 的 401 是账号密码错误，直接抛后端 message，不触发弹窗
  // - 已登录但 token 过期：触发 auth-expired（清除登录态 + 弹窗）
  // - 未登录（无 token）：触发 login-required（弹窗引导登录，有防抖避免初始加载弹窗）
  if (res.status === 401) {
    const backendMsg = (data as Record<string, unknown>)?.error || (data as Record<string, unknown>)?.message;
    if (path === "/api/auth/token" || path === "/api/auth/register" || path === "/api/auth/sms-code") {
      throw new Error((backendMsg as string) || "用户名或密码错误");
    }
    if (token) {
      notifyAuthExpired();
      throw new Error((backendMsg as string) || "登录已过期，请重新登录");
    }
    notifyLoginRequired();
    throw new Error((backendMsg as string) || "请先登录");
  }

  if (res.status >= 400) {
    const message =
      (data as Record<string, unknown>)?.message ||
      (data as Record<string, unknown>)?.error ||
      `请求失败 (${res.status})`;
    throw new Error(message as string);
  }

  // GET 请求成功：写入缓存供断网回退
  if (isGet && data !== null) {
    writeCache(url, data);
  }

  return data as T;
}

export const cloudApi = {
  get: <T>(path: string) => cloudRequest<T>("GET", path),
  post: <T>(path: string, body?: unknown) => cloudRequest<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => cloudRequest<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => cloudRequest<T>("PATCH", path, body),
  delete: <T>(path: string, body?: unknown) => cloudRequest<T>("DELETE", path, body),
};

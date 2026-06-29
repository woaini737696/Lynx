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

function notifyAuthExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
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
  // - 登录接口 (/api/auth/token) 的 401 是账号密码错误，直接抛后端 message，不触发 auth-expired
  // - 其他接口的 401 是 token 过期，通知上层清除登录态并跳转登录页
  if (res.status === 401) {
    const backendMsg = (data as Record<string, unknown>)?.error || (data as Record<string, unknown>)?.message;
    if (path === "/api/auth/token") {
      throw new Error((backendMsg as string) || "用户名或密码错误");
    }
    notifyAuthExpired();
    throw new Error((backendMsg as string) || "登录已过期，请重新登录");
  }

  if (res.status >= 400) {
    const message =
      (data as Record<string, unknown>)?.message ||
      (data as Record<string, unknown>)?.error ||
      `请求失败 (${res.status})`;
    throw new Error(message as string);
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

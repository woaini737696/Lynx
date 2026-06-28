import { invoke } from "./tauri";

export interface CloudResponse<T = unknown> {
  status: number;
  data: T;
}

// 全局事件：401 时通知上层清除登录态并跳转登录页
export const AUTH_EXPIRED_EVENT = "lynx-auth-expired";

function notifyAuthExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

export async function cloudRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await invoke<CloudResponse<T>>("cloud_request", {
    payload: {
      method,
      path,
      body: body ?? null,
    },
  });

  // 401 处理：
  // - 登录接口 (/api/auth/token) 的 401 是账号密码错误，直接抛后端 message，不触发 auth-expired
  // - 其他接口的 401 是 token 过期，通知上层清除登录态并跳转登录页
  if (res.status === 401) {
    const backendMsg = (res.data as any)?.error || (res.data as any)?.message;
    if (path === "/api/auth/token") {
      throw new Error(backendMsg || "用户名或密码错误");
    }
    notifyAuthExpired();
    throw new Error(backendMsg || "登录已过期，请重新登录");
  }

  if (res.status >= 400) {
    const message = (res.data as any)?.message || (res.data as any)?.error || `请求失败 (${res.status})`;
    throw new Error(message);
  }

  return res.data;
}

export const cloudApi = {
  get: <T>(path: string) => cloudRequest<T>("GET", path),
  post: <T>(path: string, body?: unknown) => cloudRequest<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => cloudRequest<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => cloudRequest<T>("PATCH", path, body),
  delete: <T>(path: string, body?: unknown) => cloudRequest<T>("DELETE", path, body),
};

import { invoke } from "./tauri";

export interface CloudResponse<T = unknown> {
  status: number;
  data: T;
}

export async function cloudRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const res = await invoke<CloudResponse<T>>("cloud_request", {
    method,
    path,
    body: body ?? null,
  });

  if (res.status >= 400) {
    const message = (res.data as any)?.message || (res.data as any)?.error || `请求失败 (${res.status})`;
    throw new Error(message);
  }

  return res.data;
}

export const cloudApi = {
  get: <T>(path: string) => cloudRequest<T>("GET", path),
  post: <T>(path: string, body?: unknown) => cloudRequest<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => cloudRequest<T>("PATCH", path, body),
  delete: <T>(path: string) => cloudRequest<T>("DELETE", path),
};

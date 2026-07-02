// ============ API 客户端 ============
// 基于 fetch 的统一请求封装：
// 1. 自动携带 Bearer token（从 AsyncStorage 读取）
// 2. 统一响应格式解析（{ success, data } / { success: false, error }）
// 3. 统一错误处理（ApiError 抛出）

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, TOKEN_STORAGE_KEY } from '@/config/env';

/** API 错误类型，携带 HTTP 状态码和错误消息 */
export class ApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** 请求配置 */
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** 跳过自动携带 token（登录/注册等公开接口使用） */
  skipAuth?: boolean;
}

/**
 * 统一请求函数。
 *
 * 响应格式约定：
 * - 标准格式成功：{ success: true, data } → 返回 data
 * - 标准格式失败：{ success: false, error: { code, message } } → 抛出 ApiError
 * - 非标准格式（如 auth 端点）：HTTP 状态码判断，成功返回原始 JSON
 *
 * @param path 接口路径（如 /api/auth/token）或完整 URL
 * @param options 请求配置
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // 自动携带 Bearer token
  if (!skipAuth) {
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 解析 JSON（容错：非 JSON 响应返回 null）
  const json = await res.json().catch(() => null);

  // 统一响应格式：{ success: boolean, ... }
  if (json && typeof json.success === 'boolean') {
    if (json.success) {
      return json.data as T;
    }
    const errMsg = json.error?.message ?? '请求失败';
    throw new ApiError(json.error?.code ?? res.status, errMsg);
  }

  // 非标准格式（如 /api/auth/token 返回 { token, user }）：按 HTTP 状态码判断
  if (!res.ok) {
    const errMsg =
      typeof json?.error === 'string'
        ? json.error
        : json?.error?.message ?? `请求失败 (${res.status})`;
    throw new ApiError(res.status, errMsg);
  }

  return json as T;
}

// ============ 便捷方法 ============

export const api = {
  get: <T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),

  post: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),

  put: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

/** SWR fetcher：直接复用 apiRequest，供 useSWR 使用 */
export const swrFetcher = <T = unknown>(path: string): Promise<T> => apiRequest<T>(path);

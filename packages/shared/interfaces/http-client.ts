// HTTP 客户端接口 - 平台适配
// Web 端：fetch（浏览器原生）
// RN 端：fetch（RN 内置）
// Tauri 端：fetch（webview）或 reqwest（Rust 侧代理）

/** HTTP 请求配置 */
export interface HttpRequestConfig {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string | ArrayBuffer | FormData;
  /** 超时（毫秒） */
  timeout?: number;
  /** AbortSignal（用于取消） */
  signal?: AbortSignal;
}

/** HTTP 响应 */
export interface HttpResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  /** 响应体（已解析） */
  data: T;
  /** 原始 Response（Web/Tauri 平台用） */
  raw?: unknown;
}

/** HTTP 客户端接口 */
export interface IHttpClient {
  /** 发送请求 */
  request<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;

  /** GET 请求 */
  get<T = unknown>(url: string, config?: Omit<HttpRequestConfig, "method" | "body">): Promise<HttpResponse<T>>;

  /** POST 请求 */
  post<T = unknown>(url: string, body?: unknown, config?: Omit<HttpRequestConfig, "method" | "body">): Promise<HttpResponse<T>>;

  /** 流式请求（用于 SSE） */
  stream(url: string, body?: unknown, config?: Omit<HttpRequestConfig, "method" | "body">): Promise<ReadableStream<Uint8Array>>;
}

/** 平台环境信息 */
export interface PlatformEnv {
  /** 平台类型 */
  platform: "web" | "ios" | "android" | "windows" | "macos" | "linux";
  /** API 基础 URL */
  apiBaseUrl: string;
  /** WS 网关 URL */
  wsGatewayUrl: string;
  /** 设备名称 */
  deviceName: string;
  /** 用户代理字符串 */
  userAgent: string;
}

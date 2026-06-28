"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

// 客户端 fetcher：处理 401 弹出登录窗、错误抛出
function fetcher(url: string): Promise<any> {
  return fetch(url).then((res) => {
    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== "undefined") {
          // 派发事件，由 AuthProvider 监听并弹出登录窗
          window.dispatchEvent(new Event("auth:unauthorized"));
        }
        throw new Error("未登录");
      }
      throw new Error(`请求失败: ${res.status}`);
    }
    return res.json();
  });
}

// 全局 SWR 配置（仅在客户端组件内构建，避免函数跨 Server/Client 边界）
export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        errorRetryCount: 3,
        errorRetryInterval: 2000,
        shouldRetryOnError: (err: Error) => {
          return !err.message.includes("未登录");
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

// 导出 fetcher 供 useSWR 直接使用
export { fetcher };

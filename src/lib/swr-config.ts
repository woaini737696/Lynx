import type { SWRConfiguration } from "swr";

// 全局 SWR 配置
export const swrConfig: SWRConfiguration = {
  fetcher: (url: string) =>
    fetch(url).then((res) => {
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          throw new Error("未登录");
        }
        throw new Error(`请求失败: ${res.status}`);
      }
      return res.json();
    }),
  revalidateOnFocus: false,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  errorRetryInterval: 2000,
  shouldRetryOnError: (err: Error) => {
    // 401 不重试
    return !err.message.includes("未登录");
  },
};

// 通用 fetcher
export const fetcher = swrConfig.fetcher!;

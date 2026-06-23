"use client";

import { useEffect } from "react";

/**
 * 静默 Next.js App Router 开发模式下的 RSC 请求 abort 噪音。
 *
 * 这些 abort 发生在：
 * 1. InnerLayoutRouter mount 时发起 RSC 请求，组件被快速 unmount 导致 abort
 * 2. navigateReducer 点击 Link 时发起 RSC 请求，快速切换页面导致 abort
 *
 * 这是 Next.js App Router 的已知行为，非业务错误，生产环境不会出现。
 * 通过拦截 console.error / unhandledrejection / onerror 过滤。
 */
export function SuppressDevErrors() {
  useEffect(() => {
    const isAbortError = (reason: unknown): boolean => {
      if (!reason) return false;
      const str =
        typeof reason === "string"
          ? reason
          : reason instanceof Error
            ? `${reason.name} ${reason.message}`
            : "";
      return (
        str.includes("ERR_ABORTED") ||
        str.includes("AbortError") ||
        (str.includes("aborted") && str.includes("_rsc")) ||
        (str.includes("Failed to fetch") && reason instanceof DOMException && reason.name === "AbortError")
      );
    };

    // 1. 拦截 unhandledrejection（fetch abort 会以 Promise rejection 形式冒泡）
    const onUnhandled = (event: PromiseRejectionEvent) => {
      if (isAbortError(event.reason)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("unhandledrejection", onUnhandled, true);

    // 2. 拦截 console.error（Next.js 内部 catch 后会 console.error 输出）
    const originalError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      const str = args
        .map((a) =>
          a instanceof Error
            ? `${a.name} ${a.message}`
            : typeof a === "string"
              ? a
              : "",
        )
        .join(" ");
      if (
        str.includes("ERR_ABORTED") ||
        (str.includes("aborted") && str.includes("_rsc")) ||
        str.includes("Failed to fetch") && args.some((a) => a instanceof DOMException && a.name === "AbortError")
      ) {
        return;
      }
      originalError(...args);
    };

    // 3. 拦截 window.onerror（部分浏览器将网络 abort 作为 error 上报）
    const onError = (event: ErrorEvent) => {
      const msg = event.message || "";
      if (typeof msg === "string" && (msg.includes("ERR_ABORTED") || msg.includes("aborted"))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("error", onError, true);

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandled, true);
      window.removeEventListener("error", onError, true);
      console.error = originalError;
    };
  }, []);

  return null;
}

"use client";

// 登录页已废弃：改为首页内弹窗登录
// 此页面仅做重定向，兼容旧链接和 middleware 兜底
import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    const url = new URL("/", window.location.origin);
    url.searchParams.set("login", "1");
    // 保留 callbackUrl 参数（如果有）
    const params = new URLSearchParams(window.location.search);
    const callbackUrl = params.get("callbackUrl");
    if (callbackUrl) {
      url.searchParams.set("callbackUrl", callbackUrl);
    }
    window.location.replace(url.toString());
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      正在跳转...
    </div>
  );
}

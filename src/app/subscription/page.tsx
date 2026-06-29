"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 订阅与账单页（已合并到会员页）
 *
 * 历史背景：
 * 原先存在两个相关页面：/membership（会员档位）和 /subscription（订阅与账单）。
 * 用户反馈功能重叠，已将账单记录区块合并到 /membership 页面。
 * 本文件保留路由用于向后兼容，自动重定向到 /membership。
 */
export default function SubscriptionRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/membership");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      正在跳转到会员页面...
    </div>
  );
}

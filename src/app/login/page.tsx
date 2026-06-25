"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, User, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("请输入用户名和密码");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // 1. 获取 CSRF token（next-auth v5 要求）
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();

      // 2. 提交登录表单（form-urlencoded，含 csrfToken）
      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          csrfToken,
          username,
          password,
          redirect: "false",
          callbackUrl: "/",
        }),
      });

      if (res.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        setError("用户名或密码错误");
      }
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Logo 和标题 */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(248_84%_62%)] to-[hsl(262_70%_58%)] text-2xl font-bold text-white shadow-lg">
          L
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            LynnHub
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            个人认知操作系统
          </p>
        </div>
      </div>

      {/* 登录卡片 */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <h2 className="mb-6 text-center text-sm font-medium text-muted-foreground">
          登录到你的账户
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 用户名 */}
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="text-xs font-medium text-foreground"
            >
              用户名
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="请输入用户名"
                className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            </div>
          </div>

          {/* 密码 */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium text-foreground"
            >
              密码
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="请输入密码"
                className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-graveyard/30 bg-graveyard/5 px-3 py-2 text-xs text-graveyard">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[hsl(248_84%_62%)] to-[hsl(262_70%_58%)] py-2.5 text-sm font-medium text-white shadow-md transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              "登录"
            )}
          </button>
        </form>
      </div>

      {/* 底部提示 */}
      <div className="mt-6 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
        <span className="text-muted-foreground/80">默认账号：</span>
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-foreground/80">
          admin
        </code>
        /
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-foreground/80">
          admin123
        </code>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}

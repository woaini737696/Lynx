"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  displayName?: string;
  avatarUrl?: string;
  profession?: string;
  role?: string;
};

/**
 * 顶部 header 右上角用户头像菜单
 *
 * 项目未使用 next-auth/react 的 SessionProvider，
 * 改用 fetch /api/auth/session 获取登录用户信息（与 AssistantGlobalEntry 一致）。
 *
 * - hover 显示头像 + 昵称
 * - 下拉菜单：个人资料设置 / 退出登录
 * - 退出登录走 next-auth v5 的 signout 流程（GET csrf → POST /api/auth/signout）
 */
export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => {
        if (cancelled) return;
        if (session?.user) {
          setUser(session.user as SessionUser);
        }
      })
      .catch(() => {
        // 未登录或请求失败，静默处理
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // next-auth v5 signout：先取 csrf token，再 POST /api/auth/signout
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, callbackUrl: "/login" }),
      });
    } catch {
      // 忽略错误，强制跳转登录页
    } finally {
      setSigningOut(false);
      setOpen(false);
      router.push("/login");
      router.refresh();
    }
  };

  const handleProfile = () => {
    setOpen(false);
    router.push("/settings/profile");
  };

  // 加载中：显示占位
  if (loading) {
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 未登录：不渲染
  if (!user) return null;

  const displayName = user.displayName || user.name || "用户";
  const initial = displayName.charAt(0).toUpperCase();
  const hasAvatar = !!user.avatarUrl;

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-2 transition-colors hover:border-border hover:bg-muted/60"
        aria-label="用户菜单"
        aria-expanded={open}
      >
        {hasAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
        )}
        <span className="max-w-[120px] truncate text-xs font-medium text-foreground">
          {displayName}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 w-48 pt-2">
          <div className="rounded-md border border-border bg-popover shadow-lg">
            <button
              type="button"
              onClick={handleProfile}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              个人资料设置
            </button>
            <div className="border-t border-border" />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-xs text-graveyard transition-colors hover:bg-accent disabled:opacity-50"
              )}
            >
              {signingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

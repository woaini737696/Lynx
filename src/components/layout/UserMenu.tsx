"use client";

/**
 * 顶部用户菜单（AppShell 顶部 header 右侧）
 *
 * - 头像（avatarUrl 或首字母）+ 昵称 + 角色徽标
 * - 点击展开下拉：个人资料设置 / 退出登录
 * - 点击外部 / Esc 收起
 * - 复用 Sidebar 的 session 获取模式：localStorage 缓存（避免首屏闪烁）+ fetch 刷新 + 登录成功事件无感刷新
 * - 退出登录走 next-auth v5 csrf signout 流程，跳转 /login
 * - 未登录显示「登录」入口
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Settings, LogOut, Loader2 } from "lucide-react";

interface SessionUser {
  name?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  editor: "编辑",
  viewer: "访客",
};

const CACHE_KEY = "lynx-user-menu-cache";

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. 先读 localStorage 缓存，立即显示（避免首屏闪烁）
  // 2. fetch 最新 session 更新（同时刷新缓存）
  // 3. 监听登录成功事件无感刷新
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setUser(JSON.parse(cached) as SessionUser);
        setLoading(false);
      }
    } catch {
      // 缓存解析失败，忽略
    }

    const refresh = () => {
      fetch("/api/auth/session")
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
          if (s?.user) {
            setUser(s.user as SessionUser);
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(s.user));
            } catch {
              // localStorage 不可用，忽略
            }
          } else {
            setUser(null);
            try {
              localStorage.removeItem(CACHE_KEY);
            } catch {
              // ignore
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    refresh();

    const onLoginSuccess = () => {
      setLoading(true);
      refresh();
    };
    window.addEventListener("auth:login-success", onLoginSuccess);
    return () => window.removeEventListener("auth:login-success", onLoginSuccess);
  }, []);

  // 点击外部 / Esc 收起菜单
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, callbackUrl: "/login" }),
      });
    } catch {
      // ignore
    } finally {
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {
        // ignore
      }
      setUser(null);
      setSigningOut(false);
      setMenuOpen(false);
      router.push("/login");
      router.refresh();
    }
  };

  const name = user?.displayName || user?.name || "";
  const initial = (name || "U").charAt(0).toUpperCase();

  // 加载中且无缓存：显示骨架
  if (loading && !user) {
    return (
      <div className="ios-glass-sm flex h-9 w-9 items-center justify-center rounded-full">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 未登录：显示登录入口
  if (!user) {
    return (
      <button
        type="button"
        onClick={() => router.push("/?login=1")}
        className="ios-glass-sm flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-all hover:text-primary"
        aria-label="登录"
      >
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">登录</span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="ios-glass-sm flex h-9 items-center gap-2 rounded-full pl-1 pr-3 transition-all hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="用户菜单"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={name}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[120px] truncate text-xs font-medium text-foreground sm:inline">
          {name}
        </span>
        {user.role && (
          <span className="hidden rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary md:inline">
            {ROLE_LABELS[user.role] || user.role}
          </span>
        )}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="user-menu absolute right-0 top-full z-[100] mt-1.5 w-56 overflow-hidden rounded-2xl p-1 shadow-2xl"
        >
          {/* 用户信息头 */}
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={name}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {initial}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{name}</p>
              {user.role && (
                <p className="text-[10px] text-muted-foreground">
                  {ROLE_LABELS[user.role] || user.role}
                </p>
              )}
            </div>
          </div>
          <div className="my-1 h-px bg-border/60" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              router.push("/settings/profile");
            }}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-primary/10"
          >
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            个人资料设置
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-graveyard transition-colors hover:bg-graveyard/10 disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

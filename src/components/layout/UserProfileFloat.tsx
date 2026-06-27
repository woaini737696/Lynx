"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Settings2 } from "lucide-react";

export function UserProfileFloat() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string | null; displayName?: string; avatarUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.user) setUser(s.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      setSigningOut(false);
      setMenuOpen(false);
      router.push("/login");
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="fixed bottom-5 left-5 z-50 hidden rounded-2xl glass-user p-3 lg:flex">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return null;

  const displayName = user.displayName || user.name || "用户";
  const initial = displayName.charAt(0).toUpperCase();
  const hasAvatar = !!user.avatarUrl;

  const openMenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setMenuOpen(true);
  };

  const closeMenu = () => {
    closeTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
    }, 180);
  };

  return (
    <div
      className="fixed bottom-5 left-5 z-50 hidden lg:block pb-2"
      onMouseEnter={openMenu}
      onMouseLeave={closeMenu}
    >
      <button
        type="button"
        className="glass-user group flex w-auto min-w-[140px] max-w-[200px] items-center gap-3 rounded-2xl px-3 py-2.5 transition-all"
        aria-label="用户菜单"
        aria-expanded={menuOpen}
      >
        {hasAvatar ? (
          <img
            src={user.avatarUrl}
            alt={displayName}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-border/60 transition-all group-hover:ring-primary/40"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-2 ring-border/60 transition-all group-hover:ring-primary/40">
            {initial}
          </span>
        )}
        <span className="flex-1 truncate text-left text-sm font-medium text-foreground">
          {displayName}
        </span>
      </button>

      {/* 悬浮菜单 */}
      {menuOpen && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-2xl border border-border/60 bg-popover/95 shadow-2xl backdrop-blur-xl">
          <button
            onClick={() => { setMenuOpen(false); router.push("/settings/profile"); }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            个人资料设置
          </button>
          <div className="h-px bg-border/60" />
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-graveyard transition-colors hover:bg-graveyard/10 disabled:opacity-50"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Settings2, ChevronRight, CreditCard, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

export function UserProfileFloat() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string | null; displayName?: string; avatarUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.user) setUser(s.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 点击外部或按 Esc 收起菜单
  useEffect(() => {
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

  return (
    <div
      ref={containerRef}
      className="fixed bottom-5 left-5 z-50 hidden lg:block pb-2"
    >
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="glass-user group flex w-auto min-w-[160px] max-w-[200px] items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all"
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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white shadow-lg shadow-primary/20">
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{displayName}</div>
          <div className="truncate text-[11px] text-muted-foreground">Lynx Web 端</div>
        </div>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
            menuOpen && "rotate-[-90deg]"
          )}
        />
      </button>

      {menuOpen && (
        <div className="user-menu absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-2xl border border-border/60 p-1.5 shadow-2xl">
          <button
            onClick={() => { setMenuOpen(false); router.push("/settings/profile"); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            账号设置
          </button>
          <button
            onClick={() => { setMenuOpen(false); toast("订阅与账单即将上线", "info"); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            订阅与账单
          </button>
          <button
            onClick={() => { setMenuOpen(false); toast("帮助中心即将上线", "info"); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            帮助中心
          </button>
          <div className="my-1 h-px bg-border/60" />
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

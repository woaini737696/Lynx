"use client";

import { useEffect, useState } from "react";
import { useLightningStore } from "@/store/lightning";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Zap, Inbox, Sparkles, Search, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { FastLink } from "./FastLink";

export function CaptureBar() {
  const { open } = useLightningStore();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/ideas");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setCount(data.ideas?.length || 0);
        }
      } catch {
        // ignore
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <header className="glass-bar sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between px-4 lg:px-6">
      {/* 左侧：Lynx Logo + 产品名（放大展示） */}
      <div className="flex items-center gap-3">
        <FastLink
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          {/* Lynx 猞猁 Logo（黑底白图） */}
          <img
            src="/lynx-logo-black.png"
            alt="Lynx"
            className="h-9 w-9 rounded-xl shadow-md"
          />
          {/* 产品名（放大） */}
          <span className="hidden text-lg font-bold tracking-tight text-foreground lg:block">
            Lynx
          </span>
        </FastLink>
      </div>

      {/* 右侧：搜索 + Inbox + 捕获灵感 + 闪电输入 + 主题切换 */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* 搜索 */}
        <button
          onClick={() => window.dispatchEvent(new Event("lynnhub:open-command-palette"))}
          className="glass-btn group flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs text-muted-foreground transition-all hover:text-foreground"
          aria-label="全局搜索"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">搜索</span>
          <kbd className="ml-1 hidden rounded border border-border/60 bg-muted/60 px-1 text-[10px] lg:inline">
            <Command className="inline h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* Inbox */}
        <LinkBadge href="/inbox" count={count} icon={<Inbox className="h-3.5 w-3.5" />} label="Inbox" />

        {/* 捕获灵感 */}
        <button
          onClick={open}
          className="group flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-md transition-all hover:brightness-105 active:scale-[0.97]"
        >
          <Zap className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
          <span className="hidden sm:inline">捕获灵感</span>
        </button>

        {/* 闪电输入（移到右侧） */}
        <button
          onClick={open}
          className="glass-btn group hidden items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs text-muted-foreground transition-all hover:text-foreground lg:flex"
          aria-label="闪电输入"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary transition-transform group-hover:scale-110" />
          <span>闪电输入</span>
          <kbd className="rounded border border-border/60 bg-muted/60 px-1 py-0.5 text-[10px]">
            Ctrl+J
          </kbd>
        </button>

        {/* 主题切换 */}
        <div className="hidden sm:block">
          <ThemeToggle variant="segmented" />
        </div>
        <div className="sm:hidden">
          <ThemeToggle variant="icon" />
        </div>
      </div>
    </header>
  );
}

function LinkBadge({
  href,
  count,
  icon,
  label,
}: {
  href: string;
  count: number;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <FastLink
      href={href}
      className={cn(
        "glass-btn flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs text-muted-foreground transition-all hover:text-foreground",
        count > 0 && "pr-2"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {count > 0 && (
        <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-graveyard px-1 text-[10px] font-medium text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </FastLink>
  );
}

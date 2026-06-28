"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLightningStore } from "@/store/lightning";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Search, Command } from "lucide-react";
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
    <header className="glass-topbar sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between px-4 lg:px-6">
      {/* 左侧：Lynx Logo + 产品名 */}
      <div className="flex items-center gap-3">
        <FastLink
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-80"
        >
          <Image
            src="/lynx-logo-black.png"
            alt="Lynx"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl shadow-md"
          />
          <span className="hidden text-lg font-bold tracking-tight text-foreground lg:block">
            Lynx
          </span>
        </FastLink>
      </div>

      {/* 右侧：搜索 + Inbox + 闪电输入 + 主题切换（1:1 还原 HTML：纯文字胶囊按钮） */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* 搜索 */}
        <button
          onClick={() => window.dispatchEvent(new Event("lynnhub:open-command-palette"))}
          className="ios-glass-sm flex h-9 items-center gap-2 rounded-full px-3 text-xs font-medium text-muted-foreground transition-all hover:text-primary"
          aria-label="全局搜索"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">搜索</span>
          <kbd className="ml-0.5 hidden items-center gap-0.5 rounded border border-border/60 bg-muted/60 px-1 text-[10px] lg:inline-flex">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* Inbox */}
        <FastLink
          href="/inbox"
          className={cn(
            "ios-glass-sm flex h-9 items-center rounded-full px-3 text-xs font-medium text-muted-foreground transition-all hover:text-primary",
            count > 0 && "pr-2"
          )}
        >
          <span>Inbox</span>
          {count > 0 && (
            <span className="ml-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-graveyard px-1 text-[10px] font-medium text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </FastLink>

        {/* 闪电输入（ios-glass-sm 圆形） */}
        <button
          onClick={open}
          className="ios-glass-sm hidden h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-all hover:text-primary lg:flex"
          aria-label="闪电输入"
        >
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



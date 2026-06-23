"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLightningStore } from "@/store/lightning";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Zap, Inbox, Sparkles, Search, Command } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/85 px-4 backdrop-blur-xl lg:px-6">
      <div className="flex items-center gap-3 pl-10 lg:pl-0">
        <Link
          href="/"
          prefetch={false}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-northstar to-orange-600 text-sm font-bold text-white shadow-sm lg:hidden"
        >
          L
        </Link>
        <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
          <Sparkles className="h-3.5 w-3.5 text-northstar" />
          <span>闪电输入</span>
          <kbd className="rounded-lg border border-border bg-muted px-1.5 py-0.5 text-[10px]">
            Ctrl+J
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => window.dispatchEvent(new Event("lynnhub:open-command-palette"))}
          className="group flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="全局搜索"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">搜索</span>
          <kbd className="ml-1 hidden rounded border border-border bg-background px-1 text-[10px] lg:inline">
            <Command className="inline h-2.5 w-2.5" />K
          </kbd>
        </button>
        <LinkBadge href="/inbox" count={count} icon={<Inbox className="h-3.5 w-3.5" />} label="Inbox" />
        <button
          onClick={open}
          className="group flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.97]"
        >
          <Zap className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
          <span className="hidden sm:inline">捕获灵感</span>
        </button>
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
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
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
    </Link>
  );
}

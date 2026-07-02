"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLightningStore } from "@/store/lightning";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Search, Download, Monitor, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { FastLink } from "./FastLink";
import { NAV_ITEMS } from "./Sidebar";
import { UserMenu } from "./UserMenu";
import { usePollWhenVisible } from "@/lib/use-poll-when-visible";

// 未在侧边栏导航中的子路由 → 标题映射（如个人资料设置页）
const EXTRA_ROUTE_TITLES: Record<string, string> = {
  "/settings/profile": "个人资料",
  "/login": "登录",
};

/** 根据 pathname 解析当前页面标题（精确匹配优先，其次最长前缀匹配） */
function resolvePageTitle(pathname: string): string {
  if (EXTRA_ROUTE_TITLES[pathname]) return EXTRA_ROUTE_TITLES[pathname];
  const exact = NAV_ITEMS.find((i) => !i.disabled && i.href === pathname);
  if (exact) return exact.label;
  // 前缀匹配（按长度倒序，取最长匹配），用于 /settings/profile 等子路由
  const prefix = NAV_ITEMS
    .filter((i) => !i.disabled && i.href !== "/" && pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (prefix) return prefix.label;
  return "Lynx";
}

/** 桌面版下载引导弹窗（Portal 渲染到 body，避免被 sticky header 的堆叠上下文遮挡） */
function DesktopDownloadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="glass-modal w-full max-w-md rounded-3xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Monitor className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">下载 Lynx 桌面版</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Lynx 桌面版提供更流畅的原生体验，支持系统托盘、快捷键唤起和离线使用。
          </p>
          <div className="ios-glass-sm rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-task" />
              <span>Windows 10/11 原生支持</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-task" />
              <span>自动连接本地服务，无需浏览器</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-task" />
              <span>深色/浅色/系统自适应主题</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>版本 v1.0.7</span>
            <span>约 6 MB</span>
          </div>
          <a
            href="/desktop-native/dist/lynx_1.0.7.exe"
            download
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all"
          >
            <Download className="h-4 w-4" />
            立即下载
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CaptureBar() {
  const { open } = useLightningStore();
  const pathname = usePathname();
  const pageTitle = useMemo(() => resolvePageTitle(pathname), [pathname]);
  const [count, setCount] = useState(0);
  const [showDownload, setShowDownload] = useState(false);

  // 灵感数量轮询：tab 不可见时暂停，节省网络
  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/ideas");
      if (res.ok) {
        const data = await res.json();
        setCount(data.ideas?.length || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  usePollWhenVisible(fetchCount, 30_000, { immediate: true });

  return (
    <header className="glass-topbar sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between px-4 lg:px-6">
      {/* 左侧：Lynx 品牌 logo + 当前页面标题（usePathname 映射） */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Image
          src="/lynx-icon-128.png"
          alt="Lynx"
          width={24}
          height={24}
          className="shrink-0 rounded-md"
          priority
        />
        <h1 className="truncate text-sm font-semibold text-foreground">
          {pageTitle}
        </h1>
      </div>

      {/* 右侧：搜索 + Inbox + 闪电输入 + 桌面下载 + 主题切换 + 用户菜单 */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* 搜索 */}
        <button
          onClick={() => window.dispatchEvent(new Event("lynnhub:open-command-palette"))}
          className="ios-glass-sm flex h-9 items-center gap-2 rounded-full px-3 text-xs font-medium text-muted-foreground transition-all hover:text-primary"
          aria-label="全局搜索"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">搜索</span>
          <span className="ml-0.5 hidden items-center gap-0.5 text-[10px] opacity-70 lg:inline-flex">
            ⌘K
          </span>
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

        {/* 闪电输入 */}
        <button
          onClick={open}
          className="ios-glass-sm hidden h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-all hover:text-primary lg:flex"
          aria-label="闪电输入"
        >
          <span>闪电输入</span>
          <span className="text-[10px] opacity-70">Ctrl+J</span>
        </button>

        {/* 桌面版下载引导 */}
        <button
          onClick={() => setShowDownload(true)}
          className="ios-glass-sm flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-muted-foreground transition-all hover:text-primary"
          aria-label="下载桌面版"
          title="下载 Lynx 桌面版"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">桌面版</span>
        </button>

        {/* 主题切换 */}
        <div className="hidden sm:block">
          <ThemeToggle variant="segmented" />
        </div>
        <div className="sm:hidden">
          <ThemeToggle variant="icon" />
        </div>

        {/* 分隔线 + 用户菜单（头像 / 昵称 / 角色徽标 / 退出登录） */}
        <div className="mx-1 h-5 w-px bg-border/40" aria-hidden="true" />
        <UserMenu />
      </div>

      <DesktopDownloadModal open={showDownload} onClose={() => setShowDownload(false)} />
    </header>
  );
}



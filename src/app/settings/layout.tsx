"use client";

// 设置 layout：二级 Tab 导航（基础配置 / AI 巡检 / 飞书机器人 / 通知 / 性能 / 远程 / 备份）
// 信息架构精简：原侧边栏"系统"组的 7 个子页全收纳进 /settings 二级 Tab
// 使用路由级 Tab（layout + 子路由），保留 /settings/* 各子页的 URL 状态依赖
// /settings/page.tsx 作为"基础配置"Tab（保留原 5 Tab 内部结构），子页完全不改动
// 注：dev-log 因路径不在 /settings/* 下，保留为侧边栏独立项
import { usePathname, useRouter } from "next/navigation";
import {
  Settings as SettingsIcon,
  Radar,
  MessageCircle,
  Bell,
  Activity,
  Monitor,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

const TABS = [
  { href: "/settings", label: "基础配置", icon: SettingsIcon, match: (p: string) => p === "/settings" },
  { href: "/settings/patrol", label: "AI 巡检", icon: Radar, match: (p: string) => p.startsWith("/settings/patrol") },
  { href: "/settings/lark-bot", label: "飞书机器人", icon: MessageCircle, match: (p: string) => p.startsWith("/settings/lark-bot") },
  { href: "/settings/push", label: "通知", icon: Bell, match: (p: string) => p.startsWith("/settings/push") },
  { href: "/settings/diagnostics", label: "性能监控", icon: Activity, match: (p: string) => p.startsWith("/settings/diagnostics") },
  { href: "/settings/remote-control", label: "远程操控", icon: Monitor, match: (p: string) => p.startsWith("/settings/remote-control") },
  { href: "/settings/backup", label: "数据备份", icon: Database, match: (p: string) => p.startsWith("/settings/backup") },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleTabClick = useCallback(
    (href: string) => {
      if (!pathname.startsWith(href)) router.push(href);
    },
    [pathname, router]
  );

  return (
    <div>
      {/* sticky 二级 Tab 横向导航 */}
      <div className="sticky top-0 z-20 -mx-1 px-1 pt-2">
        <div className="glass-card flex gap-1 overflow-x-auto rounded-2xl p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(pathname);
            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => handleTabClick(tab.href)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      {children}
    </div>
  );
}

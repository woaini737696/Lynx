"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Target,
  KanbanSquare,
  Inbox,
  Moon,
  Skull,
  MessageSquare,
  BookOpen,
  Brain,
  LayoutGrid,
  Workflow,
  Bot,
  Wrench,
  Store,
  ListTodo,
  Settings,
  Radar,
  MessageCircle,
  Bell,
  Activity,
  Database,
  ScrollText,
  Monitor,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FastLink } from "./FastLink";

const EXCLUDED_PATHS = new Set(["/login", "/register"]);

const ROUTE_MAP: Record<string, { label: string; icon: LucideIcon }> = {
  "/": { label: "今日聚焦", icon: Target },
  "/board": { label: "决策看板", icon: KanbanSquare },
  "/inbox": { label: "Inbox", icon: Inbox },
  "/converge": { label: "灵感收敛", icon: Moon },
  "/graveyard": { label: "灵感墓地", icon: Skull },
  "/assets": { label: "对话资产", icon: MessageSquare },
  "/cognition": { label: "认知库", icon: BookOpen },
  "/memory": { label: "记忆图谱", icon: Brain },
  "/ai/workspace": { label: "AI 工作空间", icon: LayoutGrid },
  "/ai/flows": { label: "AI 工作流", icon: Workflow },
  "/ai/assistant": { label: "Lynx超级助理", icon: Bot },
  "/skills": { label: "技能管理", icon: Wrench },
  "/skills/market": { label: "Skill 市场", icon: Store },
  "/ai/lark-tasks": { label: "飞书任务", icon: ListTodo },
  "/settings": { label: "设置", icon: Settings },
  "/settings/patrol": { label: "AI 巡检", icon: Radar },
  "/settings/lark-bot": { label: "飞书机器人", icon: MessageCircle },
  "/settings/push": { label: "通知设置", icon: Bell },
  "/settings/diagnostics": { label: "性能监控", icon: Activity },
  "/settings/remote-control": { label: "远程操控", icon: Monitor },
  "/settings/backup": { label: "数据备份", icon: Database },
  "/dev-log": { label: "开发日志", icon: ScrollText },
};

function getRouteInfo(path: string) {
  const exact = ROUTE_MAP[path];
  if (exact) return exact;

  // 尝试去掉末尾斜杠
  const noSlash = path.replace(/\/$/, "");
  if (noSlash !== path && ROUTE_MAP[noSlash]) return ROUTE_MAP[noSlash];

  // 兜底：取最后一段并中文化常见词汇
  const segment = path.split("/").filter(Boolean).pop() || "page";
  const labelMap: Record<string, string> = {
    login: "登录",
    register: "注册",
    profile: "个人资料",
    admin: "管理后台",
  };
  return {
    label: labelMap[segment] || segment,
    icon: FileText,
  };
}

/**
 * 底部中央最近页面快速切换入口
 * - 最多保留 3 个最近打开的页面
 * - 在当前 3 个页面之间切换不重新排序
 * - 打开新页面时追加到右侧，超过 3 个移除最左侧
 */
export function RecentTabs() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [displayPages, setDisplayPages] = useState<string[]>([]);
  const [prevRecent, setPrevRecent] = useState<string[]>([]);
  const [enteringSet, setEnteringSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  // 路由变化时更新 recent 队列
  useEffect(() => {
    if (!pathname) return;
    if (EXCLUDED_PATHS.has(pathname)) return;

    setRecent((prev) => {
      if (prev.includes(pathname)) {
        return prev;
      }
      const next = [...prev, pathname];
      if (next.length > 3) next.shift();
      return next;
    });
  }, [pathname]);

  // 同步 displayPages，并处理离开动画
  useEffect(() => {
    const prevSet = new Set(prevRecent);
    const currentSet = new Set(recent);
    const removed = prevRecent.filter((p) => !currentSet.has(p));
    const added = recent.filter((p) => !prevSet.has(p));

    if (added.length > 0) {
      setDisplayPages(recent);
      setEnteringSet(new Set(added));
      const t = setTimeout(() => setEnteringSet(new Set()), 350);
      return () => clearTimeout(t);
    }

    if (removed.length > 0) {
      setDisplayPages([...recent, ...removed]);
      const t = setTimeout(() => {
        setDisplayPages(recent);
        setPrevRecent(recent);
      }, 300);
      return () => clearTimeout(t);
    }

    setDisplayPages(recent);
    if (recent.length !== prevRecent.length || !recent.every((p, i) => p === prevRecent[i])) {
      setPrevRecent(recent);
    }
  }, [recent, prevRecent]);

  const leavingSet = useMemo(() => {
    return new Set(displayPages.filter((p) => !recent.includes(p)));
  }, [displayPages, recent]);

  if (!mounted || displayPages.length === 0) return null;

  return (
    <div className="recent-tabs ios-glass rounded-full p-1.5 flex items-center">
      {displayPages.map((page) => {
        const isLeaving = leavingSet.has(page);
        const isNew = enteringSet.has(page);
        const info = getRouteInfo(page);
        const Icon = info.icon;

        return (
          <FastLink
            key={page}
            href={page}
            className={cn(
              "recent-tab flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground ios-glass-sm",
              page === pathname && !isLeaving && "active",
              isNew && "entering",
              isLeaving && "leaving"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="shrink-0">{info.label}</span>
          </FastLink>
        );
      })}
    </div>
  );
}

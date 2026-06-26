"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Target,
  KanbanSquare,
  MessageSquare,
  Brain,
  BookOpen,
  Skull,
  Inbox,
  Moon,
  Settings,
  PanelLeft,
  X,
  ChevronDown,
  Sparkles,
  LayoutGrid,
  Workflow,
  Bot,
  MessageCircle,
  ListTodo,
  Wrench,
  Store,
  ScrollText,
  Activity,
  Users,
  Database,
  Bell,
  Radar,
  Shield,
  Briefcase,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  color: string;
  disabled?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "execute",
    label: "今日执行",
    icon: Target,
    color: "text-northstar",
    items: [
      { href: "/", label: "今日聚焦", icon: Target, color: "text-northstar" },
      { href: "/board", label: "决策看板", icon: KanbanSquare, color: "text-campaign" },
    ],
  },
  {
    id: "capture",
    label: "灵感收集",
    icon: Inbox,
    color: "text-foreground",
    items: [
      { href: "/inbox", label: "Inbox", icon: Inbox, color: "text-foreground" },
      { href: "/converge", label: "灵感收敛", icon: Moon, color: "text-northstar" },
      { href: "/graveyard", label: "灵感墓地", icon: Skull, color: "text-graveyard" },
    ],
  },
  {
    id: "assets",
    label: "知识资产",
    icon: Brain,
    color: "text-cognition",
    items: [
      { href: "/assets", label: "对话资产", icon: MessageSquare, color: "text-campaign" },
      { href: "/cognition", label: "认知库", icon: BookOpen, color: "text-cognition" },
      { href: "/memory", label: "记忆图谱", icon: Brain, color: "text-cognition" },
    ],
  },
  {
    id: "ai",
    label: "AI 中心",
    icon: Sparkles,
    color: "text-cognition",
    items: [
      { href: "/ai/workspace", label: "AI 工作空间", icon: LayoutGrid, color: "text-cognition" },
      { href: "/ai/flows", label: "AI 工作流", icon: Workflow, color: "text-cognition" },
      { href: "/ai/assistant", label: "AI 专属助理", icon: Bot, color: "text-cognition" },
      { href: "/skills", label: "技能管理", icon: Wrench, color: "text-cognition" },
      { href: "/skills/market", label: "Skill 市场", icon: Store, color: "text-cognition" },
      { href: "/ai/lark-tasks", label: "飞书任务", icon: ListTodo, color: "text-cognition" },
    ],
  },
  {
    id: "system",
    label: "系统",
    icon: Settings,
    color: "text-muted-foreground",
    items: [
      { href: "/settings", label: "设置", icon: Settings, color: "text-muted-foreground" },
      { href: "/settings/patrol", label: "AI 巡检", icon: Radar, color: "text-cognition" },
      { href: "/settings/lark-bot", label: "飞书机器人", icon: MessageCircle, color: "text-campaign" },
      { href: "/settings/push", label: "通知设置", icon: Bell, color: "text-muted-foreground" },
      { href: "/settings/diagnostics", label: "性能监控", icon: Activity, color: "text-task" },
      { href: "/settings/backup", label: "数据备份", icon: Database, color: "text-muted-foreground" },
      { href: "/dev-log", label: "开发日志", icon: ScrollText, color: "text-muted-foreground" },
    ],
  },
  {
    id: "admin",
    label: "管理",
    icon: Users,
    color: "text-muted-foreground",
    items: [
      { href: "/admin/users", label: "用户管理", icon: Users, color: "text-muted-foreground" },
      { href: "/admin/roles", label: "角色管理", icon: Shield, color: "text-muted-foreground" },
      { href: "/admin/profession-workspaces", label: "职业工作空间", icon: Briefcase, color: "text-muted-foreground" },
      { href: "/admin/token-stats", label: "词元统计", icon: Coins, color: "text-muted-foreground" },
    ],
  },
];

function findActiveGroup(pathname: string) {
  return NAV_GROUPS.find((g) => g.items.some((i) => !i.disabled && i.href === pathname))?.id || null;
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  const activeGroupId = useMemo(() => findActiveGroup(pathname), [pathname]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV_GROUPS.forEach((g) => {
      init[g.id] = g.id === activeGroupId;
    });
    return init;
  });

  const toggleGroup = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDisabledClick = (label: string) => {
    toast(`${label} 即将上线`, "info");
  };

  return (
    <>
      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 移动端菜单按钮 */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-3.5 z-30 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted lg:hidden"
        aria-label="打开菜单"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-border bg-card transition-all duration-300 ease-in-out lg:sticky lg:top-0 lg:h-full",
          collapsed ? "w-[72px] px-2" : "w-[210px] px-3",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo 区域 */}
        <div className="flex h-14 items-center justify-between border-b border-border/60 px-1">
          <Link
            href="/"
            prefetch={false}
            className={cn(
              "flex items-center gap-2 transition-opacity",
              collapsed ? "opacity-0" : "opacity-100"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              L
            </div>
            <span className="text-sm font-semibold tracking-tight">LynnHub</span>
          </Link>

          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="关闭菜单"
          >
            <X className="h-4 w-4" />
          </button>

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <PanelLeft
              className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
            />
          </button>
        </div>

        {/* 分组导航 */}
        <nav className="flex-1 space-y-4 overflow-y-auto py-4">
          {NAV_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            const isGroupActive = group.id === activeGroupId;
            const isExpanded = !!expanded[group.id];
            const hasActiveItem = isGroupActive;

            return (
              <div key={group.id}>
                {/* 组标题 */}
                {collapsed ? (
                  <div className="relative">
                    <button
                      onClick={() => setOpenPopover(openPopover === group.id ? null : group.id)}
                      onMouseEnter={() => setOpenPopover(group.id)}
                      className={cn(
                        "group flex w-full items-center justify-center rounded-xl px-2 py-2 transition-all",
                        hasActiveItem
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      aria-label={group.label}
                    >
                      {hasActiveItem && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                      )}
                      <GroupIcon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          hasActiveItem ? group.color : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                    </button>

                    {openPopover === group.id && (
                      <div
                        className="absolute left-full top-0 z-50 ml-2 w-40 rounded-xl border border-border bg-card p-2 shadow-lg"
                        onMouseLeave={() => setOpenPopover(null)}
                      >
                        <div className="mb-1 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                          {group.label}
                        </div>
                        <div className="space-y-0.5">
                          {group.items.map((item) => (
                            <NavLinkOrButton
                              key={item.href}
                              item={item}
                              pathname={pathname}
                              onClick={() => {
                                if (item.disabled) handleDisabledClick(item.label);
                                setOpenPopover(null);
                              }}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all",
                      hasActiveItem
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <GroupIcon
                      className={cn(
                        "h-[16px] w-[16px] shrink-0 transition-colors",
                        hasActiveItem ? group.color : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                        !isExpanded && "-rotate-90"
                      )}
                    />
                  </button>
                )}

                {/* 组内项目（展开状态） */}
                {!collapsed && isExpanded && (
                  <div className="mt-1 space-y-0.5 pl-2">
                    {group.items.map((item) => (
                      <NavLinkOrButton
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        onClick={() => {
                          if (item.disabled) handleDisabledClick(item.label);
                          setMobileOpen(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* 底部提示 */}
        <div
          className={cn(
            "border-t border-border/60 py-3 text-[10px] text-muted-foreground/60 transition-opacity",
            collapsed ? "px-1 text-center opacity-0" : "px-2 opacity-100"
          )}
        >
          按 Ctrl+J 捕获灵感
        </div>
      </aside>
    </>
  );
}

function NavLinkOrButton({
  item,
  pathname,
  onClick,
  compact = false,
}: {
  item: NavItem;
  pathname: string;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  const isActive = !item.disabled && pathname === item.href;
  const content = (
    <>
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          compact ? "h-4 w-4" : "h-[18px] w-[18px]",
          isActive ? item.color : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      <span
        className={cn(
          "flex-1 truncate transition-colors",
          compact ? "text-xs" : "text-sm",
          item.disabled && "text-muted-foreground/60"
        )}
      >
        {item.label}
      </span>
      {item.disabled && (
        <span className="ml-auto rounded bg-muted px-1 py-0 text-[9px] text-muted-foreground">待上线</span>
      )}
    </>
  );

  const className = cn(
    "group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all",
    compact ? "px-2 py-1.5" : "",
    isActive
      ? "bg-primary/10 font-medium text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
    item.disabled && "cursor-not-allowed opacity-70 hover:bg-transparent"
  );

  if (item.disabled) {
    return (
      <button onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onClick}
      className={className}
    >
      {content}
    </Link>
  );
}

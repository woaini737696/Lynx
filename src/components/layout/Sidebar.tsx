"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  ChevronRight,
  CreditCard,
  HelpCircle,
  Sparkles,
  LayoutGrid,
  Workflow,
  Bot,
  Wrench,
  Store,
  ListTodo,
  Radar,
  MessageCircle,
  Bell,
  Activity,
  Database,
  ScrollText,
  Monitor,
  Users,
  Shield,
  Briefcase,
  Coins,
  LogOut,
  Loader2,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { FastLink } from "./FastLink";

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
  requiredRole?: "admin";
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
      { href: "/settings/remote-control", label: "远程操控", icon: Monitor, color: "text-northstar" },
      { href: "/settings/backup", label: "数据备份", icon: Database, color: "text-muted-foreground" },
      { href: "/dev-log", label: "开发日志", icon: ScrollText, color: "text-muted-foreground" },
    ],
  },
  {
    id: "admin",
    label: "管理",
    icon: Users,
    color: "text-muted-foreground",
    requiredRole: "admin",
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

/* ============ 侧边栏底部用户区域（移动端抽屉用） ============ */
function SidebarUserProfile() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string | null; displayName?: string; avatarUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. 先从 localStorage 读取缓存的用户信息，立即显示（避免首屏闪烁）
    //    注意：next-auth v5 的 session cookie 是 httpOnly，document.cookie 读不到，
    //    所以无法用 cookie 判断登录态，只能依赖 localStorage 缓存 + fetch 更新
    try {
      const cached = localStorage.getItem("lynx-sidebar-user");
      if (cached) {
        const cachedUser = JSON.parse(cached) as { name?: string | null; displayName?: string; avatarUrl?: string };
        setUser(cachedUser);
        setLoading(false); // 立即显示缓存用户，首屏即最终态
      }
    } catch {
      // 缓存解析失败，忽略
    }

    // 2. fetch 最新 session 更新（同时刷新缓存）
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.user) {
          setUser(s.user);
          try {
            localStorage.setItem("lynx-sidebar-user", JSON.stringify(s.user));
          } catch {
            // localStorage 不可用，忽略
          }
        } else {
          // session 失效，清除缓存显示未登录
          setUser(null);
          try {
            localStorage.removeItem("lynx-sidebar-user");
          } catch {
            // ignore
          }
        }
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
      // 清除本地缓存的用户信息，避免下次访问仍显示已登出用户
      try {
        localStorage.removeItem("lynx-sidebar-user");
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

  if (loading) {
    // 仅在有 session cookie 但无 localStorage 缓存时才会显示此占位（首次登录后访问）
    // 显示中性占位（默认头像 + 加载提示），不显示"未登录"避免误导
    return (
      <div className="relative mt-auto pt-3">
        <div className="glass-user group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left opacity-60">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white shadow-lg shadow-primary/20">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">Lynx</div>
            <div className="truncate text-[11px] text-muted-foreground">加载中…</div>
          </div>
        </div>
      </div>
    );
  }
  if (!user) {
    // 未登录：显示默认头像，点击跳转登录页
    return (
      <div className="relative mt-auto pt-3">
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="glass-user group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all"
          aria-label="前往登录"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white shadow-lg shadow-primary/20">
            ?
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">未登录</div>
            <div className="truncate text-[11px] text-muted-foreground">点击登录 Lynx</div>
          </div>
        </button>
      </div>
    );
  }

  const displayName = user.displayName || user.name || "用户";
  const initial = displayName.charAt(0).toUpperCase();
  const hasAvatar = !!user.avatarUrl;

  return (
    <div ref={containerRef} className="relative mt-auto pt-3">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="glass-user group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all"
        aria-label="用户菜单"
        aria-expanded={menuOpen}
      >
        {hasAvatar ? (
          <Image
            src={user.avatarUrl || ""}
            alt={displayName}
            width={36}
            height={36}
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

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setUserRole((s?.user as { role?: string } | undefined)?.role || null))
      .catch(() => setUserRole(null));
  }, []);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.filter((g) => {
      if (!g.requiredRole) return true;
      return userRole === g.requiredRole;
    });
  }, [userRole]);

  const activeGroupId = useMemo(() => findActiveGroup(pathname), [pathname]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV_GROUPS.forEach((g) => {
      init[g.id] = g.id === activeGroupId;
    });
    return init;
  });

  // 当前路径切换后，自动展开所在分组（仅在 activeGroupId 变化时触发，避免用户手动收起后被强制展开）
  const prevActiveGroupIdRef = useRef<string | null>(activeGroupId);
  useEffect(() => {
    if (activeGroupId && activeGroupId !== prevActiveGroupIdRef.current) {
      setExpanded((prev) => {
        if (prev[activeGroupId]) return prev;
        return { ...prev, [activeGroupId]: true };
      });
    }
    prevActiveGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

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
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-md lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 移动端菜单按钮 */}
      <button
        onClick={() => setMobileOpen(true)}
        className="glass-btn fixed left-4 top-3.5 z-30 flex h-9 w-9 items-center justify-center rounded-xl text-foreground lg:hidden"
        aria-label="打开菜单"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      <aside
        className={cn(
          "desktop-sidebar-full glass-sidebar fixed left-0 top-0 z-50 flex h-screen w-[230px] flex-col px-3 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:sticky lg:top-0 lg:h-full",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* 顶部：关闭按钮（仅移动端） */}
        <div className="flex h-14 items-center justify-end border-b border-border/60 px-1 lg:hidden">
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭菜单"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 分组导航 */}
        <nav className="flex-1 space-y-1 overflow-y-auto py-2 pr-1">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isGroupActive = group.id === activeGroupId;
            const isExpanded = !!expanded[group.id];

            return (
              <div key={group.id}>
                {/* 组标题 */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-all",
                    isGroupActive
                      ? "glass-active"
                      : "nav-item text-foreground/80 hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <GroupIcon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 transition-colors",
                      isGroupActive ? group.color : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                      isExpanded && "rotate-90"
                    )}
                  />
                </button>

                {/* 组内项目（纯文字） */}
                {isExpanded && (
                  <div className="mt-1 space-y-0.5 pl-2.5">
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

        {/* 底部：用户头像昵称 */}
        <div className="border-t border-border/60 py-3">
          <SidebarUserProfile />
        </div>
      </aside>
    </>
  );
}

function NavLinkOrButton({
  item,
  pathname,
  onClick,
}: {
  item: NavItem;
  pathname: string;
  onClick: () => void;
}) {
  const isActive = !item.disabled && pathname === item.href;

  const content = (
    <>
      <span
        className={cn(
          "flex-1 truncate text-sm transition-colors",
          item.disabled && "text-muted-foreground/60"
        )}
      >
        {item.label}
      </span>
      {item.disabled && (
        <span className="ml-auto rounded bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">待上线</span>
      )}
    </>
  );

  const className = cn(
    "group relative flex w-full items-center rounded-xl px-3 py-2 transition-all",
    isActive
      ? "glass-active font-medium text-primary before:absolute before:left-[6px] before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary"
      : "nav-item text-muted-foreground hover:text-foreground",
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
    <FastLink href={item.href} onClick={onClick} className={className}>
      {content}
    </FastLink>
  );
}

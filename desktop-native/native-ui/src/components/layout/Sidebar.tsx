import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Target,
  LayoutDashboard,
  Sparkles,
  Bot,
  Settings,
  Cpu,
  Brain,
  Skull,
  Inbox as InboxIcon,
  Briefcase,
  Bot as AiIcon,
  Workflow,
  BookMarked,
  Wallet as WalletIcon,
  Crown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { UserMenu } from "./UserMenu";

type TabKey = "work" | "ai";

interface NavEntry {
  to: string;
  label: string;
  icon: React.ElementType;
}

const NAV_GROUPS: Record<TabKey, { label: string; icon: React.ElementType; items: NavEntry[] }> = {
  work: {
    label: "工作",
    icon: Briefcase,
    items: [
      { to: "/focus", label: "今日聚焦", icon: Target },
      { to: "/inbox", label: "Inbox", icon: InboxIcon },
      { to: "/board", label: "决策看板", icon: LayoutDashboard },
      { to: "/graveyard", label: "灵感墓地", icon: Skull },
      { to: "/cognition", label: "认知库", icon: Brain },
    ],
  },
  ai: {
    label: "AI",
    icon: AiIcon,
    items: [
      { to: "/ai/workspace", label: "AI 工作空间", icon: Sparkles },
      { to: "/ai/flows", label: "AI 工作流", icon: Workflow },
      { to: "/ai/assistant", label: "Lynx超级助理", icon: Bot },
      { to: "/skills", label: "技能管理", icon: BookMarked },
      { to: "/agent", label: "Lynx Agent", icon: Cpu },
    ],
  },
};

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>(() => {
    for (const [key, group] of Object.entries(NAV_GROUPS)) {
      if (group.items.some((it) => location.pathname.startsWith(it.to))) {
        return key as TabKey;
      }
    }
    return "work";
  });

  const currentItems = NAV_GROUPS[tab].items;

  return (
    <aside className="glass-sidebar flex h-full w-56 shrink-0 flex-col">
      {/* 顶部 Logo 区 - 对齐 Web端：28x28 logo + LYNX 字标 */}
      <div className="flex h-14 shrink-0 items-center px-3">
        <button
          onClick={() => navigate("/focus")}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <img
            src="/lynx-icon-128.png"
            alt="Lynx"
            className="h-7 w-7 rounded-lg shadow-md"
            draggable={false}
          />
          <span className="text-base font-bold tracking-tight text-foreground">LYNX</span>
        </button>
      </div>

      {/* Tab 分段控制器：工作 / AI */}
      <div className="px-3 pb-2">
        <div className="flex rounded-xl bg-muted/40 p-1">
          {(Object.keys(NAV_GROUPS) as TabKey[]).map((key) => {
            const isActive = tab === key;
            const Icon = NAV_GROUPS[key].icon;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-tab-indicator"
                    className="absolute inset-0 rounded-lg bg-primary/15 shadow-[inset_0_1px_1px_hsl(var(--glass-highlight)/0.18),0_0_0_1px_hsl(var(--primary)/0.2)]"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative h-3.5 w-3.5" />
                <span className="relative">{NAV_GROUPS[key].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 导航项 - 对齐 Web端样式：glass-active + nav-item */}
      <div className="flex-1 overflow-y-auto px-2.5">
        <AnimatePresence mode="wait">
          <motion.nav
            key={tab}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-1"
          >
            {currentItems.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                active={location.pathname.startsWith(item.to)}
              />
            ))}
          </motion.nav>
        </AnimatePresence>
      </div>

      {/* 底部：账户分组 + 设置 + 用户卡片 */}
      <div className="shrink-0 px-2.5 pb-3">
        {/* 账户分组：钱包 + 会员（独立于 work/ai 分组，始终可见） */}
        <div className="mb-2 flex flex-col gap-1">
          <NavLink
            to="/wallet"
            className={({ isActive }) =>
              cn(
                "group relative flex w-full items-center rounded-xl px-2.5 py-1.5 text-[13px] transition-all",
                isActive
                  ? "glass-active font-medium text-primary"
                  : "nav-item text-muted-foreground hover:text-foreground"
              )
            }
          >
            <WalletIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">钱包</span>
          </NavLink>
          <NavLink
            to="/membership"
            className={({ isActive }) =>
              cn(
                "group relative flex w-full items-center rounded-xl px-2.5 py-1.5 text-[13px] transition-all",
                isActive
                  ? "glass-active font-medium text-primary"
                  : "nav-item text-muted-foreground hover:text-foreground"
              )
            }
          >
            <Crown className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">会员</span>
          </NavLink>
        </div>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "group relative flex w-full items-center rounded-xl px-2.5 py-1.5 text-[13px] transition-all",
              isActive
                ? "glass-active font-medium text-primary"
                : "nav-item text-muted-foreground hover:text-foreground"
            )
          }
        >
          <Settings className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">设置</span>
        </NavLink>

        <div className="mt-2">
          <UserMenu collapsed={false} />
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={cn(
        "group relative flex w-full items-center rounded-xl px-2.5 py-1.5 text-[13px] transition-all",
        active
          ? "glass-active font-medium text-primary"
          : "nav-item text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="mr-2 h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

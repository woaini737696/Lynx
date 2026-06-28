import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Target,
  LayoutDashboard,
  Sparkles,
  Bot,
  Settings,
  Cpu,
  Brain,
  Skull,
  Search as SearchIcon,
  Inbox as InboxIcon,
  Briefcase,
  Bot as AiIcon,
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
      { to: "/search", label: "全局搜索", icon: SearchIcon },
      { to: "/cognition", label: "认知库", icon: Brain },
    ],
  },
  ai: {
    label: "AI",
    icon: AiIcon,
    items: [
      { to: "/ai/workspace", label: "AI 工作空间", icon: Sparkles },
      { to: "/ai/assistant", label: "AI 专属助理", icon: Bot },
      { to: "/agent", label: "Lynx Agent", icon: Cpu },
    ],
  },
};

export function Sidebar() {
  const location = useLocation();
  const [tab, setTab] = useState<TabKey>(() => {
    // 根据当前路由自动选择 Tab
    for (const [key, group] of Object.entries(NAV_GROUPS)) {
      if (group.items.some((it) => location.pathname.startsWith(it.to))) {
        return key as TabKey;
      }
    }
    return "work";
  });

  const currentItems = NAV_GROUPS[tab].items;

  return (
    <aside className="glass-sidebar flex h-full w-56 shrink-0 flex-col justify-between">
      <div className="flex flex-col gap-3 p-3">
        {/* Tab 分段控制器：工作 / AI */}
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

        {/* 导航项（Tab 切换动画） */}
        <AnimatePresence mode="wait">
          <motion.nav
            key={tab}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-1.5"
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

      <div className="flex flex-col gap-2 p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
              isActive && "glass-active text-foreground"
            )
          }
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">设置</span>
        </NavLink>

        <div className="mt-1">
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
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
        active && "glass-active text-foreground"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

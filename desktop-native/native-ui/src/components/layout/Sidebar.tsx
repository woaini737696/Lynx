import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Target,
  LayoutDashboard,
  Sparkles,
  Cpu,
  Brain,
  Skull,
  Inbox as InboxIcon,
  Briefcase,
  Bot as AiIcon,
  Workflow,
  BookMarked,
  MessageSquare,
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
      { to: "/ai/assistant", label: "Lynx超级助理", icon: MessageSquare },
      { to: "/skills", label: "技能管理", icon: BookMarked },
      { to: "/agent", label: "Lynx Agent", icon: Cpu },
    ],
  },
};

export function Sidebar() {
  const location = useLocation();
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
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border/40 bg-sidebar/50 backdrop-blur-xl">
      {/* 顶部 Tab 切换 */}
      <div className="flex gap-1 p-2.5">
        {(Object.keys(NAV_GROUPS) as TabKey[]).map((key) => {
          const group = NAV_GROUPS[key];
          const Icon = group.icon;
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {group.label}
            </button>
          );
        })}
      </div>

      {/* 导航列表 */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            className="space-y-0.5"
          >
            {currentItems.map((item) => (
              <NavItem
                key={item.to}
                {...item}
                active={location.pathname.startsWith(item.to)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </nav>

      {/* 底部用户区 */}
      <div className="border-t border-border/40 p-2">
        <UserMenu />
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

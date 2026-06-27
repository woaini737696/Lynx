import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Target,
  LayoutDashboard,
  Sparkles,
  Bot,
  ChevronLeft,
  ChevronRight,
  Settings,
  Cpu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { UserMenu } from "./UserMenu";

const navItems = [
  { to: "/focus", label: "今日聚焦", icon: Target },
  { to: "/board", label: "决策看板", icon: LayoutDashboard },
  { to: "/ai/workspace", label: "AI 工作空间", icon: Sparkles },
  { to: "/ai/assistant", label: "AI 专属助理", icon: Bot },
  { to: "/agent", label: "HermesAgent", icon: Cpu },
];

export function Sidebar() {
  const expanded = useUIStore((s) => s.sidebarExpanded);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const location = useLocation();
  const [hovered, setHovered] = useState(false);
  const showLabel = expanded || hovered;

  // 自动展开：鼠标移入
  const handleMouseEnter = () => {
    if (!expanded) setHovered(true);
  };
  const handleMouseLeave = () => {
    if (!expanded) setHovered(false);
  };

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "glass-sidebar flex h-full flex-col justify-between transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        showLabel ? "w-56" : "w-[72px]"
      )}
    >
      <div className="flex flex-col gap-2 p-3">
        <div className="mb-2 flex items-center justify-end px-1">
          <button
            onClick={toggleSidebar}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            title={expanded ? "收起侧边栏" : "展开侧边栏"}
          >
            {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              {...item}
              active={location.pathname.startsWith(item.to)}
              showLabel={showLabel}
            />
          ))}
        </nav>
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
          <AnimatePresence>
            {showLabel && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.18 }}
                className="truncate"
              >
                设置
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>

        <div className="mt-1">
          <UserMenu collapsed={!showLabel} />
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
  showLabel,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  showLabel: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
          "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
          isActive && "glass-active text-foreground"
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <AnimatePresence>
        {showLabel && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.18 }}
            className="truncate"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {active && !showLabel && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
    </NavLink>
  );
}

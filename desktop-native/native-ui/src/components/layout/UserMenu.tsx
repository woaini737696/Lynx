import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { User, LogOut, Settings, CreditCard, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Logo } from "@/components/ui/Logo";

const menuItems = [
  { to: "/settings/account", label: "账号设置", icon: Settings },
  { to: "/settings/billing", label: "订阅与账单", icon: CreditCard },
  { to: "/help", label: "帮助中心", icon: HelpCircle },
];

const CLOSE_DELAY = 180;

interface UserMenuProps {
  collapsed?: boolean;
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => {
      setOpen(false);
    }, CLOSE_DELAY);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const displayName = user?.displayName || user?.name || user?.email || "未登录";
  const avatarUrl = user?.avatarUrl;

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => setOpen((v) => !v)}
    >
      <button
        className={cn(
          "glass-user flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-primary/8",
          collapsed && "justify-center px-2"
        )}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{user ? "Pro 会员" : "本地模式"}</p>
          </div>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="ios-glass absolute bottom-full left-0 z-50 mb-2 w-full min-w-[208px] overflow-hidden p-1.5"
                    style={{ transformOrigin: "bottom left" }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Logo className="h-9 w-9 rounded-xl" variant="dark" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">Lynx 原生桌面端</p>
              </div>
            </div>

            <div className="my-1.5 h-px bg-border/60" />

            <div className="flex flex-col gap-0.5">
              {menuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
                  )}
                  onClick={() => setOpen(false)}
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

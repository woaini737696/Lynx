import { useState, useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings, ChevronDown, Wallet, Crown, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { clearAuth } from "@/lib/auth-persistence";
import { openLoginModal } from "@/lib/login-modal";

const menuItems = [
  { to: "/wallet", label: "钱包", icon: Wallet },
  { to: "/membership", label: "会员", icon: Crown },
  { to: "/settings", label: "设置", icon: Settings },
];

const CLOSE_DELAY = 180;

interface UserMenuProps {
  collapsed?: boolean;
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const signOut = useAuthStore((s) => s.signOut);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSignOut = async () => {
    try {
      await clearAuth();
    } catch (err) {
      console.error("退出登录失败", err);
    } finally {
      signOut();
      // 清除所有缓存数据，防止下一个用户看到上一个用户的数据
      queryClient.clear();
      setOpen(false);
    }
  };

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

  const isLoggedIn = !!token && !!user;
  const displayName = user?.displayName || user?.name || user?.email || "点击登录";
  const avatarUrl = user?.avatarUrl;
  const initial = isLoggedIn ? displayName.charAt(0).toUpperCase() : "?";

  const handleCardClick = () => {
    if (!isLoggedIn) {
      openLoginModal();
    } else {
      setOpen((v) => !v);
    }
  };

  const handleMenuNavClick = (e: React.MouseEvent) => {
    if (!isLoggedIn) {
      e.preventDefault();
      setOpen(false);
      openLoginModal();
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      <button
        className={cn(
          "user-card group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all",
          collapsed && "justify-center px-2"
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-border/60 transition-all group-hover:ring-primary/40"
          />
        ) : (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-lg",
              isLoggedIn
                ? "bg-gradient-to-br from-primary to-accent text-white shadow-primary/20"
                : "bg-muted text-muted-foreground"
            )}
          >
            {initial}
          </span>
        )}
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-sm font-semibold",
                  isLoggedIn ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {displayName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {isLoggedIn ? "Lynx 桌面端" : "未登录"}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                !isLoggedIn && "opacity-0"
              )}
              style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && isLoggedIn && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="user-menu absolute bottom-full left-0 z-50 mb-2 w-full min-w-[208px] overflow-hidden rounded-2xl p-1.5"
            style={{ transformOrigin: "bottom left" }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white">
                  {initial}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">Lynx 桌面端</p>
              </div>
            </div>

            <div className="my-1.5 h-px bg-border/60" />

            <div className="flex flex-col gap-0.5">
              {menuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
                  onClick={(e) => {
                    handleMenuNavClick(e);
                    setOpen(false);
                  }}
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          </motion.div>
        )}
        {!isLoggedIn && open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="user-menu absolute bottom-full left-0 z-50 mb-2 w-full min-w-[208px] overflow-hidden rounded-2xl p-1.5"
            style={{ transformOrigin: "bottom left" }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2.5 text-center">
              <p className="text-sm font-semibold text-foreground">登录 Lynx</p>
              <p className="mt-0.5 text-xs text-muted-foreground">登录后同步所有数据</p>
            </div>
            <div className="my-1 h-px bg-border/60" />
            <button
              onClick={() => {
                setOpen(false);
                openLoginModal();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
            >
              <LogIn className="h-4 w-4" />
              立即登录 / 注册
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

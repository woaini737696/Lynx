import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, Settings, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { clearAuth } from "@/lib/auth-persistence";
import { invoke } from "@/lib/tauri";

const menuItems = [
  { to: "/settings", label: "设置", icon: Settings },
];

const CLOSE_DELAY = 180;

interface UserMenuProps {
  collapsed?: boolean;
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSignOut = async () => {
    try {
      await clearAuth();
      await invoke("set_user_token", { token: "" }).catch(() => {});
    } catch (err) {
      console.error("退出登录失败", err);
    } finally {
      signOut();
      setOpen(false);
      navigate("/login", { replace: true });
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

  const displayName = user?.displayName || user?.name || user?.email || "未登录";
  const avatarUrl = user?.avatarUrl;
  // 首字母 fallback（对齐 Web端）
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => setOpen((v) => !v)}
    >
      <button
        className={cn(
          "user-card group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all",
          collapsed && "justify-center px-2"
        )}
      >
        {/* 头像 - 对齐 Web端：36x36 圆形，有图片用图片，否则渐变背景+首字母 */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-9 w-9 rounded-full object-cover ring-2 ring-border/60 transition-all group-hover:ring-primary/40"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white shadow-lg shadow-primary/20">
            {initial}
          </span>
        )}
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">Lynx 桌面端</p>
            </div>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300"
              style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
            />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
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
                  onClick={() => setOpen(false)}
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
      </AnimatePresence>
    </div>
  );
}

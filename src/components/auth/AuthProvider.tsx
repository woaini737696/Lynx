"use client";

// 全局认证上下文：管理登录弹窗显隐
// 任何组件可通过 useAuth() 调用 open() 弹出登录弹窗
// 弹窗本身使用液态玻璃样式，符合 iOS 26 Liquid Glass 规范

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LoginModal, LoginMode } from "./LoginModal";

interface AuthContextValue {
  isOpen: boolean;
  mode: LoginMode;
  expired: boolean;
  open: (mode?: LoginMode) => void;
  close: () => void;
  setMode: (mode: LoginMode) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<LoginMode>("phone-password");
  const [expired, setExpired] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // 监听 URL 参数：?login=1 打开弹窗，?expired=1 显示过期提示
  useEffect(() => {
    const loginFlag = searchParams.get("login");
    const expiredFlag = searchParams.get("expired");
    if (loginFlag === "1" || expiredFlag === "1") {
      setExpired(expiredFlag === "1");
      // 默认手机号+密码模式
      setMode("phone-password");
      setIsOpen(true);
      // 清理 URL 参数，避免刷新重复弹出
      const next = new URL(window.location.href);
      next.searchParams.delete("login");
      next.searchParams.delete("expired");
      next.searchParams.delete("callbackUrl");
      window.history.replaceState({}, "", next.toString());
    }
  }, [searchParams]);

  const open = useCallback((m: LoginMode = "phone-password") => {
    setExpired(false);
    setMode(m);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // 监听 401 响应事件：API 返回未登录时弹出登录窗
  // 重要：区分"页面初始加载的 401"和"用户主动操作触发的 401"
  // - 页面加载后 3 秒内的 401 视为初始加载（SWR 自动 fetch），不弹窗
  // - 3 秒后的 401 视为用户主动操作触发，弹窗
  // - 检查 session cookie 区分"首次访问"和"会话过期"
  const loadedAtRef = useRef<number>(Date.now());
  useEffect(() => {
    loadedAtRef.current = Date.now();
    const handler = () => {
      // 页面加载后 3 秒内的 401 视为初始加载，不弹窗
      if (Date.now() - loadedAtRef.current < 3000) return;

      // 检查是否有 session cookie（曾经登录过）
      const hasSessionCookie =
        document.cookie.includes("authjs.session-token") ||
        document.cookie.includes("__Secure-authjs.session-token");

      setExpired(hasSessionCookie);
      setMode("phone-password");
      setIsOpen(true);
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

  // 登录成功后：关闭弹窗 + 通知全局组件刷新登录状态 + router.refresh
  const handleSuccess = useCallback(() => {
    setIsOpen(false);
    setExpired(false);
    // 派发登录成功事件，Sidebar 等组件监听后立即重新 fetch session
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth:login-success"));
    }
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ isOpen, mode, expired, open, close, setMode }),
    [isOpen, mode, expired, open, close, setMode]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {isOpen && (
        <LoginModal
          mode={mode}
          expired={expired}
          onModeChange={setMode}
          onClose={close}
          onSuccess={handleSuccess}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth 必须在 AuthProvider 内部使用");
  }
  return ctx;
}

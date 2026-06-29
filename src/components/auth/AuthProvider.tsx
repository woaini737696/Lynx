"use client";

// 全局认证上下文：管理登录弹窗显隐
// 任何组件可通过 useAuth() 调用 open() 弹出登录弹窗
// 弹窗本身使用液态玻璃样式，符合 iOS 26 Liquid Glass 规范

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
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

  // 监听 401 响应事件：API 返回未登录时自动弹出登录窗
  useEffect(() => {
    const handler = () => {
      setExpired(true);
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

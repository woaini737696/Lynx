"use client";

// 全局认证上下文：管理登录弹窗显隐
// 任何组件可通过 useAuth() 调用 open() 弹出登录弹窗
// 弹窗本身使用液态玻璃样式，符合 iOS 26 Liquid Glass 规范

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LoginModal, LoginMode } from "./LoginModal";
import { SetPasswordModal } from "./SetPasswordModal";

interface AuthContextValue {
  isOpen: boolean;
  mode: LoginMode;
  expired: boolean;
  // 用户是否已设置密码（登录后从 session 同步，供设置页判断是否显示提醒）
  passwordSetByUser: boolean | null;
  open: (mode?: LoginMode) => void;
  close: () => void;
  setMode: (mode: LoginMode) => void;
  // 手动打开"设置密码"弹窗（设置页可调用）
  openSetPassword: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<LoginMode>("phone-password");
  const [expired, setExpired] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  // 用户是否已设置密码：null 表示尚未从 session 读取
  const [passwordSetByUser, setPasswordSetByUser] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // sessionStorage key：用户点击"稍后设置"后写入，下次登录不再自动弹窗
  const PASSWORD_SKIPPED_KEY = "lynx-password-skipped";

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

  // 登录成功后：关闭弹窗 + 通知全局组件刷新登录状态 + 检查是否需要设置密码
  const handleSuccess = useCallback(() => {
    setIsOpen(false);
    setExpired(false);
    // 派发登录成功事件，Sidebar 等组件监听后立即重新 fetch session
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth:login-success"));
    }
    router.refresh();
    // 登录成功后检查是否需要设置密码（延迟 500ms 等 session cookie 写入）
    setTimeout(() => {
      fetch("/api/auth/session")
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
          const pwdSet = (s?.user as { passwordSetByUser?: boolean } | undefined)?.passwordSetByUser;
          setPasswordSetByUser(pwdSet ?? null);
          // 仅当用户未设置密码时考虑弹窗
          if (pwdSet === false) {
            // 检查 sessionStorage 是否已存在跳过标记：存在则不再自动弹窗
            const skipped =
              typeof window !== "undefined" &&
              sessionStorage.getItem(PASSWORD_SKIPPED_KEY) === "1";
            if (!skipped) {
              setShowSetPassword(true);
            }
          } else if (pwdSet === true) {
            // 用户已设置密码，清理可能残留的跳过标记
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(PASSWORD_SKIPPED_KEY);
            }
          }
        })
        .catch(() => {});
    }, 500);
  }, [router, PASSWORD_SKIPPED_KEY]);

  // 手动打开"设置密码"弹窗（设置页可调用，不受跳过标记影响）
  const openSetPassword = useCallback(() => {
    setShowSetPassword(true);
  }, []);

  // 用户点击"稍后设置"：关闭弹窗并写入 sessionStorage 跳过标记
  const handleSkipPassword = useCallback(() => {
    setShowSetPassword(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PASSWORD_SKIPPED_KEY, "1");
    }
  }, [PASSWORD_SKIPPED_KEY]);

  // 设置密码成功：关闭弹窗并清理跳过标记
  const handleSetPasswordSuccess = useCallback(() => {
    setShowSetPassword(false);
    setPasswordSetByUser(true);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(PASSWORD_SKIPPED_KEY);
    }
  }, [PASSWORD_SKIPPED_KEY]);

  const value = useMemo(
    () => ({
      isOpen,
      mode,
      expired,
      passwordSetByUser,
      open,
      close,
      setMode,
      openSetPassword,
    }),
    [isOpen, mode, expired, passwordSetByUser, open, close, setMode, openSetPassword]
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
      {showSetPassword && (
        <SetPasswordModal
          onClose={() => setShowSetPassword(false)}
          onSuccess={handleSetPasswordSuccess}
          onSkip={handleSkipPassword}
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

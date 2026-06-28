"use client";

// 登录弹窗：液态玻璃样式，符合 iOS 26 Liquid Glass 规范
// 三种登录模式：用户名密码 / 手机号验证码 / 手机号密码
// 附加：微信登录占位（WECHAT_LOGIN_ENABLED 控制显隐）
// 万能验证码：开发环境直接使用 888888，无需真实短信

import { useEffect, useRef, useState, forwardRef } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import {
  Loader2,
  Lock,
  User,
  Phone,
  ShieldCheck,
  AlertCircle,
  X,
  MessageCircle,
  Sparkles,
} from "lucide-react";

export type LoginMode = "username" | "phone-code" | "phone-password";

interface LoginModalProps {
  mode: LoginMode;
  expired: boolean;
  onModeChange: (m: LoginMode) => void;
  onClose: () => void;
  onSuccess: () => void;
}

const TABS: { key: LoginMode; label: string; icon: typeof User }[] = [
  { key: "phone-code", label: "验证码", icon: ShieldCheck },
  { key: "phone-password", label: "手机密码", icon: Phone },
  { key: "username", label: "账号", icon: User },
];

export function LoginModal({
  mode,
  expired,
  onModeChange,
  onClose,
  onSuccess,
}: LoginModalProps) {
  // 表单字段
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // 切换标签页时清空错误，并自动聚焦
  useEffect(() => {
    setError("");
    // 延迟聚焦，等待对应输入框渲染
    const t = setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [mode]);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // 验证手机号格式（中国大陆 11 位）
  const isValidPhone = (p: string) => /^1[3-9]\d{9}$/.test(p);

  // 发送验证码
  const handleSendCode = async () => {
    if (!isValidPhone(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    setSendingCode(true);
    setError("");
    try {
      const res = await fetch("/api/auth/sms-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "验证码发送失败");
        return;
      }
      setCodeSent(true);
      setCountdown(60);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSendingCode(false);
    }
  };

  // 统一登录入口
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 前端基础校验
    if (mode === "username") {
      if (!username.trim() || !password) {
        setError("请输入用户名和密码");
        return;
      }
    } else if (mode === "phone-code") {
      if (!isValidPhone(phone)) {
        setError("请输入正确的手机号");
        return;
      }
      if (!code) {
        setError("请输入验证码");
        return;
      }
    } else if (mode === "phone-password") {
      if (!isValidPhone(phone)) {
        setError("请输入正确的手机号");
        return;
      }
      if (!password) {
        setError("请输入密码");
        return;
      }
    }

    setLoading(true);
    try {
      // 使用 next-auth/react 的 signIn，自动处理 CSRF
      // redirect: false 避免页面跳转，返回 error 时手动处理
      const credentials: Record<string, string> = {};
      if (mode === "username") {
        credentials.username = username.trim();
        credentials.password = password;
      } else if (mode === "phone-code") {
        credentials.phone = phone;
        credentials.code = code;
      } else if (mode === "phone-password") {
        credentials.phone = phone;
        credentials.password = password;
      }

      const res = await signIn("credentials", {
        ...credentials,
        redirect: false,
      });
      if (res?.error) {
        setError("登录失败，请检查账号或验证码");
        return;
      }
      if (res?.ok) {
        onSuccess();
        return;
      }
      setError("登录失败，请重试");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="glass-modal w-[90vw] max-w-[420px] rounded-3xl p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Logo 和标题 */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <Image
            src="/lynx-icon-128.png"
            alt="Lynx"
            width={48}
            height={48}
            className="h-12 w-12 rounded-2xl shadow-lg"
          />
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              欢迎来到 LYNX
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              不用学，直接干
            </p>
          </div>
        </div>

        {/* 过期提示 */}
        {expired && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>登录已过期，请重新登录</span>
          </div>
        )}

        {/* 标签页切换 */}
        <div className="mb-5 flex gap-1 rounded-2xl bg-foreground/[0.04] p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onModeChange(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-all ${
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 表单 */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* 用户名模式 */}
          {mode === "username" && (
            <div className="space-y-3">
              <Field
                ref={firstInputRef}
                id="username"
                label="用户名"
                icon={User}
                type="text"
                value={username}
                onChange={setUsername}
                placeholder="请输入用户名"
                autoComplete="username"
                disabled={loading}
              />
              <Field
                id="password-username"
                label="密码"
                icon={Lock}
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
          )}

          {/* 手机验证码模式 */}
          {mode === "phone-code" && (
            <div className="space-y-3">
              <Field
                ref={firstInputRef}
                id="phone-code"
                label="手机号"
                icon={Phone}
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="请输入手机号"
                autoComplete="tel"
                disabled={loading}
                maxLength={11}
              />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">验证码</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      disabled={loading}
                      placeholder="6 位验证码"
                      autoComplete="one-time-code"
                      className="ios-glass-sm w-full rounded-xl py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0 || loading || !isValidPhone(phone)}
                    className="ios-glass-sm shrink-0 rounded-xl px-3.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                  >
                    {sendingCode ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : countdown > 0 ? (
                      `${countdown}s`
                    ) : codeSent ? (
                      "重新获取"
                    ) : (
                      "获取验证码"
                    )}
                  </button>
                </div>
              </div>
              {/* 开发环境万能码提示 */}
              {codeSent && (
                <div className="flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 text-[11px] text-primary/80">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span>开发环境万能码：888888</span>
                </div>
              )}
            </div>
          )}

          {/* 手机密码模式 */}
          {mode === "phone-password" && (
            <div className="space-y-3">
              <Field
                ref={firstInputRef}
                id="phone-pwd"
                label="手机号"
                icon={Phone}
                type="tel"
                value={phone}
                onChange={setPhone}
                placeholder="请输入手机号"
                autoComplete="tel"
                disabled={loading}
                maxLength={11}
              />
              <Field
                id="password-phone"
                label="密码"
                icon={Lock}
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-graveyard/30 bg-graveyard/5 px-3 py-2 text-xs text-graveyard">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              "登录"
            )}
          </button>
        </form>

        {/* 分割线 + 第三方登录 */}
        <div className="mt-5">
          <div className="relative mb-4 text-center">
            <span className="relative z-10 bg-transparent px-3 text-[11px] text-muted-foreground/70">
              其他登录方式
            </span>
            <div className="absolute left-0 top-1/2 h-px w-full bg-foreground/10" />
          </div>
          <div className="flex justify-center">
            <WeChatLoginButton disabled={loading} />
          </div>
        </div>

        {/* 注册提示（验证码模式自动注册） */}
        {mode === "phone-code" && (
          <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
            未注册手机号将自动创建账号
          </p>
        )}
      </div>
    </div>
  );
}

// 通用输入框组件
interface FieldProps {
  id: string;
  label: string;
  icon: typeof User;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  disabled?: boolean;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "tel";
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { id, label, icon: Icon, type, value, onChange, placeholder, autoComplete, disabled, maxLength, inputMode },
  ref
) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={ref}
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          className="ios-glass-sm w-full rounded-xl py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
      </div>
    </div>
  );
});

// 微信登录按钮（占位，后续配置 API Key 后启用）
function WeChatLoginButton({ disabled }: { disabled?: boolean }) {
  const handleClick = () => {
    alert("微信登录暂未启用，请使用其他方式登录");
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#07C160]/10 text-[#07C160] transition-all hover:bg-[#07C160]/20 disabled:opacity-50"
      aria-label="微信登录"
      title="微信登录（即将开放）"
    >
      <MessageCircle className="h-5 w-5" />
    </button>
  );
}

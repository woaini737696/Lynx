"use client";

// 登录弹窗：液态玻璃样式，符合 iOS 26 Liquid Glass 规范
// 两种登录模式：手机号+密码（默认） / 手机号+验证码
// 注册面板：手机号 + 验证码 + 邀请码（极简，密码自动生成，昵称默认手机号）
// 万能验证码：从数据库读取，管理员可在设置页配置和开关

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
  Sparkles,
  UserPlus,
  KeyRound,
} from "lucide-react";

export type LoginMode = "phone-password" | "phone-code";

interface LoginModalProps {
  mode: LoginMode;
  expired: boolean;
  onModeChange: (m: LoginMode) => void;
  onClose: () => void;
  onSuccess: () => void;
}

const TABS: { key: LoginMode; label: string; icon: typeof User }[] = [
  { key: "phone-password", label: "手机密码", icon: Phone },
  { key: "phone-code", label: "验证码", icon: ShieldCheck },
];

type Panel = "login" | "register";

export function LoginModal({
  mode,
  expired,
  onModeChange,
  onClose,
  onSuccess,
}: LoginModalProps) {
  // 当前面板：登录 / 注册
  const [panel, setPanel] = useState<Panel>("login");

  // 表单字段
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(""); // 仅登录 phone-password 模式使用
  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  // 万能码状态（从 API 动态读取）
  const [masterCodeEnabled, setMasterCodeEnabled] = useState<boolean | null>(null);
  const [masterCodeHint, setMasterCodeHint] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement | null>(null);
  // 跟踪 mousedown 目标，防止鼠标在弹窗内按下拖到遮罩层松开时误关闭
  const mouseDownTargetRef = useRef<EventTarget | null>(null);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    mouseDownTargetRef.current = e.target;
  };

  const handleOverlayMouseUp = (e: React.MouseEvent) => {
    if (mouseDownTargetRef.current === e.currentTarget && e.target === e.currentTarget) {
      onClose();
    }
    mouseDownTargetRef.current = null;
  };

  // 切换标签页时清空错误并聚焦
  useEffect(() => {
    setError("");
    const t = setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [mode, panel]);

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

  // 验证手机号格式
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
      // 同步万能码启用状态与提示
      setMasterCodeEnabled(Boolean(data.masterCodeEnabled));
      setMasterCodeHint(data.devHint || null);
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

    if (!isValidPhone(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    if (mode === "phone-code") {
      if (!code) {
        setError("请输入验证码");
        return;
      }
    } else {
      if (!password) {
        setError("请输入密码");
        return;
      }
    }

    setLoading(true);
    try {
      const credentials: Record<string, string> = { phone };
      if (mode === "phone-code") {
        credentials.code = code;
      } else {
        credentials.password = password;
      }

      const res = await signIn("credentials", {
        ...credentials,
        redirect: false,
      });
      if (res?.error) {
        setError(mode === "phone-code" ? "登录失败，请检查验证码或手机号是否已注册" : "登录失败，请检查手机号或密码");
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

  // 注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isValidPhone(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    if (!code) {
      setError("请输入验证码");
      return;
    }
    if (!inviteCode.trim()) {
      setError("请输入邀请码");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          inviteCode: inviteCode.trim().toUpperCase(),
          // password 与 displayName 不传：后端自动生成随机密码、昵称默认手机号
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }
      // 注册成功：用验证码方式直接登录（万能验证码可复用）
      const signInRes = await signIn("credentials", {
        phone,
        code,
        redirect: false,
      });
      if (signInRes?.ok) {
        onSuccess();
        return;
      }
      // 若 signIn 失败，切到验证码登录面板提示用户手动登录
      setPanel("login");
      setMode("phone-code");
      setError("注册成功，请使用验证码登录");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  // 切换登录/注册面板
  const switchPanel = (p: Panel) => {
    setError("");
    setPanel(p);
  };

  // 切换登录模式的辅助（兼容 props 形式）
  const setMode = (m: LoginMode) => onModeChange(m);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-xl"
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <div
        className="glass-modal relative max-h-[90vh] w-[90vw] max-w-[420px] overflow-y-auto rounded-3xl p-5 sm:p-6"
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
        <div className="mb-4 flex flex-col items-center gap-1.5">
          <Image
            src="/lynx-icon-128.png"
            alt="Lynx"
            width={40}
            height={40}
            className="h-10 w-10 rounded-2xl shadow-lg"
          />
          <div className="text-center">
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              {panel === "login" ? "欢迎来到 LYNX" : "注册新账号"}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {panel === "login" ? "用Lynx AI，人人都是超级个体" : "手机号 + 验证码 + 邀请码"}
            </p>
          </div>
        </div>

        {/* 过期提示 */}
        {expired && panel === "login" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>登录已过期，请重新登录</span>
          </div>
        )}

        {panel === "login" ? (
          <>
            {/* 登录标签页切换 */}
            <div className="mb-5 flex gap-1 rounded-2xl bg-foreground/[0.04] p-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = mode === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setMode(tab.key)}
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

            {/* 登录表单 */}
            <form onSubmit={handleLogin} className="space-y-4">
              <Field
                ref={firstInputRef}
                id="phone-login"
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

              {mode === "phone-code" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">验证码</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="code-login"
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
              )}

              {mode === "phone-password" && (
                <Field
                  id="password-login"
                  label="密码"
                  icon={Lock}
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  disabled={loading}
                />
              )}

              {/* 万能码提示（从 API 动态读取，仅在启用且已发送验证码后显示） */}
              {mode === "phone-code" && codeSent && masterCodeEnabled && masterCodeHint && (
                <div className="flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 text-[11px] text-primary/80">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span>{masterCodeHint}</span>
                </div>
              )}
              {mode === "phone-code" && codeSent && masterCodeEnabled === false && (
                <div className="flex items-center gap-1.5 rounded-lg bg-muted-foreground/5 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>万能验证码未启用，请联系管理员开启</span>
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

            {/* 注册入口 */}
            <div className="mt-5 border-t border-foreground/10 pt-4 text-center">
              <p className="text-xs text-muted-foreground">
                还没有账号？{" "}
                <button
                  type="button"
                  onClick={() => switchPanel("register")}
                  className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
                >
                  立即注册
                </button>
              </p>
            </div>
          </>
        ) : (
          <>
            {/* 注册表单 */}
            <form onSubmit={handleRegister} className="space-y-4">
              <Field
                ref={firstInputRef}
                id="phone-register"
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

              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">验证码</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="code-register"
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

              {/* 万能码提示 */}
              {codeSent && masterCodeEnabled && masterCodeHint && (
                <div className="flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 text-[11px] text-primary/80">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span>{masterCodeHint}</span>
                </div>
              )}
              {codeSent && masterCodeEnabled === false && (
                <div className="flex items-center gap-1.5 rounded-lg bg-muted-foreground/5 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>万能验证码未启用，请联系管理员开启</span>
                </div>
              )}

              <Field
                id="invite-code"
                label="邀请码"
                icon={KeyRound}
                type="text"
                value={inviteCode}
                onChange={(v) => setInviteCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32))}
                placeholder="请输入邀请码（管理员发放）"
                disabled={loading}
                maxLength={32}
              />

              {/* 错误提示 */}
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-graveyard/30 bg-graveyard/5 px-3 py-2 text-xs text-graveyard">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* 注册按钮 */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    注册中...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    注册并登录
                  </>
                )}
              </button>
            </form>

            {/* 返回登录 */}
            <div className="mt-5 border-t border-foreground/10 pt-4 text-center">
              <p className="text-xs text-muted-foreground">
                已有账号？{" "}
                <button
                  type="button"
                  onClick={() => switchPanel("login")}
                  className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
                >
                  返回登录
                </button>
              </p>
            </div>
          </>
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
    <div className="space-y-1">
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

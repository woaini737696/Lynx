// 登录页（对齐 Web 端 LoginModal 弹窗样式）
// 三种登录模式：手机号+验证码 / 手机号+密码 / 账号+密码
// 万能验证码：仅 DEV 构建可见（888888），生产构建自动隐藏
import { useEffect, useRef, useState, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
  Phone,
  ShieldCheck,
  AlertCircle,
  Minus,
  Square,
  X,
  Maximize2,
  Sparkles,
} from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAuthStore } from "@/stores/authStore";
import { saveAuth } from "@/lib/auth-persistence";
import { invoke } from "@/lib/tauri";
import { cloudApi } from "@/lib/cloud-api";
import { cn } from "@/lib/utils";

type LoginMode = "phone-code" | "phone-password" | "username";

const TABS: { key: LoginMode; label: string; icon: typeof User }[] = [
  { key: "phone-code", label: "验证码", icon: ShieldCheck },
  { key: "phone-password", label: "手机密码", icon: Phone },
  { key: "username", label: "账号", icon: User },
];

interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
    displayName?: string;
  };
}

// 开发环境万能码（仅 DEV 构建可见，生产构建自动隐藏）
const DEV_MASTER_CODE = import.meta.env.DEV ? "888888" : null;

export function LoginPage() {
  const navigate = useNavigate();
  const setCredentials = useAuthStore((s) => s.setCredentials);

  // 表单字段
  const [mode, setMode] = useState<LoginMode>("phone-code");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const appWindow = getCurrentWebviewWindow();

  // 窗口状态监听
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [appWindow]);

  // 切换模式时清空错误并聚焦
  useEffect(() => {
    setError("");
    const t = setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [mode]);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };
  const handleClose = () => appWindow.close();

  const handleOpenWebSite = async () => {
    try {
      await invoke("open_external", { url: "https://app.lynnhub.com" });
    } catch (err) {
      console.error("打开官网失败", err);
    }
  };

  // 校验手机号格式（与 Web 端一致：中国大陆 11 位）
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
      await cloudApi.post("/api/auth/sms-code", { phone });
      setCodeSent(true);
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
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
      // 构建请求体（对齐 Web 端 /api/auth/token 三种模式）
      const payload: Record<string, string> = {};
      if (mode === "username") {
        payload.username = username.trim();
        payload.password = password;
      } else if (mode === "phone-code") {
        payload.phone = phone;
        payload.code = code;
      } else if (mode === "phone-password") {
        payload.phone = phone;
        payload.password = password;
      }

      const result = await cloudApi.post<LoginResponse>("/api/auth/token", payload);

      const credentials = {
        token: result.token,
        user: {
          id: result.user.id,
          username: result.user.username,
          displayName: result.user.displayName || result.user.username,
          name: result.user.displayName || result.user.username,
        },
      };
      await saveAuth(credentials);
      await invoke("set_user_token", { token: result.token });
      setCredentials(credentials);
      navigate("/focus", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-6">
      {/* 液态玻璃背景层 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-blue-50/40" />
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

      {/* 顶部窗口控制栏 */}
      <header
        data-tauri-drag-region
        className="fixed left-0 right-0 top-0 z-50 flex h-11 items-center justify-end px-2 select-none"
      >
        <button
          title="最小化"
          onClick={handleMinimize}
          className="flex h-8 w-11 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-primary/10 hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          title={isMaximized ? "还原" : "最大化"}
          onClick={handleMaximize}
          className="flex h-8 w-11 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-primary/10 hover:text-foreground"
        >
          {isMaximized ? <Square className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <button
          title="关闭"
          onClick={handleClose}
          className="flex h-8 w-11 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* 顶部品牌区 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 mb-8 flex flex-col items-center text-center"
      >
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#030816] shadow-xl ring-1 ring-white/10">
          <img
            src="/lynx-icon-256.png"
            alt="Lynx"
            className="h-16 w-16 object-contain"
            draggable={false}
          />
        </div>
        <h1 className="text-3xl font-semibold tracking-wide text-foreground">Lynx</h1>
        <p className="mt-2 text-lg text-muted-foreground">超级AI工作台，不用学，直接干</p>
      </motion.div>

      {/* 登录弹窗（glass-modal 样式，对齐 Web 端 LoginModal） */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="ios-glass relative z-10 w-full max-w-[420px] rounded-3xl p-8 shadow-2xl"
        style={{ boxShadow: "0 8px 32px rgba(31, 38, 135, 0.15), inset 0 1px 0 rgba(255,255,255,0.6)" }}
      >
        {/* 标签页切换 */}
        <div className="mb-5 flex gap-1 rounded-2xl bg-foreground/[0.04] p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMode(tab.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-all",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 表单 */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* 账号模式 */}
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
              <PasswordField
                id="password-username"
                label="密码"
                value={password}
                onChange={setPassword}
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={loading}
                showPassword={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
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
                      className="h-11 w-full rounded-xl border border-border/60 bg-background/40 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0 || loading || !isValidPhone(phone)}
                    className="shrink-0 rounded-xl border border-border/60 bg-background/40 px-3.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
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
              {/* 开发环境万能码提示（仅 DEV 构建显示） */}
              {codeSent && DEV_MASTER_CODE && (
                <div className="flex items-center gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 text-[11px] text-primary/80">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span>开发环境万能码：{DEV_MASTER_CODE}</span>
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
              <PasswordField
                id="password-phone"
                label="密码"
                value={password}
                onChange={setPassword}
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={loading}
                showPassword={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
              />
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-md transition-all hover:brightness-110 active:scale-[0.98]",
              loading && "cursor-not-allowed opacity-70"
            )}
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

        {/* 注册提示 */}
        {mode === "phone-code" && (
          <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
            未注册手机号将自动创建账号
          </p>
        )}

        {/* Web 端注册链接 */}
        <div className="mt-4 border-t border-border/40 pt-4 text-center">
          <p className="text-xs text-muted-foreground">
            首次使用？请前往{" "}
            <button
              type="button"
              onClick={handleOpenWebSite}
              className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
            >
              Web 端注册
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ============ 通用输入框组件 ============

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
  {
    id,
    label,
    icon: Icon,
    type,
    value,
    onChange,
    placeholder,
    autoComplete,
    disabled,
    maxLength,
    inputMode,
  },
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
          className="h-11 w-full rounded-xl border border-border/60 bg-background/40 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
      </div>
    </div>
  );
});

// ============ 密码输入框组件 ============

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  disabled?: boolean;
  showPassword: boolean;
  onToggleShow: () => void;
}

const PasswordField = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  showPassword,
  onToggleShow,
}: PasswordFieldProps) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-xs font-medium text-foreground">
      {label}
    </label>
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id={id}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-border/60 bg-background/40 pl-10 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        tabIndex={-1}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  </div>
);

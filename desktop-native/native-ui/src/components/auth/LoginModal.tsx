import { useEffect, useRef, useState, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
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
import { useAuthStore } from "@/stores/authStore";
import { saveAuth } from "@/lib/auth-persistence";
import { cloudApi } from "@/lib/cloud-api";
import { cn } from "@/lib/utils";
import { invoke } from "@/lib/tauri";

type LoginMode = "phone-password" | "phone-code";

const TABS: { key: LoginMode; label: string; icon: typeof User }[] = [
  { key: "phone-password", label: "手机密码", icon: Phone },
  { key: "phone-code", label: "验证码", icon: ShieldCheck },
];

type Panel = "login" | "register";

interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
    displayName?: string;
    tier?: string;
  };
}

interface SmsCodeResponse {
  ok: boolean;
  masterCodeEnabled?: boolean;
  devHint?: string;
  error?: string;
}

interface RegisterResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
    displayName?: string;
    tier?: string;
  };
  message?: string;
}

interface LoginModalProps {
  open: boolean;
  mode: LoginMode;
  expired?: boolean;
  onModeChange: (m: LoginMode) => void;
  onClose: () => void;
}

export function LoginModal({ open, mode, expired, onModeChange, onClose }: LoginModalProps) {
  const setCredentials = useAuthStore((s) => s.setCredentials);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [panel, setPanel] = useState<Panel>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [masterCodeEnabled, setMasterCodeEnabled] = useState<boolean | null>(null);
  const [masterCodeHint, setMasterCodeHint] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    const t = setTimeout(() => firstInputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [mode, panel, open]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const isValidPhone = (p: string) => /^1[3-9]\d{9}$/.test(p);

  const handleSendCode = async () => {
    if (!isValidPhone(phone)) {
      setError("请输入正确的手机号");
      return;
    }
    setSendingCode(true);
    setError("");
    try {
      const data = await cloudApi.post<SmsCodeResponse>("/api/auth/sms-code", { phone });
      setCodeSent(true);
      setCountdown(60);
      setMasterCodeEnabled(Boolean(data.masterCodeEnabled));
      setMasterCodeHint(data.devHint || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
    } finally {
      setSendingCode(false);
    }
  };

  const handleSuccess = async (result: LoginResponse) => {
    const credentials = {
      token: result.token,
      user: {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName || result.user.username,
        name: result.user.displayName || result.user.username,
        tier: result.user.tier,
      },
    };
    await saveAuth(credentials);
    setCredentials(credentials);
    // 登录成功后清除旧缓存并刷新所有 queries，确保各页面重新拉取数据
    queryClient.clear();
    queryClient.invalidateQueries();
    onClose();
    // P0 修复：登录成功后显式导航到 /focus，避免停留在空白页
    try { navigate("/focus", { replace: true }); } catch {}
  };

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
      const payload: Record<string, string> = { phone };
      if (mode === "phone-code") {
        payload.code = code;
      } else {
        payload.password = password;
      }
      const result = await cloudApi.post<LoginResponse>("/api/auth/token", payload);
      await handleSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

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
      const result = await cloudApi.post<RegisterResponse>("/api/auth/register", {
        phone,
        code,
        inviteCode: inviteCode.trim().toUpperCase(),
      });
      await handleSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const switchPanel = (p: Panel) => {
    setError("");
    setPanel(p);
  };

  const handleOpenWebSite = async () => {
    try {
      await invoke("open_external", { url: "https://www.Lynxdo.com" });
    } catch (err) {
      console.error("打开官网失败", err);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex w-full max-w-[420px] flex-col overflow-hidden rounded-3xl bg-white/95 shadow-2xl ring-1 ring-black/5 backdrop-blur-2xl"
            style={{
              maxHeight: "min(640px, 85vh)",
              boxShadow: "0 12px 48px rgba(31, 38, 135, 0.25), inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label="关闭"
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="shrink-0 px-6 pb-3 pt-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#030816] shadow-lg ring-1 ring-white/10">
                <img
                  src="/lynx-icon-256.png"
                  alt="奇思"
                  className="h-10 w-10 object-contain"
                  draggable={false}
                />
              </div>
              <h1 className="text-lg font-semibold tracking-wide text-foreground">
                {panel === "login" ? "欢迎来到奇思" : "注册新账号"}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {panel === "login" ? "不用学AI，什么都能干" : "手机号 + 验证码 + 邀请码"}
              </p>
            </div>

            {expired && panel === "login" && (
              <div className="mx-6 mb-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>登录已过期，请重新登录</span>
              </div>
            )}

            <div className="shrink-0 border-b border-border/40 px-6 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">
                  {panel === "login" ? "登录" : "注册"}
                </h2>
                {panel === "register" ? (
                  <button
                    type="button"
                    onClick={() => switchPanel("login")}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    返回登录
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchPanel("register")}
                    className="text-xs font-medium text-primary transition-colors hover:underline"
                  >
                    立即注册
                  </button>
                )}
              </div>

              {panel === "login" && (
                <div className="mt-3 flex gap-1 rounded-2xl bg-foreground/[0.04] p-1">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = mode === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => onModeChange(tab.key)}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-medium transition-all",
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
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {panel === "login" ? (
                <form onSubmit={handleLogin} className="space-y-3" id="login-form">
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
                    <div className="space-y-1.5">
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
                  )}

                  {mode === "phone-password" && (
                    <PasswordField
                      id="password-login"
                      label="密码"
                      value={password}
                      onChange={setPassword}
                      placeholder="请输入密码"
                      autoComplete="current-password"
                      disabled={loading}
                      showPassword={showPassword}
                      onToggleShow={() => setShowPassword((v) => !v)}
                    />
                  )}

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
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3" id="register-form">
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

                  <div className="space-y-1.5">
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
                </form>
              )}
            </div>

            <div className="shrink-0 border-t border-border/40 px-6 pb-5 pt-3">
              {panel === "login" ? (
                <button
                  type="submit"
                  form="login-form"
                  onClick={handleLogin}
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
              ) : (
                <button
                  type="submit"
                  form="register-form"
                  onClick={handleRegister}
                  disabled={loading}
                  className={cn(
                    "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-md transition-all hover:brightness-110 active:scale-[0.98]",
                    loading && "cursor-not-allowed opacity-70"
                  )}
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
              )}

              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleOpenWebSite}
                  className="text-[11px] text-muted-foreground/70 transition-colors hover:text-primary"
                >
                  访问官网 www.Lynxdo.com
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
          className="h-11 w-full rounded-xl border border-border/60 bg-background/40 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />
      </div>
    </div>
  );
});

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

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  showPassword,
  onToggleShow,
}: PasswordFieldProps) {
  return (
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
}

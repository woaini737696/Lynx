"use client";

// 首次登录设置密码弹窗
// 触发条件：登录成功后检测 session.user.passwordSetByUser === false
// 用户设置密码后调用 /api/auth/set-password，成功后关闭弹窗

import { useState, useRef, useEffect } from "react";
import { Lock, Loader2, AlertCircle, X, CheckCircle2 } from "lucide-react";

interface SetPasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
  // 用户点击"稍后设置"时触发（与关闭 X 区分，用于记录跳过标记）
  onSkip?: () => void;
}

// 密码强度类型
type PasswordStrength = "none" | "weak" | "medium" | "strong";

// 内联密码强度判断：
// - 弱：长度<8 或 只包含字母/数字（未同时含字母和数字）
// - 中：长度>=8 且 同时包含字母+数字
// - 强：长度>=8 且 同时包含字母+数字+特殊字符
function getPasswordStrength(pwd: string): PasswordStrength {
  if (!pwd) return "none";
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pwd);
  if (pwd.length < 8) return "weak";
  if (!(hasLetter && hasDigit)) return "weak";
  if (hasSpecial) return "strong";
  return "medium";
}

// 密码强度对应的填充颜色
const STRENGTH_BAR_COLOR: Record<Exclude<PasswordStrength, "none">, string> = {
  weak: "bg-red-400",
  medium: "bg-yellow-400",
  strong: "bg-green-500",
};

// 密码强度对应的文字颜色
const STRENGTH_TEXT_COLOR: Record<Exclude<PasswordStrength, "none">, string> = {
  weak: "text-red-400",
  medium: "text-yellow-500",
  strong: "text-green-500",
};

// 密码强度对应的中文标签
const STRENGTH_LABEL: Record<Exclude<PasswordStrength, "none">, string> = {
  weak: "弱",
  medium: "中",
  strong: "强",
};

export function SetPasswordModal({ onClose, onSuccess, onSkip }: SetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // 实时计算密码强度
  const strength = getPasswordStrength(password);

  useEffect(() => {
    const t = setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // ESC 不允许关闭（必须设置密码）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (password.length > 64) {
      setError("密码最多 64 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "设置失败");
        return;
      }
      setSuccess(true);
      setTimeout(() => onSuccess(), 1000);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/30 p-4 backdrop-blur-xl">
        <div className="glass-modal relative w-[90vw] max-w-[420px] rounded-3xl p-6">
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="text-base font-semibold text-foreground">密码设置成功</h2>
            <p className="text-xs text-muted-foreground">您现在可以使用手机号+密码登录</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/30 p-4 backdrop-blur-xl">
      <div className="glass-modal relative max-h-[90vh] w-[90vw] max-w-[420px] overflow-y-auto rounded-3xl p-5 sm:p-6">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 标题 */}
        <div className="mb-4">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            设置登录密码
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            您的账号尚未设置密码，请设置一个密码以便后续使用密码登录
          </p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={firstInputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="至少 6 位密码"
                autoComplete="new-password"
                className="ios-glass-sm w-full rounded-xl py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            </div>
            {/* 密码强度实时提示：3 段进度条 + 文字标签 */}
            {strength !== "none" && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex flex-1 gap-1">
                  {[0, 1, 2].map((i) => {
                    // 弱：填充第 1 段；中：填充前 2 段；强：填充全部 3 段
                    const filled =
                      strength === "weak" ? i === 0 : strength === "medium" ? i <= 1 : i <= 2;
                    return (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          filled ? STRENGTH_BAR_COLOR[strength] : "bg-foreground/10"
                        }`}
                      />
                    );
                  })}
                </div>
                <span
                  className={`text-[11px] font-medium ${STRENGTH_TEXT_COLOR[strength]}`}
                >
                  {STRENGTH_LABEL[strength]}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">确认密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                placeholder="再次输入密码"
                autoComplete="new-password"
                className="ios-glass-sm w-full rounded-xl py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-graveyard/30 bg-graveyard/5 px-3 py-2 text-xs text-graveyard">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                设置中...
              </>
            ) : (
              "设置密码"
            )}
          </button>
        </form>

        {/* 跳过提示：onSkip 用于记录跳过标记，未提供时回退到 onClose */}
        <div className="mt-4 border-t border-foreground/10 pt-3 text-center">
          <p className="text-[11px] text-muted-foreground">
            可跳过此步骤，继续使用验证码登录
          </p>
          <button
            type="button"
            onClick={() => (onSkip ?? onClose)()}
            disabled={loading}
            className="mt-1 text-xs font-medium text-primary underline-offset-2 transition-colors hover:underline disabled:opacity-50"
          >
            稍后设置
          </button>
        </div>
      </div>
    </div>
  );
}

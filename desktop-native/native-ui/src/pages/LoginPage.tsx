import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useAuthStore } from "@/stores/authStore";
import { cloudApi } from "@/lib/cloud-api";
import { saveAuth } from "@/lib/auth-persistence";
import { invoke } from "@/lib/tauri";
import { cn } from "@/lib/utils";

interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
    displayName?: string;
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const setCredentials = useAuthStore((s) => s.setCredentials);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码");
      return;
    }

    setLoading(true);
    try {
      const result = await cloudApi.post<LoginResponse>("/api/auth/token", {
        username: username.trim(),
        password,
      });

      const credentials = {
        token: result.token,
        user: {
          id: result.user.id,
          username: result.user.username,
          displayName: result.user.displayName || result.user.username,
          name: result.user.displayName || result.user.username,
        },
      };

      // Persist token locally and notify Rust side
      await saveAuth(credentials);
      await invoke("set_user_token", { token: result.token });

      setCredentials(credentials);
      navigate("/focus", { replace: true });
    } catch (err: any) {
      setError(err?.message || "登录失败，请检查用户名和密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="ios-glass w-full max-w-[420px] p-8"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-4 h-16 w-16 rounded-2xl" variant="dark" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            登录 Lynx
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            使用 LynnHub 账号登录以同步云端数据
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
              className="h-11 w-full rounded-xl border border-border/60 bg-background/60 px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="h-11 w-full rounded-xl border border-border/60 bg-background/60 px-4 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "btn-primary-glass mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold",
              loading && "opacity-70 cursor-not-allowed"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                登录
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Lynx 原生桌面端 · 基于 HermesAgent 技术
        </p>
      </motion.div>
    </div>
  );
}

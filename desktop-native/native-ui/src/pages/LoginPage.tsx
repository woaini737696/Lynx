import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, User, Minus, Square, X, Maximize2 } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAuthStore } from "@/stores/authStore";
import { saveAuth } from "@/lib/auth-persistence";
import { invoke } from "@/lib/tauri";
import { cloudApi } from "@/lib/cloud-api";
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
  const [isMaximized, setIsMaximized] = useState(false);

  const appWindow = getCurrentWebviewWindow();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [appWindow]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };
  const handleClose = () => appWindow.close();

  const handleOpenWebSite = async () => {
    try {
      await invoke("open_external", { url: "https://ai.lynxdo.com" });
    } catch (err) {
      console.error("打开官网失败", err);
    }
  };

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
      await saveAuth(credentials);
      await invoke("set_user_token", { token: result.token });
      setCredentials(credentials);
      navigate("/focus", { replace: true });
    } catch (err: any) {
      setError(err?.message || "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-6">
      {/* 白色液态玻璃背景层 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-blue-50/40" />
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

      {/* 顶部窗口控制栏 - 可拖动 + 最小化/最大化/关闭 */}
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

      {/* 顶部品牌区 - 字体放大50% */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 mb-10 flex flex-col items-center text-center"
      >
        {/* 黑色背景白色猞猁 logo */}
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#030816] shadow-xl ring-1 ring-white/10">
          <img
            src="/lynx-logo.png"
            alt="Lynx"
            className="h-20 w-20 object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </div>
        <h1 className="text-[36px] font-semibold tracking-wide text-foreground">
          Lynx
        </h1>
        <p className="mt-3 text-[21px] text-muted-foreground">
          超级AI工作台，不用学，直接干
        </p>
      </motion.div>

      {/* 登录表单 - 液态玻璃效果 */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="relative z-10 w-full max-w-[400px] space-y-4 rounded-2xl border border-white/40 bg-white/60 p-8 shadow-2xl backdrop-blur-xl"
        style={{ boxShadow: "0 8px 32px rgba(31, 38, 135, 0.15), inset 0 1px 0 rgba(255,255,255,0.6)" }}
      >
        {/* 用户名 */}
        <div className="space-y-1.5">
          <label htmlFor="login-username" className="block text-xs font-medium text-foreground">
            用户名
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
              autoComplete="username"
              className="h-12 w-full rounded-xl border border-border bg-background px-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* 密码 */}
        <div className="space-y-1.5">
          <label htmlFor="login-password" className="block text-xs font-medium text-foreground">
            密码
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-border bg-background px-10 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}

        {/* 登录按钮 */}
        <button
          type="submit"
          disabled={loading}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-md transition-all hover:brightness-110 active:scale-[0.98]",
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

        {/* 可点击跳转官网 */}
        <p className="pt-2 text-center text-xs text-muted-foreground">
          首次使用？请前往{" "}
          <button
            type="button"
            onClick={handleOpenWebSite}
            className="font-medium text-primary underline-offset-2 transition-colors hover:underline"
          >
            Web 端注册
          </button>
        </p>
      </motion.form>
    </div>
  );
}

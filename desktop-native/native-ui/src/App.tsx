import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { FocusPage } from "./pages/FocusPage";
import { BoardPage } from "./pages/BoardPage";
import { InboxPage } from "./pages/InboxPage";
import { CognitionPage } from "./pages/CognitionPage";
import { GraveyardPage } from "./pages/GraveyardPage";
import { AIWorkspacePage } from "./pages/AIWorkspacePage";
import { AIAssistantPage } from "./pages/AIAssistantPage";
import { AIFlowsPage } from "./pages/AIFlowsPage";
import { SkillsPage } from "./pages/SkillsPage";
import { AgentPage } from "./pages/AgentPage";
import { WalletPage } from "./pages/WalletPage";
import { MembershipPage } from "./pages/MembershipPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Toaster } from "./components/ui/Toaster";
import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme } from "./lib/theme";
import { useUIStore } from "./stores/uiStore";
import { useAuthStore } from "./stores/authStore";
import { loadAuth, clearAuth } from "./lib/auth-persistence";
import { invoke } from "./lib/tauri";
import { AUTH_EXPIRED_EVENT, type CloudResponse } from "./lib/cloud-api";
import { Loader2 } from "lucide-react";

function ThemeSync() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return null;
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, setCredentials, signOut, setLoading, setInitialized, loading, initialized } =
    useAuthStore();
  const [bootstrapping, setBootstrapping] = useState(true);

  // bootstrap：加载本地 token 并调用 /api/user/profile 验证有效性
  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const auth = await loadAuth();
        if (auth && mounted) {
          // 主动验证 token 是否仍然有效，避免带着过期 token 进入应用
          try {
            const res = await invoke<CloudResponse>("cloud_request", {
              payload: {
                method: "GET",
                path: "/api/user/profile",
                body: null,
              },
            });
            if (res.status === 401) {
              throw new Error("token 已过期");
            }
            // token 有效，设置登录态
            setCredentials(auth);
            await invoke("set_user_token", { token: auth.token }).catch(() => {});
          } catch (err) {
            // token 无效或网络错误，清除本地登录态，按未登录处理
            console.warn("本地 token 验证失败，清除登录态:", err);
            await clearAuth();
            await invoke("set_user_token", { token: "" }).catch(() => {});
            signOut();
          }
        }
      } catch (err) {
        console.error("加载本地登录态失败", err);
        await clearAuth();
        signOut();
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
          setBootstrapping(false);
        }
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [setCredentials, setLoading, setInitialized, signOut]);

  // 监听全局 401 事件：清除登录态并跳转登录页
  useEffect(() => {
    const handler = async () => {
      console.warn("收到 auth-expired 事件，清除登录态并跳转登录页");
      try {
        await clearAuth();
        await invoke("set_user_token", { token: "" }).catch(() => {});
      } catch (err) {
        console.error("清除登录态失败", err);
      }
      signOut();
      navigate("/login", { replace: true });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, [signOut, navigate]);

  useEffect(() => {
    if (!initialized || bootstrapping) return;

    const isAuthRoute = location.pathname === "/login";
    if (!token && !isAuthRoute) {
      navigate("/login", { replace: true });
    } else if (token && isAuthRoute) {
      navigate("/focus", { replace: true });
    }
  }, [token, initialized, bootstrapping, location.pathname, navigate]);

  if (bootstrapping || loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">正在启动 Lynx...</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function App() {
  const setTheme = useUIStore((s) => s.setTheme);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, [setTheme]);

  return (
    <HashRouter>
      <ThemeSync />
      <AuthInitializer>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/focus" replace />} />
            <Route path="focus" element={<FocusPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="cognition" element={<CognitionPage />} />
            <Route path="board" element={<BoardPage />} />
            <Route path="graveyard" element={<GraveyardPage />} />
            <Route path="ai/workspace" element={<AIWorkspacePage />} />
            <Route path="ai/flows" element={<AIFlowsPage />} />
            <Route path="ai/assistant" element={<AIAssistantPage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="agent" element={<AgentPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="membership" element={<MembershipPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/*" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<Navigate to="/focus" replace />} />
          </Route>
        </Routes>
      </AuthInitializer>
      <Toaster />
    </HashRouter>
  );
}

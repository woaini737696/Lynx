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
import { AIWorkspacePage } from "./pages/AIWorkspacePage";
import { AIAssistantPage } from "./pages/AIAssistantPage";
import { AgentPage } from "./pages/AgentPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme } from "./lib/theme";
import { useUIStore } from "./stores/uiStore";
import { useAuthStore } from "./stores/authStore";
import { loadAuth, clearAuth } from "./lib/auth-persistence";
import { invoke } from "./lib/tauri";
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

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const auth = await loadAuth();
        if (auth && mounted) {
          setCredentials(auth);
          await invoke("set_user_token", { token: auth.token }).catch(() => {});
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
            <Route path="board" element={<BoardPage />} />
            <Route path="ai/workspace" element={<AIWorkspacePage />} />
            <Route path="ai/assistant" element={<AIAssistantPage />} />
            <Route path="agent" element={<AgentPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/*" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<Navigate to="/focus" replace />} />
          </Route>
        </Routes>
      </AuthInitializer>
    </HashRouter>
  );
}

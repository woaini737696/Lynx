import {
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
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
import { AssetsPage } from "./pages/AssetsPage";
import { MemoryPage } from "./pages/MemoryPage";
import { SearchPage } from "./pages/SearchPage";
import { WalletPage } from "./pages/WalletPage";
import { MembershipPage } from "./pages/MembershipPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Toaster } from "./components/ui/Toaster";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { applyTheme, getStoredTheme } from "./lib/theme";
import { useUIStore } from "./stores/uiStore";
import { useAuthStore } from "./stores/authStore";
import { loadAuth, clearAuth } from "./lib/auth-persistence";
import { AUTH_EXPIRED_EVENT, cloudApi } from "./lib/cloud-api";
import { openLoginModal } from "./lib/login-modal";
import { Loader2 } from "lucide-react";

function ThemeSync() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return null;
}

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { setCredentials, signOut, setLoading, setInitialized, loading } =
    useAuthStore();
  const queryClient = useQueryClient();
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const auth = await loadAuth();
        if (auth && mounted) {
          try {
            setCredentials(auth);
            await cloudApi.get("/api/user/profile");
          } catch (err) {
            console.warn("本地 token 验证失败，清除登录态:", err);
            await clearAuth();
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

  useEffect(() => {
    const handler = async () => {
      console.warn("收到 auth-expired 事件，清除登录态并打开登录弹窗");
      try {
        await clearAuth();
      } catch (err) {
        console.error("清除登录态失败", err);
      }
      signOut();
      // 清除所有 react-query 缓存，避免过期数据残留
      queryClient.clear();
      openLoginModal({ expired: true });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, [signOut, queryClient]);

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
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/focus" replace />} />
            <Route path="focus" element={<ErrorBoundary><FocusPage /></ErrorBoundary>} />
            <Route path="inbox" element={<ErrorBoundary><InboxPage /></ErrorBoundary>} />
            <Route path="cognition" element={<ErrorBoundary><CognitionPage /></ErrorBoundary>} />
            <Route path="board" element={<ErrorBoundary><BoardPage /></ErrorBoundary>} />
            <Route path="graveyard" element={<ErrorBoundary><GraveyardPage /></ErrorBoundary>} />
            <Route path="ai/workspace" element={<ErrorBoundary><AIWorkspacePage /></ErrorBoundary>} />
            <Route path="ai/flows" element={<ErrorBoundary><AIFlowsPage /></ErrorBoundary>} />
            <Route path="ai/assistant" element={<ErrorBoundary><AIAssistantPage /></ErrorBoundary>} />
            <Route path="assets" element={<ErrorBoundary><AssetsPage /></ErrorBoundary>} />
            <Route path="memory" element={<ErrorBoundary><MemoryPage /></ErrorBoundary>} />
            <Route path="search" element={<ErrorBoundary><SearchPage /></ErrorBoundary>} />
            <Route path="skills" element={<ErrorBoundary><SkillsPage /></ErrorBoundary>} />
            <Route path="agent" element={<ErrorBoundary><AgentPage /></ErrorBoundary>} />
            <Route path="wallet" element={<ErrorBoundary><WalletPage /></ErrorBoundary>} />
            <Route path="membership" element={<ErrorBoundary><MembershipPage /></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
            <Route path="settings/*" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<Navigate to="/focus" replace />} />
          </Route>
        </Routes>
      </AuthInitializer>
      <Toaster />
    </HashRouter>
  );
}

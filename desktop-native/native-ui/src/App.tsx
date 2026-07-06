import {
  HashRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/Toaster";
import { useEffect, useState, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { applyTheme, getStoredTheme } from "./lib/theme";
import { useUIStore } from "./stores/uiStore";
import { useAuthStore } from "./stores/authStore";
import { loadAuth, clearAuth } from "./lib/auth-persistence";
import { AUTH_EXPIRED_EVENT, cloudApi } from "./lib/cloud-api";
import { openLoginModal } from "./lib/login-modal";
import { Loader2 } from "lucide-react";

// 页面懒加载：首屏只加载 FocusPage，其余按需加载
const FocusPage = lazy(() => import("./pages/FocusPage").then((m) => ({ default: m.FocusPage })));
const BoardPage = lazy(() => import("./pages/BoardPage").then((m) => ({ default: m.BoardPage })));
const InboxPage = lazy(() => import("./pages/InboxPage").then((m) => ({ default: m.InboxPage })));
const CognitionPage = lazy(() => import("./pages/CognitionPage").then((m) => ({ default: m.CognitionPage })));
const GraveyardPage = lazy(() => import("./pages/GraveyardPage").then((m) => ({ default: m.GraveyardPage })));
const AIWorkspacePage = lazy(() => import("./pages/AIWorkspacePage").then((m) => ({ default: m.AIWorkspacePage })));
const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage").then((m) => ({ default: m.AIAssistantPage })));
const AIFlowsPage = lazy(() => import("./pages/AIFlowsPage").then((m) => ({ default: m.AIFlowsPage })));
const SkillsPage = lazy(() => import("./pages/SkillsPage").then((m) => ({ default: m.SkillsPage })));
const AgentPage = lazy(() => import("./pages/AgentPage").then((m) => ({ default: m.AgentPage })));
const AssetsPage = lazy(() => import("./pages/AssetsPage").then((m) => ({ default: m.AssetsPage })));
const MemoryPage = lazy(() => import("./pages/MemoryPage").then((m) => ({ default: m.MemoryPage })));
const SearchPage = lazy(() => import("./pages/SearchPage").then((m) => ({ default: m.SearchPage })));
const WalletPage = lazy(() => import("./pages/WalletPage").then((m) => ({ default: m.WalletPage })));
const MembershipPage = lazy(() => import("./pages/MembershipPage").then((m) => ({ default: m.MembershipPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ConvergePage = lazy(() => import("./pages/ConvergePage").then((m) => ({ default: m.ConvergePage })));
const LarkTasksPage = lazy(() => import("./pages/LarkTasksPage").then((m) => ({ default: m.LarkTasksPage })));
const NotificationSettingsPage = lazy(() => import("./pages/NotificationSettingsPage").then((m) => ({ default: m.NotificationSettingsPage })));

// 页面级加载占位
function PageLoader() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

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
            console.warn("本地 token 验证失败，触发登录引导:", err);
            // P0 修复：不静默 signOut，而是触发 AUTH_EXPIRED_EVENT 让用户看到"登录已过期"弹窗
            // AUTH_EXPIRED_EVENT 处理器（本组件已注册）会执行：
            //   clearAuth + signOut + queryClient.clear + openLoginModal({ expired: true })
            // 旧逻辑只 clearAuth + signOut，用户莫名其妙被登出且无任何提示
            await clearAuth();
            signOut();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
            }
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
        <p className="text-sm text-muted-foreground">正在启动奇思...</p>
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
            <Route path="focus" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><FocusPage /></Suspense></ErrorBoundary>} />
            <Route path="inbox" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><InboxPage /></Suspense></ErrorBoundary>} />
            <Route path="converge" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ConvergePage /></Suspense></ErrorBoundary>} />
            <Route path="cognition" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><CognitionPage /></Suspense></ErrorBoundary>} />
            <Route path="board" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><BoardPage /></Suspense></ErrorBoundary>} />
            <Route path="graveyard" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><GraveyardPage /></Suspense></ErrorBoundary>} />
            <Route path="ai/workspace" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AIWorkspacePage /></Suspense></ErrorBoundary>} />
            <Route path="ai/flows" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AIFlowsPage /></Suspense></ErrorBoundary>} />
            <Route path="ai/assistant" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AIAssistantPage /></Suspense></ErrorBoundary>} />
            <Route path="ai/lark-tasks" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><LarkTasksPage /></Suspense></ErrorBoundary>} />
            <Route path="assets" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AssetsPage /></Suspense></ErrorBoundary>} />
            <Route path="memory" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><MemoryPage /></Suspense></ErrorBoundary>} />
            <Route path="search" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><SearchPage /></Suspense></ErrorBoundary>} />
            <Route path="skills" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><SkillsPage /></Suspense></ErrorBoundary>} />
            <Route path="agent" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AgentPage /></Suspense></ErrorBoundary>} />
            <Route path="wallet" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><WalletPage /></Suspense></ErrorBoundary>} />
            <Route path="membership" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><MembershipPage /></Suspense></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></ErrorBoundary>} />
            <Route path="settings/notifications" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><NotificationSettingsPage /></Suspense></ErrorBoundary>} />
            <Route path="settings/*" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<Navigate to="/focus" replace />} />
          </Route>
        </Routes>
      </AuthInitializer>
      <Toaster />
    </HashRouter>
  );
}

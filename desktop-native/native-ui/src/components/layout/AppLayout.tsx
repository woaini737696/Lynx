import { Outlet } from "react-router-dom";
import { useEffect, useRef } from "react";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { QuickSearch } from "./QuickSearch";
import { LightningInput } from "@/components/lightning/LightningInput";
import { AssistantFloatingButton, IdeaReminder } from "@/components/ai/AssistantFloatingButton";
import { AssistantDrawer } from "@/components/ai/AssistantDrawer";
import { useAssistantDrawer } from "@/lib/assistant-drawer";
import { LoginModal } from "@/components/auth/LoginModal";
import { useLoginModal, openLoginModal } from "@/lib/login-modal";
import { LOGIN_REQUIRED_EVENT, getCloudEndpoint } from "@/lib/cloud-api";
import { useAuthStore } from "@/stores/authStore";
import { invoke } from "@/lib/tauri";

export function AppLayout() {
  const { open: drawerOpen, closeDrawer } = useAssistantDrawer();
  const loginModal = useLoginModal();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const wsStartedRef = useRef(false);

  // 全局禁用右键（空白区域），带 data-context-menu 的元素和输入框除外
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-context-menu]")) return;
      if (target.closest("input") || target.closest("textarea") || target.closest("select")) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  // 监听未登录 401 事件，弹出登录弹窗
  useEffect(() => {
    const handler = () => {
      openLoginModal();
    };
    window.addEventListener(LOGIN_REQUIRED_EVENT, handler);
    return () => window.removeEventListener(LOGIN_REQUIRED_EVENT, handler);
  }, []);

  // 登录后自动启动 WS 连接（PC 上线，远程操控无需手动点"启动"）
  // Rust 端有 ws_started AtomicBool 防重复，这里用 ref 再加一层防护
  useEffect(() => {
    if (!user?.id || !token || wsStartedRef.current) return;
    wsStartedRef.current = true;

    const startWs = async () => {
      try {
        // P0 修复：必须用 JWT token（authStore.token），不是 user:${userId}
        // 服务器端 ws-gateway.ts authenticate 要求 JWT 3 段格式，user:xxx 会被直接拒绝
        await invoke("set_user_token", { token: token });
        await invoke("set_cloud_endpoint", { endpoint: getCloudEndpoint() });
        await invoke("start_hermes_agent");
      } catch (e) {
        console.warn("[AppLayout] WS 自动启动失败:", e);
        wsStartedRef.current = false; // 允许重试
      }
    };
    startWs();
  }, [user?.id, token]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden">
          <QuickSearch />
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <LightningInput />
      <IdeaReminder />
      <AssistantFloatingButton />
      <AssistantDrawer open={drawerOpen} onClose={closeDrawer} />
      <LoginModal
        open={loginModal.open}
        mode={loginModal.mode}
        expired={loginModal.expired}
        onModeChange={loginModal.setMode}
        onClose={loginModal.closeModal}
      />
    </div>
  );
}

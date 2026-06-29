import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { QuickSearch } from "./QuickSearch";
import { LightningInput } from "@/components/lightning/LightningInput";
import { AssistantFloatingButton, IdeaReminder } from "@/components/ai/AssistantFloatingButton";
import { AssistantDrawer } from "@/components/ai/AssistantDrawer";
import { useAssistantDrawer } from "@/lib/assistant-drawer";
import { LoginModal } from "@/components/auth/LoginModal";
import { useLoginModal, openLoginModal } from "@/lib/login-modal";
import { LOGIN_REQUIRED_EVENT } from "@/lib/cloud-api";

export function AppLayout() {
  const { open: drawerOpen, closeDrawer } = useAssistantDrawer();
  const loginModal = useLoginModal();

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

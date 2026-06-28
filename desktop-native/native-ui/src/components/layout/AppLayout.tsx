import { Outlet, useNavigate } from "react-router-dom";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { QuickSearch } from "./QuickSearch";
import { LightningInput, OPEN_LIGHTNING_INPUT_EVENT } from "@/components/lightning/LightningInput";
import { AssistantFloatingButton, IdeaReminder } from "@/components/ai/AssistantFloatingButton";
import { Search, Zap } from "lucide-react";

export function AppLayout() {
  const navigate = useNavigate();

  // 闪电输入快捷键在 LightningInput 组件内部处理，这里通过自定义事件打开
  const handleLightning = () => {
    window.dispatchEvent(new CustomEvent(OPEN_LIGHTNING_INPUT_EVENT));
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden bg-background/50">
          {/* 顶部栏：搜索框 + 右侧按钮 */}
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/40 px-5">
            <div className="flex-1">
              <QuickSearch />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/search")}
                className="ios-glass flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                title="全局搜索"
                aria-label="全局搜索"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={handleLightning}
                className="ios-glass flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-foreground transition-colors hover:bg-primary/8"
                title="灵感速记 (Ctrl+J)"
                aria-label="灵感速记"
              >
                <Zap className="h-3.5 w-3.5 text-northstar" />
                <span>灵感速记</span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-5">
            <Outlet />
          </div>
        </main>
      </div>

      {/* 全局悬浮组件 */}
      <LightningInput />
      <IdeaReminder />
      <AssistantFloatingButton />
    </div>
  );
}

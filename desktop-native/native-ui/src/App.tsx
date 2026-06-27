import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { FocusPage } from "./pages/FocusPage";
import { BoardPage } from "./pages/BoardPage";
import { AIWorkspacePage } from "./pages/AIWorkspacePage";
import { AIAssistantPage } from "./pages/AIAssistantPage";
import { AgentPage } from "./pages/AgentPage";
import { WebFallbackPage } from "./pages/WebFallbackPage";
import { useEffect } from "react";
import { applyTheme, getStoredTheme } from "./lib/theme";
import { useUIStore } from "./stores/uiStore";

function ThemeSync() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return null;
}

export function App() {
  const setTheme = useUIStore((s) => s.setTheme);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, [setTheme]);

  return (
    <BrowserRouter>
      <ThemeSync />
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/focus" replace />} />
          <Route path="focus" element={<FocusPage />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="ai/workspace" element={<AIWorkspacePage />} />
                  <Route path="ai/assistant" element={<AIAssistantPage />} />
                  <Route path="agent" element={<AgentPage />} />
                  <Route path="web/*" element={<WebFallbackPage />} />
          <Route path="*" element={<WebFallbackPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

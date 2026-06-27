import { Outlet } from "react-router-dom";
import { TitleBar } from "./TitleBar";
import { Sidebar } from "./Sidebar";
import { QuickSearch } from "./QuickSearch";

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden bg-background/50">
          <div className="flex h-14 shrink-0 items-center gap-4 border-b border-border/40 px-5">
            <QuickSearch />
          </div>
          <div className="flex-1 overflow-auto p-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

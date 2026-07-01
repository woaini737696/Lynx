"use client";

// 灵感聚合页（信息架构精简：Inbox + 灵感收敛 + 灵感墓地 合并为单页 Tab 切换）
// 子页保留各自 PageHeader 作为子标题，聚合页只提供 Tab 导航
// 原路由 /inbox /converge /graveyard 保留兼容（侧边栏改指向 /inspiration）
import { useState, useCallback } from "react";
import { Inbox, Moon, Skull } from "lucide-react";
import { cn } from "@/lib/utils";

// 子页组件（自包含，各自管理数据与状态）
import InboxPage from "@/app/inbox/page";
import ConvergePage from "@/app/converge/page";
import GraveyardPage from "@/app/graveyard/page";

type InspirationTab = "inbox" | "converge" | "graveyard";

const TABS: { key: InspirationTab; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "converge", label: "灵感收敛", icon: Moon },
  { key: "graveyard", label: "灵感墓地", icon: Skull },
];

export default function InspirationPage() {
  const [activeTab, setActiveTab] = useState<InspirationTab>("inbox");
  // visitedTabs：仅在首次访问时 mount 对应 Tab 内容，避免首屏请求风暴
  const [visitedTabs, setVisitedTabs] = useState<Set<InspirationTab>>(
    new Set(["inbox"])
  );

  const handleTabChange = useCallback((key: InspirationTab) => {
    setActiveTab(key);
    setVisitedTabs((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  return (
    <div>
      {/* sticky Tab 横向导航 */}
      <div className="sticky top-0 z-20 -mx-1 px-1 pt-2">
        <div className="glass-card flex gap-1 overflow-x-auto rounded-2xl p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 内容：已访问的 Tab 用 block/hidden 切换，保留 state；未访问的不 mount */}
      {visitedTabs.has("inbox") && (
        <div className={activeTab === "inbox" ? "block" : "hidden"}>
          <InboxPage />
        </div>
      )}
      {visitedTabs.has("converge") && (
        <div className={activeTab === "converge" ? "block" : "hidden"}>
          <ConvergePage />
        </div>
      )}
      {visitedTabs.has("graveyard") && (
        <div className={activeTab === "graveyard" ? "block" : "hidden"}>
          <GraveyardPage />
        </div>
      )}
    </div>
  );
}

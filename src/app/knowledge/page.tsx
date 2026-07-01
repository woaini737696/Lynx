"use client";

// 知识聚合页（信息架构精简：对话资产 + 认知库 + 记忆图谱 合并为单页 Tab 切换）
// 原路由 /assets /cognition /memory 保留兼容（侧边栏改指向 /knowledge）
import { useState, useCallback } from "react";
import { MessageSquare, BookOpen, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

import AssetsPage from "@/app/assets/page";
import CognitionPage from "@/app/cognition/page";
import MemoryPage from "@/app/memory/page";

type KnowledgeTab = "assets" | "cognition" | "memory";

const TABS: { key: KnowledgeTab; label: string; icon: typeof Brain }[] = [
  { key: "assets", label: "对话资产", icon: MessageSquare },
  { key: "cognition", label: "认知库", icon: BookOpen },
  { key: "memory", label: "记忆图谱", icon: Brain },
];

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("assets");
  const [visitedTabs, setVisitedTabs] = useState<Set<KnowledgeTab>>(
    new Set(["assets"])
  );

  const handleTabChange = useCallback((key: KnowledgeTab) => {
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

      {visitedTabs.has("assets") && (
        <div className={activeTab === "assets" ? "block" : "hidden"}>
          <AssetsPage />
        </div>
      )}
      {visitedTabs.has("cognition") && (
        <div className={activeTab === "cognition" ? "block" : "hidden"}>
          <CognitionPage />
        </div>
      )}
      {visitedTabs.has("memory") && (
        <div className={activeTab === "memory" ? "block" : "hidden"}>
          <MemoryPage />
        </div>
      )}
    </div>
  );
}

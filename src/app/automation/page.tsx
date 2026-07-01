"use client";

// 自动化聚合页（信息架构精简：AI 工作流 + 飞书任务 合并为单页 Tab 切换）
// 原路由 /ai/flows /ai/lark-tasks 保留兼容（侧边栏改指向 /automation）
import { useState, useCallback } from "react";
import { Workflow, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

import AIFlowsPage from "@/app/ai/flows/page";
import LarkTasksPage from "@/app/ai/lark-tasks/page";

type AutomationTab = "flows" | "lark-tasks";

const TABS: { key: AutomationTab; label: string; icon: typeof Workflow }[] = [
  { key: "flows", label: "AI 工作流", icon: Workflow },
  { key: "lark-tasks", label: "飞书任务", icon: ListTodo },
];

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<AutomationTab>("flows");
  const [visitedTabs, setVisitedTabs] = useState<Set<AutomationTab>>(
    new Set(["flows"])
  );

  const handleTabChange = useCallback((key: AutomationTab) => {
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

      {visitedTabs.has("flows") && (
        <div className={activeTab === "flows" ? "block" : "hidden"}>
          <AIFlowsPage />
        </div>
      )}
      {visitedTabs.has("lark-tasks") && (
        <div className={activeTab === "lark-tasks" ? "block" : "hidden"}>
          <LarkTasksPage />
        </div>
      )}
    </div>
  );
}

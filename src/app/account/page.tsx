"use client";

// 账户聚合页（信息架构精简：钱包 + 会员 合并为单页 Tab 切换）
// 子页保留各自 PageHeader 作为子标题，聚合页只提供 Tab 导航
// 原路由 /wallet /membership 保留兼容（侧边栏改指向 /account）
import { useState, useCallback } from "react";
import { Wallet, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

// 子页组件（自包含，各自管理数据与状态）
import WalletPage from "@/app/wallet/page";
import MembershipPage from "@/app/membership/page";

type AccountTab = "wallet" | "membership";

const TABS: { key: AccountTab; label: string; icon: typeof Wallet }[] = [
  { key: "wallet", label: "钱包", icon: Wallet },
  { key: "membership", label: "会员", icon: Crown },
];

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<AccountTab>("wallet");
  // visitedTabs：仅在首次访问时 mount 对应 Tab 内容，避免首屏请求风暴
  const [visitedTabs, setVisitedTabs] = useState<Set<AccountTab>>(
    new Set(["wallet"])
  );

  const handleTabChange = useCallback((key: AccountTab) => {
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
      {visitedTabs.has("wallet") && (
        <div className={activeTab === "wallet" ? "block" : "hidden"}>
          <WalletPage />
        </div>
      )}
      {visitedTabs.has("membership") && (
        <div className={activeTab === "membership" ? "block" : "hidden"}>
          <MembershipPage />
        </div>
      )}
    </div>
  );
}

"use client";

// 技能 layout：Tab 导航条（技能管理 / Skill 市场）
// 使用路由级 Tab（layout + 子路由），保留 /skills/market 的 useSearchParams URL 依赖
// 原 /skills 和 /skills/market 子页完全不改动
import { usePathname, useRouter } from "next/navigation";
import { Wrench, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

const TABS = [
  { href: "/skills", label: "技能管理", icon: Wrench, match: (p: string) => p === "/skills" },
  { href: "/skills/market", label: "Skill 市场", icon: Store, match: (p: string) => p.startsWith("/skills/market") },
] as const;

export default function SkillsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleTabClick = useCallback(
    (href: string) => {
      if (pathname !== href) router.push(href);
    },
    [pathname, router]
  );

  return (
    <div>
      <div className="sticky top-0 z-20 -mx-1 px-1 pt-2">
        <div className="glass-card flex gap-1 overflow-x-auto rounded-2xl p-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(pathname);
            return (
              <button
                key={tab.href}
                type="button"
                onClick={() => handleTabClick(tab.href)}
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
      {children}
    </div>
  );
}

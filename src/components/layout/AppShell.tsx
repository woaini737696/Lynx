"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { CaptureBar } from "./CaptureBar";
import { TitleBar } from "./TitleBar";
import { RecentTabs } from "./RecentTabs";

function ConvergeReminder() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState(30);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const check = () => {
      const h = new Date().getHours();
      const isConvergeTime = h >= 23 || h < 6;
      const alreadyDismissed = sessionStorage.getItem("convergeDismissed") === "1";
      setVisible(isConvergeTime && !alreadyDismissed && pathname !== "/converge");
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [pathname, mounted]);

  useEffect(() => {
    if (!visible) return;
    if (remaining <= 0) {
      router.push("/converge");
      return;
    }
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [visible, remaining, router]);

  if (!mounted || !visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xl">
      <div className="glass-card w-[90vw] max-w-[420px] rounded-3xl border border-northstar/20 p-6 text-center shadow-2xl sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-northstar/10 text-3xl">
          🌙
        </div>
        <h2 className="text-lg font-semibold text-northstar">灵感收敛时间</h2>
        <p className="mt-2 text-sm text-muted-foreground">23:00-06:00 必须清空 Inbox</p>
        <p className="mt-1 text-xs text-muted-foreground/60">{remaining} 秒后自动跳转</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => router.push("/converge")}
            className="btn-doubao rounded-xl px-4 py-2 text-sm font-medium"
          >
            立即收敛
          </button>
          <button
            onClick={() => {
              sessionStorage.setItem("convergeDismissed", "1");
              setVisible(false);
            }}
            className="rounded-xl border border-border bg-muted/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            稍后提醒
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TitleBar />
      {/* 布局 1:1 还原 ui-preview-v2.html：侧边栏直达顶部，顶部操作栏位于主内容区内 */}
      <div className="relative flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="relative flex flex-1 flex-col overflow-hidden">
          <CaptureBar />
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
      <RecentTabs />
      <ConvergeReminder />
    </div>
  );
}

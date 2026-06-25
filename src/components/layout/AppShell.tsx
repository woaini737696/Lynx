"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { CaptureBar } from "./CaptureBar";
import { Button } from "./PageHeader";

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
      <div className="w-[90vw] max-w-[420px] rounded-3xl border border-northstar/30 bg-card p-6 text-center shadow-2xl sm:p-8">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-northstar/10 text-3xl mx-auto">
          🌙
        </div>
        <h2 className="text-lg font-semibold text-northstar">灵感收敛时间</h2>
        <p className="mt-2 text-sm text-muted-foreground">23:00-06:00 必须清空 Inbox</p>
        <p className="mt-1 text-xs text-muted-foreground/60">{remaining} 秒后自动跳转</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => router.push("/converge")}>立即收敛</Button>
          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.setItem("convergeDismissed", "1");
              setVisible(false);
            }}
          >
            稍后提醒
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <CaptureBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="relative flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.05),transparent_50%)]" />
          {children}
        </main>
      </div>
      <ConvergeReminder />
    </div>
  );
}

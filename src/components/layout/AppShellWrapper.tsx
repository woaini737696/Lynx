"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./AppShell";

export function AppShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 登录页使用独立全屏布局，不嵌入 AppShell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}

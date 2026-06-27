import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { LightningInput } from "@/components/lightning/LightningInput";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { SuppressDevErrors } from "@/components/layout/SuppressDevErrors";
import { Toaster } from "@/components/ui/toast";
import { AsyncLoadingProvider } from "@/components/ui/AsyncLoading";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ReminderManager } from "@/components/layout/ReminderManager";
import { PWARegister } from "@/components/layout/PWARegister";
import { AssistantGlobalEntry } from "@/components/ai/AssistantGlobalEntry";
import { DesktopBridge } from "@/components/layout/DesktopBridge";
import { DesktopBehavior } from "@/components/layout/DesktopBehavior";
import { RoutePreloader } from "@/components/layout/RoutePreloader";
import { SWRProvider } from "@/components/providers/SWRProvider";

export const metadata: Metadata = {
  title: "Lynx · 个人认知操作系统",
  description: "灵感收敛 · 工作聚焦 · 记忆复利",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Lynx",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#030816" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/lynx-icon-256.png" type="image/png" />
        <link rel="apple-touch-icon" href="/lynx-icon-256.png" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <SWRProvider>
            <AsyncLoadingProvider>
              <SuppressDevErrors />
              <DesktopBridge />
              <DesktopBehavior />
              <RoutePreloader />
              <AppShell>{children}</AppShell>
              <LightningInput />
              <CommandPalette />
              <ReminderManager />
              <PWARegister />
              <AssistantGlobalEntry />
              <Toaster />
            </AsyncLoadingProvider>
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

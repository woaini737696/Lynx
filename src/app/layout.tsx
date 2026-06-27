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
import { SWRProvider } from "@/components/providers/SWRProvider";

export const metadata: Metadata = {
  title: "LynnHub · 个人认知操作系统",
  description: "灵感收敛 · 工作聚焦 · 记忆复利",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LynnHub",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
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
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23f97316'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-size='18' font-weight='bold' fill='%23fff'%3EL%3C/text%3E%3C/svg%3E"
          type="image/svg+xml"
        />
        <link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'%3E%3Crect width='180' height='180' rx='32' fill='%23f97316'/%3E%3Ctext x='90' y='125' text-anchor='middle' font-size='100' font-weight='bold' fill='%23fff'%3EL%3C/text%3E%3C/svg%3E" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <SWRProvider>
            <AsyncLoadingProvider>
              <SuppressDevErrors />
              <DesktopBridge />
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

import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { AppShellWrapper } from "@/components/layout/AppShellWrapper";
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
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "Lynx AI工作站",
  description: "灵感收敛 · 工作聚焦 · 记忆复利",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/lynx-icon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/lynx-icon-128.png", sizes: "128x128", type: "image/png" },
      { url: "/lynx-icon-256.png", sizes: "256x256", type: "image/png" },
    ],
    apple: [
      { url: "/lynx-icon-256.png", sizes: "256x256", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "Lynx AI工作站",
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
      <body className="starfield min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <SWRProvider>
            <AsyncLoadingProvider>
              <SuppressDevErrors />
              <DesktopBridge />
              <DesktopBehavior />
              <RoutePreloader />
              {/* AuthProvider 使用 useSearchParams，需要 Suspense 包裹 */}
              <Suspense fallback={null}>
                <AuthProvider>
                  <AppShellWrapper>{children}</AppShellWrapper>
                </AuthProvider>
              </Suspense>
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

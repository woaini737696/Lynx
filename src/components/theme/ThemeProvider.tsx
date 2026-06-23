"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode, useEffect } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("theme-transition");
    return () => {
      html.classList.remove("theme-transition");
    };
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}

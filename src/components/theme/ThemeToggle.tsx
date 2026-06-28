"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  variant = "icon",
}: {
  variant?: "icon" | "segmented";
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-xl bg-muted" />
    );
  }

  if (variant === "segmented") {
    return (
      <div className="ios-glass-sm inline-flex h-9 items-center rounded-full p-0.5">
        {[
          { key: "light", label: "浅色" },
          { key: "dark", label: "深色" },
          { key: "system", label: "系统" },
        ].map((item) => {
          const active = theme === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTheme(item.key)}
              className={cn(
                "flex h-full items-center rounded-full px-2.5 text-[10px] font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.label}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  const next =
    theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  return (
    <button
      onClick={() => setTheme(next)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="切换主题"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}

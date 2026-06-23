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
      <div className="inline-flex items-center rounded-xl border border-border bg-muted/60 p-0.5">
        {[
          { key: "light", icon: Sun, label: "浅色" },
          { key: "dark", icon: Moon, label: "深色" },
          { key: "system", icon: Monitor, label: "系统" },
        ].map((item) => {
          const active = theme === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setTheme(item.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-all",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.label}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{item.label}</span>
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

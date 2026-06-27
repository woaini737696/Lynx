"use client";

import { useEffect, useState } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { isDesktop } from "@/lib/desktop-client";

function getTauriWindow(): any | null {
  if (typeof window === "undefined") return null;
  try {
    return (window as any).__TAURI__?.window?.getCurrentWindow?.() || null;
  } catch {
    return null;
  }
}

/**
 * 桌面端自定义标题栏
 * - 仅在 Tauri 桌面端显示
 * - 隐藏原生标题栏的 Lynx 图标/文字
 * - 提供拖拽区域和最小化/最大化/关闭按钮
 */
export function TitleBar() {
  const [mounted, setMounted] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const win = getTauriWindow();
    if (!win) return;

    const updateState = async () => {
      try {
        const maximized = await win.isMaximized();
        setIsMaximized(maximized);
      } catch {
        // ignore
      }
    };
    updateState();

    let unlisten: (() => void) | null = null;
    if (typeof win.onResized === "function") {
      win.onResized(updateState).then((fn: any) => {
        unlisten = fn;
      }).catch(() => {});
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!mounted || !isDesktop()) return null;

  const win = getTauriWindow();
  if (!win) return null;

  const minimize = () => {
    try {
      win.minimize?.();
    } catch {
      // ignore
    }
  };

  const maximize = () => {
    try {
      if (isMaximized) {
        win.unmaximize?.();
      } else {
        win.maximize?.();
      }
    } catch {
      // ignore
    }
  };

  const close = () => {
    try {
      win.close?.();
    } catch {
      // ignore
    }
  };

  return (
    <div className="glass-bar flex h-9 w-full shrink-0 select-none items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground/70">Lynx</span>
      </div>

      {/* 拖拽区域：占据标题栏中间空白 */}
      <div data-tauri-drag-region className="flex-1 self-stretch" />

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={minimize}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="最小化"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={maximize}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={isMaximized ? "还原" : "最大化"}
        >
          {isMaximized ? (
            <Maximize2 className="h-3 w-3" />
          ) : (
            <Square className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          onClick={close}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-graveyard hover:text-white"
          aria-label="关闭"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import {
  isDesktop,
  getCurrentWindow,
  windowMinimize,
  windowToggleMaximize,
  windowClose,
  windowIsMaximized,
  onWindowResized,
} from "@/lib/desktop-client";

/**
 * 桌面端自定义标题栏（无边框窗口用，豆包/Kimi 风格）
 * - 仅在 Tauri 桌面端显示
 * - 左侧 Lynx 品牌标识 + 右侧最小化/最大化/关闭按钮
 * - 中间为可拖拽区域（data-tauri-drag-region）
 * - 双击拖拽区域切换最大化（原生窗口行为）
 */
export function TitleBar() {
  const [mounted, setMounted] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;

    const updateState = async () => {
      setIsMaximized(await windowIsMaximized());
    };
    updateState();

    let unlisten: (() => void) | null = null;
    onWindowResized(updateState).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!mounted || !isDesktop()) return null;
  if (!getCurrentWindow()) return null;

  return (
    <div className="glass-bar flex h-9 w-full shrink-0 select-none items-center justify-between px-2">
      {/* 左侧：Lynx 品牌标识（黑底白色猞猁高清 logo） */}
      <div className="flex items-center gap-2 pl-1">
        <Image
          src="/lynx-logo-black.png"
          alt="Lynx"
          width={20}
          height={20}
          className="h-5 w-5 rounded-[6px] object-cover shadow-sm"
          draggable={false}
        />
        <span className="text-xs font-medium text-foreground/70">Lynx</span>
      </div>

      {/* 中间：拖拽区域（双击切换最大化） */}
      <div
        data-tauri-drag-region
        onDoubleClick={() => windowToggleMaximize()}
        className="flex-1 self-stretch"
      />

      {/* 右侧：窗口控制按钮 */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => windowMinimize()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="最小化"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => windowToggleMaximize()}
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
          onClick={() => windowClose()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
          aria-label="关闭"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

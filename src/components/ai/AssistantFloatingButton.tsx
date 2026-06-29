"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface AssistantFloatingButtonProps {
  /** 当前抽屉是否打开（用于按钮态展示） */
  open?: boolean;
  /** 点击按钮回调，由父组件管理开合状态 */
  onToggle?: () => void;
  /** 未读消息数（右上角红点） */
  unreadCount?: number;
}

const POSITION_KEY = "lynnhub:assistant-fab-pos";

/** 默认位置（右下角） */
const DEFAULT_POS = { x: -1, y: -1 }; // -1 表示使用默认右下角定位

/**
 * Lynx AI 超级助理全局悬浮入口按钮
 * - 可自由拖动位置（保存到 localStorage）
 * - 每次打开默认位置不变（用户拖动后下次记住新位置）
 * - 液态玻璃质感
 * - 未读数字红点（unreadCount > 0 时显示，已读后消失）
 * - 点击调用 onToggle（拖动时不触发点击）
 */
export function AssistantFloatingButton({ open, onToggle, unreadCount = 0 }: AssistantFloatingButtonProps) {
  const [pos, setPos] = useState(DEFAULT_POS);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // 加载保存的位置
  useEffect(() => {
    try {
      const raw = localStorage.getItem(POSITION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.x === "number" && typeof saved.y === "number") {
          setPos(saved);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 拖动处理：onPointerDown -> onPointerMove -> onPointerUp
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return; // 仅左键
    dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
    setDragging(true);
    // 捕获指针，确保移动事件持续触发
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragStartRef.current.moved = true;
    }
    // 计算新位置（基于按钮中心点）
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2 + dx;
    const cy = rect.top + rect.height / 2 + dy;
    // 限制在视口内
    const margin = 32;
    const clampedX = Math.max(margin, Math.min(window.innerWidth - margin, cx));
    const clampedY = Math.max(margin, Math.min(window.innerHeight - margin, cy));
    setPos({ x: clampedX, y: clampedY });
    // 更新起点
    dragStartRef.current.x = e.clientX;
    dragStartRef.current.y = e.clientY;
  }, [dragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const wasMoved = dragStartRef.current.moved;
    setDragging(false);
    dragStartRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    // 保存位置（仅当真正拖动过时）
    if (wasMoved) {
      try {
        localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
      } catch {
        // ignore
      }
    } else {
      // 未拖动：视为点击
      onToggle?.();
    }
  }, [pos, onToggle]);

  // 定位样式：默认右下角，拖动后使用保存的位置
  const positionStyle: React.CSSProperties =
    pos.x < 0 || pos.y < 0
      ? { right: "32px", bottom: "32px" } // 默认右下角
      : { left: `${pos.x}px`, top: `${pos.y}px`, transform: "translate(-50%, -50%)" };

  return (
    <div
      className="group fixed z-40 flex items-center"
      style={positionStyle}
    >
      {/* 快捷键提示标签：hover 时从左侧滑出 */}
      <div
        aria-hidden="true"
        className="pointer-events-none mr-3 translate-x-2 rounded-xl border border-border/60 bg-popover/90 px-3 py-1.5 text-xs font-medium text-popover-foreground opacity-0 shadow-xl backdrop-blur-xl transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
      >
        Lynx AI · Alt + J
      </div>

      <button
        ref={btnRef}
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        aria-label={open ? "收起 Lynx AI 超级助理" : "打开 Lynx AI 超级助理"}
        aria-pressed={open}
        className={`glass-fab relative flex h-14 w-14 shrink-0 cursor-grab items-center justify-center rounded-full text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${dragging ? "cursor-grabbing !opacity-90" : ""}`}
        style={{ touchAction: "none" }}
      >
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>

        {/* 未读消息红点：unreadCount > 0 时显示，已读（=0）后消失 */}
        {unreadCount > 0 && (
          <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

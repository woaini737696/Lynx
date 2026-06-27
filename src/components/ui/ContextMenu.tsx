"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * 桌面端自定义右键菜单组件
 *
 * 用法：
 * 1. 用 <ContextMenuProvider> 包裹应用（在 layout 中）
 * 2. 在列表项上设置 onContextMenu={openContextMenu(e, items)}
 *    - items 是菜单项数组
 *
 * 仅在桌面端（Tauri 环境）生效，Web 端不显示自定义右键菜单。
 */

export interface ContextMenuItem {
  /** 菜单项标签（separator 为 true 时可省略） */
  label?: string;
  /** 点击回调 */
  onClick?: () => void;
  /** 图标（可选，ReactNode） */
  icon?: React.ReactNode;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否危险操作（红色文字） */
  danger?: boolean;
  /** 分隔符（为 true 时其他字段忽略） */
  separator?: boolean;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

let menuState: MenuState | null = null;
let setMenuStateFn: ((s: MenuState | null) => void) | null = null;

/** 打开右键菜单（供列表项调用） */
export function openContextMenu(
  e: React.MouseEvent,
  items: ContextMenuItem[]
): void {
  // 仅桌面端生效
  if (typeof window === "undefined" || !window.__TAURI__) return;
  e.preventDefault();
  e.stopPropagation();
  if (setMenuStateFn) {
    setMenuStateFn({ x: e.clientX, y: e.clientY, items });
  }
}

/** 关闭右键菜单 */
export function closeContextMenu(): void {
  if (setMenuStateFn) setMenuStateFn(null);
}

/**
 * 右键菜单渲染器（全局唯一实例）
 * 挂载在 layout 顶层，负责渲染菜单和处理点击关闭
 */
export function ContextMenuRenderer() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuStateFn = setMenu;
    return () => {
      setMenuStateFn = null;
    };
  }, []);

  // 点击外部或 ESC 关闭
  useEffect(() => {
    if (!menu) return;
    const handleClick = () => setMenu(null);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    // 延迟绑定，避免触发菜单的同一事件立即关闭
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClick);
      document.addEventListener("contextmenu", handleClick);
      document.addEventListener("keydown", handleEsc);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("contextmenu", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menu]);

  // 边界检测：确保菜单不超出视口
  useEffect(() => {
    if (!menu || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      el.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, [menu]);

  if (!menu) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[160px] rounded-xl border border-border bg-popover/95 py-1.5 shadow-2xl backdrop-blur-xl"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item, i) => {
        if (item.separator) {
          return (
            <div key={i} className="my-1 h-px bg-border/60" />
          );
        }
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => {
              setMenu(null);
              item.onClick?.();
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              item.danger
                ? "text-destructive hover:bg-destructive/8"
                : "text-foreground hover:bg-primary/8 hover:text-primary"
            }`}
          >
            {item.icon && <span className="flex h-4 w-4 items-center justify-center shrink-0">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

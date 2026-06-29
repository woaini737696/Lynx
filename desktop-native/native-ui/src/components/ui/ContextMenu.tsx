import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: React.ElementType;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ContextMenuSeparator {
  key: string;
  separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    let ax = x;
    let ay = y;
    if (x + rect.width > window.innerWidth - 8) {
      ax = window.innerWidth - rect.width - 8;
    }
    if (y + rect.height > window.innerHeight - 8) {
      ay = window.innerHeight - rect.height - 8;
    }
    setAdjustedPos({ x: ax, y: ay });
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleScroll = () => onClose();
    const handleResize = () => onClose();

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="context-menu fixed z-[300] min-w-[180px] overflow-hidden rounded-xl border border-border/60 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
        style={{ left: adjustedPos.x, top: adjustedPos.y }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((item) => {
          if ("separator" in item) {
            return (
              <div
                key={item.key}
                className="my-1 h-px bg-border/60"
              />
            );
          }
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => {
                if (!item.disabled) {
                  item.onSelect();
                  onClose();
                }
              }}
              disabled={item.disabled}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors",
                item.danger
                  ? "text-red-500 hover:bg-red-500/10"
                  : "text-foreground/90 hover:bg-primary/10 hover:text-foreground",
                item.disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}

export function useContextMenu<T = unknown>() {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [data, setData] = useState<T | null>(null);

  const open = (e: React.MouseEvent, itemData?: T) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
    if (itemData !== undefined) setData(itemData);
  };

  const close = () => {
    setPosition(null);
    setData(null);
  };

  return { position, data, open, close };
}

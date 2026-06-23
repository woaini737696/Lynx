"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

let toastId = 0;
const listeners: Array<(toasts: ToastItem[]) => void> = [];
let toasts: ToastItem[] = [];

export type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

function emit() {
  listeners.forEach((fn) => fn([...toasts]));
}

export function toast(message: string, type: ToastType = "info") {
  const id = ++toastId;
  toasts = [...toasts, { id, message, type }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 2800);
}

function subscribe(callback: (toasts: ToastItem[]) => void) {
  listeners.push(callback);
  callback([...toasts]);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function getSnapshot() {
  return toasts;
}

const emptyToasts: ToastItem[] = [];

function getServerSnapshot() {
  return emptyToasts;
}

function useToasts() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function Toaster() {
  const [mounted, setMounted] = useState(false);
  const items = useToasts();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 sm:bottom-6 sm:right-6">
      {items.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              "flex min-w-[200px] max-w-[calc(100vw-2.5rem)] items-center gap-2 rounded-xl border px-3 py-2.5 text-xs shadow-lg animate-in fade-in slide-in-from-bottom-2",
              t.type === "success" &&
                "border-task/30 bg-task/10 text-task",
              t.type === "error" &&
                "border-graveyard/30 bg-graveyard/10 text-graveyard",
              t.type === "info" &&
                "border-cognition/30 bg-cognition/10 text-cognition"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => {
                toasts = toasts.filter((x) => x.id !== t.id);
                emit();
              }}
              className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
              aria-label="关闭"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

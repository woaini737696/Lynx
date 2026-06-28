import { AnimatePresence, motion } from "framer-motion";
import { Check, X, Info, AlertCircle } from "lucide-react";
import { useToastStore, type ToastType } from "@/lib/toast";
import { cn } from "@/lib/utils";

const iconMap: Record<ToastType, React.ElementType> = {
  success: Check,
  error: AlertCircle,
  info: Info,
};

const styleMap: Record<ToastType, string> = {
  success: "text-task border-task/30",
  error: "text-graveyard border-graveyard/30",
  info: "text-primary border-primary/30",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[300] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = iconMap[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "ios-glass pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 text-sm shadow-xl",
                styleMap[t.type]
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-foreground">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="ml-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

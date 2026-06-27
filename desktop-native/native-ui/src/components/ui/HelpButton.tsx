import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { helpContent, type HelpKey } from "@/lib/help-content";

interface HelpButtonProps {
  module: HelpKey;
  className?: string;
}

export function HelpButton({ module, className }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const content = helpContent[module];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="使用说明"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground",
          className
        )}
      >
        <HelpCircle className="h-[18px] w-[18px]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="ios-glass w-full max-w-lg overflow-hidden p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <h3 className="text-lg font-semibold text-foreground">{content.title}</h3>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-auto p-5">
                <div className="space-y-3 text-sm leading-relaxed text-foreground/80">
                  {content.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {content.tips.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border/50 bg-muted/30 p-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">使用技巧</p>
                    <ul className="space-y-1.5 text-sm text-foreground/80">
                      {content.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

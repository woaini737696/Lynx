import { useState, useEffect, useRef } from "react";
import { Search, Command, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const suggestions = [
  { id: "focus", label: "今日聚焦", shortcut: "G F" },
  { id: "board", label: "决策看板", shortcut: "G B" },
  { id: "ai-workspace", label: "AI 工作空间", shortcut: "G W" },
  { id: "ai-assistant", label: "AI 专属助理", shortcut: "G A" },
];

export function QuickSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="glass-btn flex h-9 w-full max-w-md items-center justify-between gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-all hover:text-foreground"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span>快速搜索...</span>
        </div>
        <div className="flex items-center gap-1 text-xs opacity-60">
          <Command className="h-3 w-3" />
          <span>K</span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center bg-background/60 backdrop-blur-sm pt-[18vh]"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="ios-glass w-full max-w-xl overflow-hidden p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索功能、页面或输入 AI 指令..."
                  className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[50vh] overflow-auto p-2">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">快捷跳转</div>
                {suggestions.map((item) => (
                  <div
                    key={item.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {item.label}
                    </div>
                    <span className="text-xs text-muted-foreground">{item.shortcut}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
                <span>Enter 跳转</span>
                <span>ESC 关闭</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

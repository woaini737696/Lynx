import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, CornerDownLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const suggestions = [
  { id: "focus", label: "今日聚焦", to: "/focus" },
  { id: "inbox", label: "Inbox 灵感收件箱", to: "/inbox" },
  { id: "cognition", label: "认知库", to: "/cognition" },
  { id: "board", label: "决策看板", to: "/board" },
  { id: "graveyard", label: "灵感墓地", to: "/graveyard" },
  { id: "ai-workspace", label: "AI 工作空间", to: "/ai/workspace" },
  { id: "ai-flows", label: "AI 工作流", to: "/ai/flows" },
  { id: "ai-assistant", label: "Lynx超级助理", to: "/ai/assistant" },
  { id: "skills", label: "技能管理", to: "/skills" },
  { id: "agent", label: "Lynx Agent", to: "/agent" },
  { id: "settings", label: "设置", to: "/settings" },
];

export function QuickSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions.filter((s) =>
    s.label.toLowerCase().includes(query.toLowerCase())
  );

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
      setActiveIndex(0);
    } else {
      setQuery("");
    }
  }, [open]);

  const jumpTo = (to: string) => {
    navigate(to);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIndex]) {
        jumpTo(filtered[activeIndex].to);
      }
    }
  };

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
        {/* 快捷键提示 - 修复位置：紧贴右侧，使用 Ctrl+K 文字（Windows 桌面端） */}
        <kbd className="flex shrink-0 items-center gap-0.5 rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
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
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="搜索页面或功能..."
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
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  {query.trim() ? "搜索结果" : "快捷跳转"}
                </div>

                {filtered.length > 0 ? (
                  filtered.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => jumpTo(item.to)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        idx === activeIndex
                          ? "bg-primary/10 text-foreground"
                          : "text-foreground/80 hover:bg-primary/10 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Search className="h-4 w-4 text-primary" />
                        {item.label}
                      </div>
                      {idx === activeIndex && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    无匹配页面
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>↑↓ 导航</span>
                  <span>Enter 跳转</span>
                </div>
                <span>ESC 关闭</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

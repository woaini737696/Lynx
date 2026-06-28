import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search as SearchIcon,
  Sparkles,
  Loader2,
  Lightbulb,
  MessageSquare,
  Brain,
  CheckSquare,
  Star,
  ArrowRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";

type SearchMode = "keyword" | "semantic";

interface KeywordResult {
  id: string;
  type: "idea" | "task" | "cognition" | "memory" | "skill";
  title: string;
  snippet: string;
  createdAt: string;
}

interface SemanticResult {
  id: string;
  label: string;
  source: string;
  score: number;
  type: string;
}

// 类型 -> 跳转路径 + 图标 + 标签 + 颜色
const TYPE_META: Record<
  string,
  { href: string; icon: typeof Lightbulb; label: string; color: string; available: boolean }
> = {
  idea: { href: "/inbox", icon: Lightbulb, label: "灵感", color: "text-foreground", available: true },
  task: { href: "/board", icon: CheckSquare, label: "任务", color: "text-campaign", available: true },
  cognition: { href: "/cognition", icon: Brain, label: "认知", color: "text-cognition", available: true },
  memory: { href: "/cognition", icon: Brain, label: "记忆", color: "text-cognition", available: true },
  conversation: { href: "/cognition", icon: MessageSquare, label: "对话", color: "text-campaign", available: true },
  skill: { href: "/cognition", icon: Star, label: "技能", color: "text-campaign", available: true },
};

function extractType(source: string): string {
  const match = source.match(/^(\w+)/);
  return match ? match[1] : "memory";
}

export function SearchPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<SearchMode>("keyword");
  const [query, setQuery] = useState("");
  const [keywordResults, setKeywordResults] = useState<KeywordResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doKeywordSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setKeywordResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await cloudApi.get<{ results?: KeywordResult[] }>(
        `/api/search?q=${encodeURIComponent(q)}&limit=30`
      );
      setKeywordResults(data.results || []);
    } catch (e) {
      toast.error((e as Error).message || "搜索失败");
      setKeywordResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const doSemanticSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSemanticResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await cloudApi.get<{ results?: SemanticResult[] }>(
        `/api/memory/search?q=${encodeURIComponent(q)}&limit=30`
      );
      setSemanticResults(data.results || []);
    } catch (e) {
      toast.error((e as Error).message || "语义搜索失败");
      setSemanticResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 防抖触发搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setKeywordResults([]);
      setSemanticResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      if (mode === "keyword") doKeywordSearch(q);
      else doSemanticSearch(q);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode, doKeywordSearch, doSemanticSearch]);

  const switchMode = (newMode: SearchMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setKeywordResults([]);
    setSemanticResults([]);
    setSearched(false);
  };

  const handleResultClick = (type: string) => {
    const meta = TYPE_META[type] || TYPE_META.memory;
    navigate(meta.href);
  };

  const hasResults =
    mode === "keyword" ? keywordResults.length > 0 : semanticResults.length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      {/* 页头 */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">全局搜索</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            关键词精确匹配 · 语义搜索按相似度召回
          </p>
        </div>
        <HelpButton module="search" />
      </div>

      {/* 搜索框 */}
      <div className="mb-4">
        <div className="ios-glass relative flex items-center">
          <SearchIcon className="absolute left-4 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "keyword"
                ? "输入关键词搜索灵感、任务、认知、记忆..."
                : "用自然语言描述，语义匹配最相关的内容..."
            }
            className="w-full rounded-xl bg-transparent py-3 pl-11 pr-12 text-sm outline-none placeholder:text-muted-foreground/60"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-4 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* 模式切换 */}
      <div className="ios-glass mb-5 flex rounded-xl p-1">
        <button
          onClick={() => switchMode("keyword")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs transition-colors",
            mode === "keyword"
              ? "bg-primary/15 font-medium text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <SearchIcon className="h-3.5 w-3.5" />
          关键词搜索
        </button>
        <button
          onClick={() => switchMode("semantic")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs transition-colors",
            mode === "semantic"
              ? "bg-cognition/15 font-medium text-cognition"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          语义搜索
        </button>
      </div>

      {/* 语义搜索说明 */}
      <AnimatePresence>
        {mode === "semantic" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="glass-card border-cognition/20 bg-cognition/5 p-3 text-[11px] text-muted-foreground">
              <Sparkles className="mr-1 inline h-3 w-3 text-cognition" />
              语义搜索基于向量相似度，会返回与查询含义最接近的内容，并标注相似度分数。即使没有完全匹配的关键词也能找到相关结果。
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 搜索结果 */}
      {loading ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">搜索中...</p>
        </div>
      ) : !searched ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
          <SearchIcon className="h-10 w-10 opacity-40" />
          <div className="text-center">
            <p className="text-sm font-medium">开始搜索</p>
            <p className="mt-1 text-xs">输入关键词或切换到语义搜索模式</p>
          </div>
        </div>
      ) : !hasResults ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground">
          <SearchIcon className="h-10 w-10 opacity-40" />
          <div className="text-center">
            <p className="text-sm font-medium">未找到相关结果</p>
            <p className="mt-1 text-xs">
              {mode === "keyword"
                ? "尝试更换关键词，或切换到语义搜索"
                : "尝试用更自然的语言描述，或检查是否有记忆数据"}
            </p>
          </div>
        </div>
      ) : mode === "keyword" ? (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {keywordResults.map((item) => {
              const meta = TYPE_META[item.type] || TYPE_META.memory;
              const Icon = meta.icon;
              return (
                <motion.div
                  key={`${item.type}-${item.id}`}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  onClick={() => handleResultClick(item.type)}
                  className="glass-card group cursor-pointer p-4 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {item.title}
                        </span>
                        <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {meta.label}
                        </span>
                      </div>
                      {item.snippet && (
                        <p
                          className="text-xs leading-relaxed text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: item.snippet }}
                        />
                      )}
                      <div className="mt-1 text-[10px] text-muted-foreground/70">
                        {new Date(item.createdAt).toLocaleString("zh-CN")}
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {semanticResults.map((item, idx) => {
              const type = extractType(item.source);
              const meta = TYPE_META[type] || TYPE_META.memory;
              const Icon = meta.icon;
              const scorePercent = Math.round(item.score * 100);
              return (
                <motion.div
                  key={`${item.id}-${idx}`}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  onClick={() => handleResultClick(type)}
                  className="glass-card group cursor-pointer p-4 transition-all hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-3">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {item.label}
                        </span>
                        <span className="rounded-full border border-cognition/20 bg-cognition/10 px-2 py-0.5 text-[10px] text-cognition">
                          {meta.label}
                        </span>
                      </div>
                      <div className="mb-2 text-[10px] text-muted-foreground/70">
                        {item.source}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">相似度</span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              scorePercent >= 70
                                ? "bg-task"
                                : scorePercent >= 40
                                  ? "bg-cognition"
                                  : "bg-muted-foreground/40"
                            )}
                            style={{ width: `${Math.max(scorePercent, 3)}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            scorePercent >= 70
                              ? "text-task"
                              : scorePercent >= 40
                                ? "text-cognition"
                                : "text-muted-foreground"
                          )}
                        >
                          {scorePercent}%
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

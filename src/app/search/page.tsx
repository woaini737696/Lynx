"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  Loader2,
  Lightbulb,
  MessageSquare,
  Brain,
  CheckSquare,
  Star,
  ArrowRight,
} from "lucide-react";
import { PageHeader, Card, Badge, LoadingState } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { cn } from "@/lib/utils";

type SearchMode = "keyword" | "semantic";

// 关键词搜索结果（/api/search）
interface KeywordResult {
  id: string;
  type: "idea" | "task" | "cognition" | "memory" | "skill";
  title: string;
  snippet: string;
  createdAt: string;
}

// 语义搜索结果（/api/memory/search）
interface SemanticResult {
  id: string;
  label: string;
  source: string;
  score: number;
  type: string;
}

// 类型 -> 跳转路径 + 图标 + 标签
const TYPE_META: Record<
  string,
  { href: string; icon: typeof Lightbulb; label: string; color: string }
> = {
  idea: { href: "/inbox", icon: Lightbulb, label: "灵感", color: "text-foreground" },
  task: { href: "/board", icon: CheckSquare, label: "任务", color: "text-campaign" },
  cognition: { href: "/cognition", icon: Brain, label: "认知", color: "text-cognition" },
  memory: { href: "/memory", icon: Brain, label: "记忆", color: "text-cognition" },
  conversation: { href: "/assets", icon: MessageSquare, label: "对话", color: "text-campaign" },
  skill: { href: "/skills", icon: Star, label: "技能", color: "text-campaign" },
};

// 从语义搜索 source 字段提取类型（如 "idea (inbox)" -> "idea"）
function extractType(source: string): string {
  const match = source.match(/^(\w+)/);
  return match ? match[1] : "memory";
}

export default function SearchPage() {
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>("keyword");
  const [query, setQuery] = useState("");
  const [keywordResults, setKeywordResults] = useState<KeywordResult[]>([]);
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 关键词搜索
  const doKeywordSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setKeywordResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setKeywordResults(data.results || []);
      } else {
        setKeywordResults([]);
      }
    } catch {
      setKeywordResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 语义搜索
  const doSemanticSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSemanticResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/memory/search?q=${encodeURIComponent(q)}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setSemanticResults(data.results || []);
      } else {
        setSemanticResults([]);
      }
    } catch {
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

  // 切换模式时清空结果，用当前关键词重新搜索
  const switchMode = (newMode: SearchMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setKeywordResults([]);
    setSemanticResults([]);
    setSearched(false);
  };

  // 点击结果跳转
  const handleResultClick = (type: string) => {
    const meta = TYPE_META[type] || TYPE_META.memory;
    router.push(meta.href);
  };

  const hasResults =
    mode === "keyword"
      ? keywordResults.length > 0
      : semanticResults.length > 0;

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="全局搜索"
        subtitle="关键词精确匹配 · 语义搜索按相似度召回"
      />

      {/* 搜索框 */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "keyword"
                ? "输入关键词搜索灵感、任务、认知、记忆..."
                : "用自然语言描述，语义匹配最相关的内容..."
            }
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
            autoFocus
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* 模式切换 */}
      <div className="mb-5 flex rounded-xl border border-border bg-card p-0.5 sm:w-auto">
        <button
          onClick={() => switchMode("keyword")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs transition-colors sm:flex-none",
            mode === "keyword"
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Search className="h-3.5 w-3.5" />
          关键词搜索
        </button>
        <button
          onClick={() => switchMode("semantic")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs transition-colors sm:flex-none",
            mode === "semantic"
              ? "bg-cognition/10 font-medium text-cognition"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          语义搜索
        </button>
      </div>

      {/* 语义搜索说明 */}
      {mode === "semantic" && (
        <div className="mb-4 rounded-xl border border-cognition/20 bg-cognition/5 p-3 text-[11px] text-muted-foreground">
          <Sparkles className="mr-1 inline h-3 w-3 text-cognition" />
          语义搜索基于向量相似度，会返回与查询含义最接近的内容，并标注相似度分数。即使没有完全匹配的关键词也能找到相关结果。
        </div>
      )}

      {/* 搜索结果 */}
      {loading ? (
        <LoadingState title="搜索中" />
      ) : !searched ? (
        <EmptyState
          icon={Search}
          title="开始搜索"
          description="输入关键词或切换到语义搜索模式"
        />
      ) : !hasResults ? (
        <EmptyState
          icon={Search}
          title="未找到相关结果"
          description={
            mode === "keyword"
              ? "尝试更换关键词，或切换到语义搜索"
              : "尝试用更自然的语言描述，或检查是否有记忆数据"
          }
        />
      ) : mode === "keyword" ? (
        /* 关键词搜索结果 */
        <div className="space-y-2">
          {keywordResults.map((item) => {
            const meta = TYPE_META[item.type] || TYPE_META.memory;
            const Icon = meta.icon;
            return (
              <Card
                key={`${item.type}-${item.id}`}
                hover
                onClick={() => router.push(meta.href)}
                className="cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </span>
                      <Badge color="default">{meta.label}</Badge>
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
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* 语义搜索结果 */
        <div className="space-y-2">
          {semanticResults.map((item, idx) => {
            const type = extractType(item.source);
            const meta = TYPE_META[type] || TYPE_META.memory;
            const Icon = meta.icon;
            const scorePercent = Math.round(item.score * 100);
            return (
              <Card
                key={`${item.id}-${idx}`}
                hover
                onClick={() => handleResultClick(type)}
                className="cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.color)} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                      <Badge color="cognition">{meta.label}</Badge>
                    </div>
                    <div className="mb-2 text-[10px] text-muted-foreground/70">
                      {item.source}
                    </div>
                    {/* 相似度分数 */}
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
                  <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

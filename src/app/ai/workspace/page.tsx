"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LayoutGrid,
  Sparkles,
  Bot,
  Workflow,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  FileText,
  Code,
  Brain,
  X,
  Loader2,
  Play,
  History,
  RotateCcw,
  Search,
  Star,
  Users,
  Package,
} from "lucide-react";
import { PageHeader, Card, Button, Badge } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  DISTILL_TEMPLATES,
  type DistillTemplate,
  type DistillCategory,
} from "@/lib/distill-templates";

// 图标名 → 组件映射
const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp,
  FileText,
  Code,
  Brain,
  Users,
  Package,
};

const CATEGORY_COLOR: Record<DistillCategory, "task" | "cognition" | "northstar" | "campaign" | "graveyard"> = {
  finance: "northstar",
  report: "task",
  review: "cognition",
  knowledge: "campaign",
  meeting: "graveyard",
  product: "campaign",
};

const CATEGORY_LABEL: Record<DistillCategory, string> = {
  finance: "财务",
  report: "报告",
  review: "审查",
  knowledge: "知识",
  meeting: "会议",
  product: "产品",
};

const CATEGORY_FILTERS: Array<{ key: "all" | DistillCategory; label: string }> = [
  { key: "all", label: "全部" },
  { key: "finance", label: "财务" },
  { key: "report", label: "报告" },
  { key: "review", label: "审查" },
  { key: "knowledge", label: "知识" },
  { key: "meeting", label: "会议" },
  { key: "product", label: "产品" },
];

interface HistoryRecord {
  id: string;
  templateId: string;
  templateName: string;
  parameters: Record<string, string>;
  result: string;
  executedAt: string; // ISO
  mock?: boolean;
}

const HISTORY_KEY = "lynnhub:distill-history";
const HISTORY_LIMIT = 5;
const FAVORITES_KEY = "lynnhub:distill-favorites";
const RECENT_KEY = "lynnhub:distill-recent";
const RECENT_LIMIT = 5;

export default function AIWorkspacePage() {
  const [selected, setSelected] = useState<DistillTemplate | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultMock, setResultMock] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | DistillCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // 加载历史记录、收藏、最近使用
  useEffect(() => {
    try {
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      if (rawHistory) {
        setHistory(JSON.parse(rawHistory) as HistoryRecord[]);
      }
      const rawFav = localStorage.getItem(FAVORITES_KEY);
      if (rawFav) {
        setFavorites(JSON.parse(rawFav) as string[]);
      }
      const rawRecent = localStorage.getItem(RECENT_KEY);
      if (rawRecent) {
        setRecentIds(JSON.parse(rawRecent) as string[]);
      }
    } catch {
      // ignore
    }
  }, []);

  // 过滤 + 搜索
  const filteredTemplates = useMemo(() => {
    let list = DISTILL_TEMPLATES;
    if (categoryFilter !== "all") {
      list = list.filter((t) => t.category === categoryFilter);
    }
    if (showFavoritesOnly) {
      list = list.filter((t) => favorites.includes(t.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [categoryFilter, showFavoritesOnly, favorites, searchQuery]);

  // 收藏的模板
  const favoriteTemplates = useMemo(
    () => DISTILL_TEMPLATES.filter((t) => favorites.includes(t.id)),
    [favorites]
  );

  // 最近使用的模板
  const recentTemplates = useMemo(() => {
    return recentIds
      .map((id) => DISTILL_TEMPLATES.find((t) => t.id === id))
      .filter((t): t is DistillTemplate => Boolean(t));
  }, [recentIds]);

  // 切换收藏
  const toggleFavorite = useCallback((templateId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const openTemplate = (template: DistillTemplate) => {
    setSelected(template);
    // 用 defaultValue 初始化参数
    const init: Record<string, string> = {};
    for (const p of template.parameters) {
      init[p.key] = p.defaultValue ?? "";
    }
    setParams(init);
    setResult(null);
    setResultMock(false);

    // 记录最近使用
    setRecentIds((prev) => {
      const next = [template.id, ...prev.filter((id) => id !== template.id)].slice(0, RECENT_LIMIT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const closeModal = () => {
    setSelected(null);
    setParams({});
    setResult(null);
    setResultMock(false);
    setExecuting(false);
  };

  const execute = async () => {
    if (!selected) return;

    // 校验必填
    for (const p of selected.parameters) {
      if (p.required && !params[p.key]?.trim()) {
        toast(`请填写 ${p.label}`, "error");
        return;
      }
    }

    setExecuting(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selected.id,
          parameters: params,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "执行失败", "error");
        return;
      }
      setResult(data.result);
      setResultMock(Boolean(data.fallback));
      toast("蒸馏完成", "success");

      // 写入历史
      const record: HistoryRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        templateId: selected.id,
        templateName: selected.name,
        parameters: { ...params },
        result: data.result,
        executedAt: new Date().toISOString(),
        mock: Boolean(data.mock),
      };
      const next = [record, ...history].slice(0, HISTORY_LIMIT);
      setHistory(next);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setExecuting(false);
    }
  };

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
    toast("已清空历史", "info");
  }, []);

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="AI 工作空间"
        subtitle="将重复性 AI 协同工作固化为参数化模板，一键启动蒸馏流程"
      />

      {/* 快速入口 */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLink
          href="/ai/flows"
          icon={Workflow}
          title="AI 工作流"
          desc="编排多步骤 AI 任务链"
          color="text-cognition"
        />
        <QuickLink
          href="/ai/assistant"
          icon={Bot}
          title="AI 专属助理"
          desc="对话式个人助手"
          color="text-cognition"
        />
        <QuickLink
          href="/memory"
          icon={Sparkles}
          title="记忆图谱"
          desc="AI 记忆与知识关联"
          color="text-northstar"
        />
      </div>

      {/* 蒸馏模板 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
          <LayoutGrid className="h-4 w-4" />
          蒸馏模板
        </div>
        <div className="flex items-center gap-2">
          {/* 收藏筛选 */}
          <button
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors",
              showFavoritesOnly
                ? "border-northstar bg-northstar/10 text-northstar"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <Star className={cn("h-3 w-3", showFavoritesOnly && "fill-current")} />
            收藏
          </button>
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模板..."
              className="w-32 rounded-lg border border-border bg-background py-1 pl-7 pr-2 text-[11px] outline-none transition-colors focus:border-cognition/40 sm:w-48"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setCategoryFilter(f.key)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
              categoryFilter === f.key
                ? "bg-cognition text-white"
                : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 收藏区（当未筛选收藏且收藏列表非空时显示） */}
      {!showFavoritesOnly && favoriteTemplates.length > 0 && categoryFilter === "all" && !searchQuery && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-northstar">
            <Star className="h-3 w-3 fill-current" />
            收藏模板
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {favoriteTemplates.map((tpl) => (
              <CompactTemplateCard
                key={tpl.id}
                template={tpl}
                isFavorite={true}
                onOpen={() => openTemplate(tpl)}
                onToggleFavorite={() => toggleFavorite(tpl.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 最近使用 */}
      {!showFavoritesOnly && recentTemplates.length > 0 && categoryFilter === "all" && !searchQuery && (
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <History className="h-3 w-3" />
            最近使用
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {recentTemplates.map((tpl) => (
              <CompactTemplateCard
                key={tpl.id}
                template={tpl}
                isFavorite={favorites.includes(tpl.id)}
                onOpen={() => openTemplate(tpl)}
                onToggleFavorite={() => toggleFavorite(tpl.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 全部模板（紧凑网格） */}
      {filteredTemplates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-xs text-muted-foreground">
          {searchQuery ? "未找到匹配的模板" : "暂无模板"}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredTemplates.map((tpl) => (
            <CompactTemplateCard
              key={tpl.id}
              template={tpl}
              isFavorite={favorites.includes(tpl.id)}
              onOpen={() => openTemplate(tpl)}
              onToggleFavorite={() => toggleFavorite(tpl.id)}
            />
          ))}
        </div>
      )}

      {/* 执行历史 */}
      <div className="mb-4 mt-8 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
          <History className="h-4 w-4" />
          最近执行
        </div>
        {history.length > 0 && (
          <Button size="sm" variant="ghost" onClick={clearHistory}>
            <RotateCcw className="h-3 w-3" /> 清空
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-xs text-muted-foreground">
          暂无执行记录，点击上方模板开始
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <Card key={h.id} className="!p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-medium">{h.templateName}</span>
                    {h.mock && (
                      <Badge color="default">未配置 Key</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(h.executedAt)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {h.result}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const tpl = DISTILL_TEMPLATES.find(
                      (t) => t.id === h.templateId
                    );
                    if (tpl) {
                      openTemplate(tpl);
                      setParams({ ...h.parameters });
                    }
                  }}
                >
                  重跑 <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 参数配置 / 结果弹窗 */}
      {selected && (
        <DistillModal
          template={selected}
          params={params}
          setParams={setParams}
          executing={executing}
          result={result}
          resultMock={resultMock}
          onExecute={execute}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
  color,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </a>
  );
}

// 紧凑模板卡片
function CompactTemplateCard({
  template,
  isFavorite,
  onOpen,
  onToggleFavorite,
}: {
  template: DistillTemplate;
  isFavorite: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const Icon = ICON_MAP[template.icon] ?? Sparkles;
  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* 收藏按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={cn(
          "absolute right-2 top-2 rounded-md p-1 transition-colors",
          isFavorite
            ? "text-northstar"
            : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-northstar"
        )}
        aria-label="收藏"
      >
        <Star className={cn("h-3 w-3", isFavorite && "fill-current")} />
      </button>

      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
          <Icon className="h-3.5 w-3.5 text-foreground/80" />
        </div>
        <Badge color={CATEGORY_COLOR[template.category]}>
          {CATEGORY_LABEL[template.category]}
        </Badge>
      </div>
      <h3 className="mb-0.5 text-xs font-medium">{template.name}</h3>
      <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
        {template.description}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">
          {template.parameters.length} 参数
        </span>
        <span className="flex items-center gap-0.5 text-[9px] text-cognition opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-2.5 w-2.5" /> 执行
        </span>
      </div>
    </div>
  );
}

function DistillModal({
  template,
  params,
  setParams,
  executing,
  result,
  resultMock,
  onExecute,
  onClose,
}: {
  template: DistillTemplate;
  params: Record<string, string>;
  setParams: (p: Record<string, string>) => void;
  executing: boolean;
  result: string | null;
  resultMock: boolean;
  onExecute: () => void;
  onClose: () => void;
}) {
  const Icon = ICON_MAP[template.icon] ?? Sparkles;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[8vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="max-h-[84vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl transition-all animate-in zoom-in-95 duration-200 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{template.name}</h2>
              <p className="text-[11px] text-muted-foreground">
                {template.description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 步骤指示 */}
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {template.steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground">
                <span className="text-foreground/40">{i + 1}</span>
                {s}
              </span>
              {i < template.steps.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
              )}
            </div>
          ))}
        </div>

        {/* 参数表单 */}
        <div className="space-y-4">
          {template.parameters.map((p) => (
            <div key={p.key}>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                {p.label}
                {p.required && (
                  <span className="text-graveyard">*</span>
                )}
              </label>
              {p.type === "textarea" ? (
                <textarea
                  value={params[p.key] ?? ""}
                  onChange={(e) =>
                    setParams({ ...params, [p.key]: e.target.value })
                  }
                  placeholder={p.placeholder}
                  rows={5}
                  className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
                />
              ) : p.type === "select" ? (
                <select
                  value={params[p.key] ?? ""}
                  onChange={(e) =>
                    setParams({ ...params, [p.key]: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
                >
                  {(p.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={p.type === "number" ? "number" : p.type === "date" ? "date" : "text"}
                  value={params[p.key] ?? ""}
                  onChange={(e) =>
                    setParams({ ...params, [p.key]: e.target.value })
                  }
                  placeholder={p.placeholder}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
                />
              )}
            </div>
          ))}
        </div>

        {/* 执行按钮 */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground">
            点击执行将调用 AI 填充模板并生成结果
          </span>
          <Button onClick={onExecute} disabled={executing}>
            {executing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 执行中...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> 执行蒸馏
              </>
            )}
          </Button>
        </div>

        {/* 结果 */}
        {result !== null && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground/80">
              <CheckCircle2 className="h-3.5 w-3.5 text-task" />
              蒸馏结果
              {resultMock && (
                <Badge color="default">未配置 Key</Badge>
              )}
            </div>
            <pre className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-foreground/90">
              {result}
            </pre>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(result);
                  toast("已复制到剪贴板", "success");
                }}
              >
                复制
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

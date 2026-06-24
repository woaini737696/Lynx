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
  Plus,
  Edit3,
  Trash2,
} from "lucide-react";
import { PageHeader, Card, Button, Badge } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  DISTILL_TEMPLATES,
  type DistillTemplate,
  type DistillCategory,
  type DistillParameter,
  type DistillParamType,
} from "@/lib/distill-templates";

// 工作空间模板类型：内置模板 + 自定义模板的合并类型
type WorkspaceTemplate = DistillTemplate & {
  _custom?: boolean;
  _skillId?: string;
};

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
  const [selected, setSelected] = useState<WorkspaceTemplate | null>(null);
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
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);

  // 加载自定义蒸馏模板
  const fetchCustomTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/distill/templates");
      const data = await res.json();
      if (data.customs) setCustomTemplates(data.customs);
    } catch {
      // ignore
    }
  }, []);

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
    fetchCustomTemplates();
  }, [fetchCustomTemplates]);

  // 合并内置模板和自定义模板
  const allTemplates = useMemo<WorkspaceTemplate[]>(() => {
    const customsAsTemplates: WorkspaceTemplate[] = customTemplates.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon || "Sparkles",
      category: c.category as DistillCategory,
      parameters: (c.parameters || []) as DistillParameter[],
      promptTemplate: c.promptTemplate,
      steps: [],
      _custom: true,
      _skillId: c.id,
    }));
    return [...DISTILL_TEMPLATES, ...customsAsTemplates];
  }, [customTemplates]);

  // 过滤 + 搜索
  const filteredTemplates = useMemo(() => {
    let list: WorkspaceTemplate[] = allTemplates;
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
  }, [allTemplates, categoryFilter, showFavoritesOnly, favorites, searchQuery]);

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

  const openTemplate = (template: WorkspaceTemplate) => {
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

  // 删除自定义模板
  const deleteTemplate = async (id: string) => {
    if (!confirm("确定删除此自定义模板？")) return;
    try {
      const res = await fetch(`/api/ai/distill/templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast("已删除", "success");
        fetchCustomTemplates();
      } else {
        const err = await res.json().catch(() => ({}));
        toast(err.error || "删除失败", "error");
      }
    } catch (e) {
      toast("删除失败：" + (e as Error).message, "error");
    }
  };

  // 打开模板编辑器（新建或编辑）
  const openTemplateEditor = (template: WorkspaceTemplate | null) => {
    setEditingTemplate(template);
    setShowTemplateEditor(true);
  };

  // 关闭模板编辑器
  const closeTemplateEditor = () => {
    setShowTemplateEditor(false);
    setEditingTemplate(null);
  };

  // 保存模板后回调
  const onTemplateSaved = () => {
    fetchCustomTemplates();
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="AI 工作空间"
        subtitle="将重复性 AI 协同工作固化为参数化模板，一键启动蒸馏流程"
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openTemplateEditor(null)}
            >
              <Plus className="h-3.5 w-3.5" /> 新建模板
            </Button>
            <HelpButton content={{
              painPoint: "重复性AI任务（周报、代码审查、会议纪要）每次都要重新写prompt。",
              need: "需要预设模板，填参数即可执行，结果可复用。",
              solution: "AI工作空间提供7个蒸馏模板（财务预测/周报/代码审查/知识蒸馏/会议纪要/PRD/竞品分析），填参数一键执行。支持创建自定义模板。",
              usage: [
                "选择模板",
                "填写参数",
                "点击执行",
                "查看结果可复制",
                "执行历史可重跑",
                "点击「新建模板」创建自定义模板"
              ]
            }} />
          </div>
        }
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
              onEdit={
                tpl._custom
                  ? () => openTemplateEditor(tpl)
                  : undefined
              }
              onDelete={
                tpl._custom
                  ? () => deleteTemplate(tpl._skillId || tpl.id)
                  : undefined
              }
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

      {/* 模板编辑器（新建/编辑） */}
      {showTemplateEditor && (
        <TemplateEditor
          template={editingTemplate}
          onClose={closeTemplateEditor}
          onSave={onTemplateSaved}
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
  onEdit,
  onDelete,
}: {
  template: WorkspaceTemplate;
  isFavorite: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const Icon = ICON_MAP[template.icon] ?? Sparkles;
  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* 顶部右侧操作区 */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5">
        {/* 自定义模板：编辑/删除按钮 */}
        {template._custom && onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded-md p-1 text-muted-foreground/60 opacity-0 transition-colors hover:text-cognition group-hover:opacity-100"
            aria-label="编辑"
            title="编辑"
          >
            <Edit3 className="h-3 w-3" />
          </button>
        )}
        {template._custom && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-md p-1 text-muted-foreground/60 opacity-0 transition-colors hover:text-graveyard group-hover:opacity-100"
            aria-label="删除"
            title="删除"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
        {/* 收藏按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            "rounded-md p-1 transition-colors",
            isFavorite
              ? "text-northstar"
              : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-northstar"
          )}
          aria-label="收藏"
        >
          <Star className={cn("h-3 w-3", isFavorite && "fill-current")} />
        </button>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60">
          <Icon className="h-3.5 w-3.5 text-foreground/80" />
        </div>
        <Badge color={CATEGORY_COLOR[template.category]}>
          {CATEGORY_LABEL[template.category]}
        </Badge>
        {template._custom && (
          <span className="text-[9px] text-cognition">自定义</span>
        )}
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
  template: WorkspaceTemplate;
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

// ============ 模板编辑器（新建/编辑自定义蒸馏模板） ============

const PARAM_TYPE_OPTIONS: DistillParamType[] = [
  "text",
  "textarea",
  "select",
  "date",
  "number",
];

const PARAM_TYPE_LABEL: Record<DistillParamType, string> = {
  text: "单行文本",
  textarea: "多行文本",
  select: "下拉选择",
  date: "日期",
  number: "数字",
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

function TemplateEditor({
  template,
  onClose,
  onSave,
}: {
  template: any | null; // null 表示新建
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState<string>(template?.name || "");
  const [description, setDescription] = useState<string>(
    template?.description || ""
  );
  const [category, setCategory] = useState<DistillCategory>(
    (template?.category as DistillCategory) || "knowledge"
  );
  const [icon, setIcon] = useState<string>(template?.icon || "Sparkles");
  const [parameters, setParameters] = useState<DistillParameter[]>(
    (template?.parameters as DistillParameter[]) || []
  );
  const [promptTemplate, setPromptTemplate] = useState<string>(
    template?.promptTemplate || ""
  );
  const [steps, setSteps] = useState<string[]>(
    template?.steps && template.steps.length > 0 ? [...template.steps] : [""]
  );
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(template?._custom);

  const handleSave = async () => {
    if (!name.trim()) {
      toast("名称不能为空", "error");
      return;
    }
    if (!promptTemplate.trim()) {
      toast("提示词模板不能为空", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        category,
        icon,
        parameters: parameters.filter((p) => p.key && p.label),
        promptTemplate,
        steps: steps.filter((s) => s.trim()),
      };
      const url = isEdit
        ? `/api/ai/distill/templates/${template._skillId}`
        : "/api/ai/distill/templates";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "保存失败");
      }
      toast("模板已保存", "success");
      onSave();
      onClose();
    } catch (e) {
      toast("保存失败：" + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  // 参数操作
  const addParameter = () => {
    setParameters([
      ...parameters,
      {
        key: "",
        label: "",
        type: "text",
        required: false,
        placeholder: "",
        defaultValue: "",
      },
    ]);
  };

  const updateParameter = (index: number, patch: Partial<DistillParameter>) => {
    setParameters(
      parameters.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  };

  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  // 步骤操作
  const addStep = () => setSteps([...steps, ""]);
  const updateStep = (index: number, value: string) => {
    setSteps(steps.map((s, i) => (i === index ? value : s)));
  };
  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[6vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl transition-all animate-in zoom-in-95 duration-200 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {isEdit ? "编辑模板" : "新建模板"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isEdit ? "修改自定义蒸馏模板" : "创建自定义蒸馏模板，可填参数一键执行"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 名称 */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
              名称 <span className="text-graveyard">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：用户调研报告"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              描述
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要描述模板用途..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
            />
          </div>

          {/* 分类 + 图标 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">
                分类
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as DistillCategory)
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
              >
                {(Object.keys(CATEGORY_LABEL) as DistillCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">
                图标
              </label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
              >
                {ICON_OPTIONS.map((ic) => (
                  <option key={ic} value={ic}>
                    {ic}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 步骤 */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-foreground/80">
                步骤
              </label>
              <button
                onClick={addStep}
                className="flex items-center gap-0.5 text-[11px] text-cognition hover:underline"
              >
                <Plus className="h-3 w-3" /> 添加步骤
              </button>
            </div>
            <div className="space-y-1.5">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-5 shrink-0 text-[10px] text-muted-foreground">
                    {i + 1}.
                  </span>
                  <input
                    value={s}
                    onChange={(e) => updateStep(i, e.target.value)}
                    placeholder={`步骤 ${i + 1}`}
                    className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-1 focus:ring-cognition/20"
                  />
                  <button
                    onClick={() => removeStep(i)}
                    className="rounded-md p-1 text-muted-foreground hover:text-graveyard"
                    aria-label="删除步骤"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {steps.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  暂无步骤，点击上方添加
                </p>
              )}
            </div>
          </div>

          {/* 参数定义器 */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-foreground/80">
                参数定义
              </label>
              <button
                onClick={addParameter}
                className="flex items-center gap-0.5 text-[11px] text-cognition hover:underline"
              >
                <Plus className="h-3 w-3" /> 添加参数
              </button>
            </div>
            <div className="space-y-2">
              {parameters.map((p, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-muted/20 p-2.5"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">
                      参数 {i + 1}
                    </span>
                    <button
                      onClick={() => removeParameter(i)}
                      className="rounded-md p-0.5 text-muted-foreground hover:text-graveyard"
                      aria-label="删除参数"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      value={p.key}
                      onChange={(e) =>
                        updateParameter(i, { key: e.target.value })
                      }
                      placeholder="key（如：period）"
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] focus:border-cognition/40 focus:outline-none"
                    />
                    <input
                      value={p.label}
                      onChange={(e) =>
                        updateParameter(i, { label: e.target.value })
                      }
                      placeholder="label（如：预测周期）"
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] focus:border-cognition/40 focus:outline-none"
                    />
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    <select
                      value={p.type}
                      onChange={(e) =>
                        updateParameter(i, {
                          type: e.target.value as DistillParamType,
                        })
                      }
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] focus:border-cognition/40 focus:outline-none"
                    >
                      {PARAM_TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {PARAM_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <input
                      value={p.defaultValue || ""}
                      onChange={(e) =>
                        updateParameter(i, { defaultValue: e.target.value })
                      }
                      placeholder="默认值"
                      className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] focus:border-cognition/40 focus:outline-none"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={p.required}
                        onChange={(e) =>
                          updateParameter(i, { required: e.target.checked })
                        }
                        className="h-3 w-3"
                      />
                      必填
                    </label>
                  </div>
                  <input
                    value={p.placeholder || ""}
                    onChange={(e) =>
                      updateParameter(i, { placeholder: e.target.value })
                    }
                    placeholder="placeholder（输入提示）"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px] focus:border-cognition/40 focus:outline-none"
                  />
                  {p.type === "select" && (
                    <input
                      value={(p.options || []).join(", ")}
                      onChange={(e) =>
                        updateParameter(i, {
                          options: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="选项（用英文逗号分隔，如：A, B, C）"
                      className="mt-1.5 w-full rounded-lg border border-border bg-background px-2 py-1 text-[11px] focus:border-cognition/40 focus:outline-none"
                    />
                  )}
                </div>
              ))}
              {parameters.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  暂无参数，点击上方添加。参数可在提示词中用{" "}
                  {"{{key}}"} 引用。
                </p>
              )}
            </div>
          </div>

          {/* 提示词模板 */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
              提示词模板 <span className="text-graveyard">*</span>
            </label>
            <p className="mb-1.5 text-[10px] text-muted-foreground">
              用 {"{{paramKey}}"} 引用参数，如 {"{{period}}"}
            </p>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder={`你是一个专家。请基于以下信息生成报告：\n\n周期：{{period}}\n内容：{{content}}\n\n请输出：1.总结 2.分析 3.建议`}
              rows={8}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
            />
          </div>
        </div>

        {/* 底部操作 */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 保存中...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> 保存
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

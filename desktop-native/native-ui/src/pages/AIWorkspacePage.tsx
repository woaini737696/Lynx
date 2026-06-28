import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  FileText,
  Code,
  Brain,
  Users,
  Package,
  Search,
  Star,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp,
  FileText,
  Code,
  Brain,
  Users,
  Package,
  Sparkles,
};

const CATEGORIES = [
  { key: "all", label: "全部" },
  { key: "finance", label: "财务" },
  { key: "report", label: "报告" },
  { key: "review", label: "审查" },
  { key: "knowledge", label: "知识" },
  { key: "meeting", label: "会议" },
  { key: "product", label: "产品" },
];

const CATEGORY_LABEL: Record<string, string> = {
  finance: "财务",
  report: "报告",
  review: "审查",
  knowledge: "知识",
  meeting: "会议",
  product: "产品",
};

interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  parameters: { key: string; label: string; defaultValue?: string; placeholder?: string }[];
}

export function AIWorkspacePage() {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<WorkspaceTemplate | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const { data: templates = [], isLoading } = useQuery<WorkspaceTemplate[]>({
    queryKey: ["ai-workspace-templates"],
    queryFn: async () => {
      const res = await cloudApi.get<{ customs?: WorkspaceTemplate[]; builtIns?: WorkspaceTemplate[] }>(
        "/api/ai/distill/templates"
      );
      return [...(res.builtIns || []), ...(res.customs || [])];
    },
  });

  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (categoryFilter !== "all") {
      list = list.filter((t) => t.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [templates, categoryFilter, searchQuery]);

  const openTemplate = (template: WorkspaceTemplate) => {
    setSelected(template);
    const init: Record<string, string> = {};
    for (const p of template.parameters) {
      init[p.key] = p.defaultValue ?? "";
    }
    setParams(init);
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // 运行模板：构建提示词并跳转到 Lynx超级助理执行
  const handleRun = async () => {
    if (!selected) return;
    setRunning(true);
    try {
      const parts: string[] = [`请使用「${selected.name}」模板执行任务。`];
      if (selected.description) {
        parts.push(`模板说明：${selected.description}`);
      }
      const filledParams = selected.parameters
        .map((p) => ({ label: p.label, value: (params[p.key] || "").trim() }))
        .filter((p) => p.value);
      if (filledParams.length > 0) {
        parts.push("参数：");
        for (const p of filledParams) {
          parts.push(`- ${p.label}：${p.value}`);
        }
      }
      parts.push("请根据以上信息生成完整结果。");
      const prompt = parts.join("\n");
      setSelected(null);
      toast.success("已发送到 Lynx超级助理");
      navigate("/ai/assistant", { state: { initialPrompt: prompt } });
    } finally {
      setRunning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p>加载 AI 工作空间...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AI 工作空间</h1>
            <p className="mt-1 text-sm text-muted-foreground">预置蒸馏模板 + 自定义工作流，一键运行</p>
          </div>
          <HelpButton module="ai-workspace" />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索模板..."
            className="h-10 w-full rounded-xl border border-border/60 bg-card/50 pl-9 pr-4 text-sm outline-none focus:border-primary/50 sm:w-64"
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategoryFilter(cat.key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              categoryFilter === cat.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template, idx) => {
          const Icon = ICON_MAP[template.icon] || Sparkles;
          const isFavorite = favorites.includes(template.id);
          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card group relative flex flex-col p-5"
            >
              <div className="mb-3 flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <button
                  onClick={() => toggleFavorite(template.id)}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    isFavorite ? "text-amber-400" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
                </button>
              </div>
              <h3 className="text-base font-semibold text-foreground">{template.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {CATEGORY_LABEL[template.category] || template.category}
                </span>
              </div>
              <button
                onClick={() => openTemplate(template)}
                className="btn-primary-glass mt-4 flex items-center justify-center gap-2 py-2 text-sm"
              >
                <Play className="h-4 w-4" /> 运行
              </button>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="ios-glass w-full max-w-lg overflow-hidden p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-border/60 px-5 py-4">
                <h3 className="text-lg font-semibold text-foreground">{selected.name}</h3>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              </div>
              <div className="flex max-h-[50vh] flex-col gap-4 overflow-auto p-5">
                {selected.parameters.map((p) => (
                  <div key={p.key} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">{p.label}</label>
                    <input
                      value={params[p.key] || ""}
                      onChange={(e) => setParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
                      placeholder={p.placeholder}
                      className="h-10 rounded-xl border border-border/60 bg-card/50 px-3 text-sm outline-none focus:border-primary/50"
                    />
                  </div>
                ))}
                {selected.parameters.length === 0 && (
                  <p className="text-sm text-muted-foreground">该模板无需参数，点击运行即可。</p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-border/60 px-5 py-4">
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  取消
                </button>
                <button
                  onClick={handleRun}
                  disabled={running}
                  className="btn-primary-glass flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm disabled:opacity-50"
                >
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  运行
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

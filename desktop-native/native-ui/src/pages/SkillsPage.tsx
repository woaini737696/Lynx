// 技能管理页面（对齐 Web 端 /api/skills）
// 支持技能 CRUD + 分类筛选 + 执行 + 导出
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  Plus,
  Edit3,
  Trash2,
  Play,
  X,
  Loader2,
  Download,
  Tag,
  Save,
  Store,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import { cloudApi } from "@/lib/cloud-api";

// ============ 类型定义 ============

interface SkillParameter {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  parameters: SkillParameter[];
  promptTemplate: string;
  source: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// 12 岗位分类 + 通用
const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "all", label: "全部" },
  { key: "pm", label: "产品" },
  { key: "designer", label: "设计" },
  { key: "frontend", label: "前端" },
  { key: "backend", label: "后端" },
  { key: "data", label: "数据" },
  { key: "operations", label: "运营" },
  { key: "marketing", label: "市场" },
  { key: "hr", label: "HR" },
  { key: "finance", label: "财务" },
  { key: "project", label: "项目" },
  { key: "creator", label: "创作者" },
  { key: "founder", label: "创始人" },
  { key: "custom", label: "自定义" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label])
);

export function SkillsPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [editingSkill, setEditingSkill] = useState<Partial<Skill> | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [execResult, setExecResult] = useState<{ skillName: string; success: boolean; output: string; error?: string } | null>(null);

  // 加载技能列表
  const { data: skills = [], isLoading } = useQuery<Skill[]>({
    queryKey: ["skills", category],
    queryFn: async () => {
      const params = category !== "all" ? `?category=${category}&limit=100` : "?limit=100";
      const resp = await cloudApi.get<{ data: Skill[]; items?: Skill[] } | Skill[]>(
        `/api/skills${params}`
      );
      // 兼容两种响应格式
      const list = Array.isArray(resp) ? resp : (resp.data || resp.items || []);
      // 防御性规范化：确保 tags / parameters 均为数组，避免后端返回 null/字符串导致 .slice 崩溃
      return list.map((s) => ({
        ...s,
        tags: Array.isArray(s.tags) ? s.tags : [],
        parameters: Array.isArray(s.parameters) ? s.parameters : [],
      }));
    },
  });

  // 过滤搜索
  const filteredSkills = skills.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const tags = Array.isArray(s.tags) ? s.tags : [];
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleCreate = () => {
    setEditingSkill({
      name: "",
      description: "",
      category: "custom",
      content: "",
      parameters: [],
      promptTemplate: "",
      tags: [],
    });
    setShowEditor(true);
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill({ ...skill });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!editingSkill) return;
    if (!editingSkill.name?.trim()) {
      toast.error("请输入技能名称");
      return;
    }
    if (!editingSkill.description?.trim()) {
      toast.error("请输入技能描述");
      return;
    }
    try {
      const payload = {
        name: editingSkill.name.trim(),
        description: editingSkill.description.trim(),
        category: editingSkill.category || "custom",
        content: editingSkill.content || "",
        parameters: editingSkill.parameters || [],
        promptTemplate: editingSkill.promptTemplate || "",
        tags: editingSkill.tags || [],
      };
      if (editingSkill.id) {
        await cloudApi.patch(`/api/skills/${editingSkill.id}`, payload);
        toast.success("技能已更新");
      } else {
        await cloudApi.post("/api/skills", payload);
        toast.success("技能已创建");
      }
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      setShowEditor(false);
      setEditingSkill(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    }
  };

  const handleDelete = async (skill: Skill) => {
    setDeleteTarget(skill);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await cloudApi.delete(`/api/skills/${deleteTarget.id}`);
      toast.success("已删除");
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleExecute = async (skill: Skill) => {
    setExecuting(skill.id);
    try {
      const resp = await cloudApi.post<{ output?: string; message?: string; error?: string; success?: boolean }>(
        `/api/skills/${skill.id}/execute`,
        { input: "" }
      );
      const success = resp.success !== false;
      setExecResult({
        skillName: skill.name,
        success,
        output: resp.output || "",
        error: resp.error,
      });
      if (success) {
        toast.success(resp.message || "技能执行完成");
      } else {
        toast.error(resp.error || "技能执行失败");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setExecResult({
        skillName: skill.name,
        success: false,
        output: "",
        error: msg || "技能执行失败",
      });
      toast.error(msg || "技能执行失败");
    } finally {
      setExecuting(null);
    }
  };

  const handleExport = async (skill: Skill) => {
    try {
      // 通过 export=1 参数获取 Markdown
      const resp = await cloudApi.get<string>(`/api/skills/${skill.id}?export=1`);
      const blob = new Blob([resp], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${skill.name.replace(/[\\/:*?"<>|]/g, "_")}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("已导出为 Markdown");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导出失败");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      {/* 页头 */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Wrench className="h-6 w-6 text-primary" />
            技能管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI 技能模板 · 12 岗位分类 · 可复用提示词
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMarketplace(true)}
            className="btn-glass flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm"
          >
            <Store className="h-4 w-4" />
            市场
          </button>
          <button
            onClick={handleCreate}
            className="btn-primary-glass flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm"
          >
            <Plus className="h-4 w-4" />
            新建技能
          </button>
          <HelpButton module="skills" />
        </div>
      </div>

      {/* 搜索框 */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索技能名称、描述或标签..."
          className="h-10 w-full rounded-xl border border-border/60 bg-background/40 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* 分类筛选 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              category === cat.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 技能列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 py-16">
          <Wrench className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {search ? "没有匹配的技能" : "还没有技能，点击「新建技能」开始"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSkills.map((skill) => (
            <motion.div
              key={skill.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card flex flex-col gap-2 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{skill.name}</h3>
                  <span className="mt-0.5 inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {CATEGORY_LABELS[skill.category] || skill.category}
                  </span>
                </div>
                {skill.usageCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    使用 {skill.usageCount} 次
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {skill.description}
              </p>
              {/* 标签 */}
              {skill.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {skill.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-0.5 rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {tag}
                    </span>
                  ))}
                  {skill.tags.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{skill.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
              {/* 参数数量 */}
              {skill.parameters.length > 0 && (
                <div className="text-[10px] text-muted-foreground">
                  {skill.parameters.length} 个参数
                </div>
              )}
              {/* 操作按钮 */}
              <div className="flex items-center gap-1.5 border-t border-border/40 pt-2">
                <button
                  onClick={() => handleExecute(skill)}
                  disabled={executing === skill.id}
                  className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-primary/10 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                >
                  {executing === skill.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  执行
                </button>
                <button
                  onClick={() => handleEdit(skill)}
                  title="编辑"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleExport(skill)}
                  title="导出"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                  <Download className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDelete(skill)}
                  title="删除"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 编辑器弹窗 */}
      <SkillEditor
        skill={editingSkill}
        open={showEditor}
        onClose={() => {
          setShowEditor(false);
          setEditingSkill(null);
        }}
        onChange={setEditingSkill}
        onSave={handleSave}
      />

      {/* 技能市场弹窗 */}
      <MarketplaceModal open={showMarketplace} onClose={() => setShowMarketplace(false)} />

      {/* 执行结果弹窗 */}
      <Modal
        open={!!execResult}
        onClose={() => setExecResult(null)}
        title="技能执行结果"
        size="md"
      >
        {execResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {execResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-task" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <span className={cn("text-sm font-semibold", execResult.success ? "text-task" : "text-destructive")}>
                {execResult.success ? "执行成功" : "执行失败"} · {execResult.skillName}
              </span>
            </div>
            {execResult.error && !execResult.output && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {execResult.error}
              </div>
            )}
            {execResult.output && (
              <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">执行输出：</div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-foreground/80">
                  {execResult.output}
                </pre>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-border/40 pt-3">
              <button
                onClick={() => setExecResult(null)}
                className="btn-primary-glass flex h-8 items-center px-4 text-xs"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="确认删除"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            确定删除技能「<span className="font-medium text-foreground">{deleteTarget?.name}</span>」？此操作不可撤销。
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted/50"
            >
              取消
            </button>
            <button
              onClick={confirmDelete}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600"
            >
              删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============ 技能编辑器 ============

function SkillEditor({
  skill,
  open,
  onClose,
  onChange,
  onSave,
}: {
  skill: Partial<Skill> | null;
  open: boolean;
  onClose: () => void;
  onChange: (skill: Partial<Skill>) => void;
  onSave: () => void;
}) {
  if (!skill) return null;

  const update = <K extends keyof Skill>(key: K, value: Skill[K]) => {
    onChange({ ...skill, [key]: value });
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || (skill.tags || []).includes(t)) return;
    update("tags", [...(skill.tags || []), t]);
  };

  const removeTag = (tag: string) => {
    update("tags", (skill.tags || []).filter((t) => t !== tag));
  };

  return (
    <Modal open={open} onClose={onClose} title={skill.id ? "编辑技能" : "新建技能"} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-foreground">名称</label>
            <input
              type="text"
              value={skill.name || ""}
              onChange={(e) => update("name", e.target.value)}
              placeholder="例如：周报生成器"
              className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">分类</label>
            <select
              value={skill.category || "custom"}
              onChange={(e) => update("category", e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              {CATEGORIES.filter((c) => c.key !== "all").map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">描述</label>
          <input
            type="text"
            value={skill.description || ""}
            onChange={(e) => update("description", e.target.value)}
            placeholder="简要描述技能用途"
            className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">标签</label>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {(skill.tags || []).map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder="输入标签后按 Enter"
              className="h-7 flex-1 min-w-[120px] rounded-md border border-border/60 bg-background/40 px-2 text-xs outline-none focus:ring-1 focus:ring-primary/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = "";
                }
              }}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">提示词模板</label>
          <textarea
            value={skill.promptTemplate || ""}
            onChange={(e) => update("promptTemplate", e.target.value)}
            placeholder={"例如：请根据以下输入生成周报：\n{{input}}\n\n要求：\n1. 总结本周完成事项\n2. 列出下周计划"}
            rows={5}
            className="mt-1 w-full resize-none rounded-lg border border-border/60 bg-background/40 p-3 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            支持 <code className="rounded bg-muted/50 px-1">{"{{参数名}}"}</code> 占位符
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">内容（Markdown）</label>
          <textarea
            value={skill.content || ""}
            onChange={(e) => update("content", e.target.value)}
            placeholder="技能的详细说明、使用场景、注意事项等..."
            rows={4}
            className="mt-1 w-full resize-none rounded-lg border border-border/60 bg-background/40 p-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-4">
          <button onClick={onClose} className="btn-glass flex h-9 items-center px-4 text-sm">
            取消
          </button>
          <button
            onClick={onSave}
            className="btn-primary-glass flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm"
          >
            <Save className="h-4 w-4" />
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============ 技能市场弹窗 ============

function MarketplaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [marketplaceSkills, setMarketplaceSkills] = useState<Array<{ id: string; name: string; description: string; category: string; tags?: string[]; downloads?: number }>>([]);

  const loadMarketplace = async () => {
    setLoading(true);
    try {
      const resp = await cloudApi.get<{ data: typeof marketplaceSkills; items?: typeof marketplaceSkills } | typeof marketplaceSkills>(
        "/api/skills/marketplace?limit=50"
      );
      if (Array.isArray(resp)) {
        setMarketplaceSkills(resp);
      } else {
        setMarketplaceSkills(resp.data || resp.items || []);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载市场失败");
    } finally {
      setLoading(false);
    }
  };

  // 打开时加载
  useEffect(() => {
    if (open) loadMarketplace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleLoad = async (publicId: string, name: string) => {
    try {
      await cloudApi.post(`/api/skills/marketplace/${publicId}/load`);
      toast.success(`已加载技能「${name}」`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载失败");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="技能市场" size="lg">
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : marketplaceSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <Store className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">市场暂无技能</p>
            <button onClick={loadMarketplace} className="btn-glass mt-2 h-8 px-3 text-xs">
              重新加载
            </button>
          </div>
        ) : (
          marketplaceSkills.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{s.name}</h4>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    {CATEGORY_LABELS[s.category] || s.category}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                {s.tags && s.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.tags.slice(0, 4).map((t) => (
                      <span key={t} className="rounded bg-muted/50 px-1 py-0.5 text-[10px] text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleLoad(s.id, s.name)}
                className="btn-primary-glass h-8 shrink-0 rounded-lg px-3 text-xs"
              >
                加载
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}

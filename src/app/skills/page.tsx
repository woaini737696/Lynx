"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Wrench,
  Plus,
  Upload,
  Download,
  Edit3,
  Trash2,
  Play,
  X,
  Loader2,
  Sparkles,
  Bot,
  MessageSquare,
  FileText,
  Tag,
  Copy,
  Check,
  Send,
  History,
  RotateCcw,
  GitCompare,
  Eye,
  AlertTriangle,
  Store,
  Lightbulb,
  Palette,
  Code,
  Server,
  BarChart3,
  Activity,
  Megaphone,
  Users,
  DollarSign,
  ClipboardList,
  PenTool,
  Rocket,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  LoadingState,
} from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { EmptyState } from "@/components/layout/EmptyState";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { SearchInput, Pagination, useClientPagination } from "@/components/ui/ListControls";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import type {
  SkillParameter,
  SkillParamType,
} from "@/lib/skill-parser";

// ============ 类型定义 ============

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
  isPublic?: boolean;
  publicId?: string | null;
}

interface SkillVersionSummary {
  id: string;
  skillId: string;
  version: number;
  name: string;
  description: string;
  category: string;
  tags: string[];
  createdAt: string;
}

// 版本详情（含完整字段，用于 Diff 对比）
interface SkillVersionDetail {
  id: string;
  skillId: string;
  version: number;
  name: string;
  description: string;
  category: string;
  content: string;
  promptTemplate: string;
  parameters: SkillParameter[];
  tags: string[];
  createdAt: string;
}

// Diff 行类型
type DiffLineType = "equal" | "added" | "removed" | "modified";

// Diff 单行结果
interface DiffLine {
  type: DiffLineType;
  oldNumber: number | null;
  newNumber: number | null;
  oldContent: string;
  newContent: string;
}

// Diff 完整结果（含统计信息）
interface DiffResult {
  lines: DiffLine[];
  stats: {
    added: number;
    removed: number;
    modified: number;
  };
}

// 可对比的字段
type DiffField = "content" | "promptTemplate" | "description" | "parameters";

type ModalMode = "create" | "edit" | "import" | "ai" | null;
type EditTab = "edit" | "versions";

const CATEGORIES = [
  { key: "all", label: "全部", icon: Tag },
  { key: "pm", label: "产品经理", icon: Lightbulb },
  { key: "designer", label: "设计师", icon: Palette },
  { key: "frontend", label: "前端工程师", icon: Code },
  { key: "backend", label: "后端工程师", icon: Server },
  { key: "data", label: "数据分析师", icon: BarChart3 },
  { key: "operations", label: "运营", icon: Activity },
  { key: "marketing", label: "市场", icon: Megaphone },
  { key: "hr", label: "HR", icon: Users },
  { key: "finance", label: "财务", icon: DollarSign },
  { key: "project", label: "项目经理", icon: ClipboardList },
  { key: "creator", label: "内容创作者", icon: PenTool },
  { key: "founder", label: "创业者", icon: Rocket },
  { key: "hermes", label: "Hermes", icon: Bot },
  { key: "custom", label: "自定义", icon: Wrench },
];

const CATEGORY_BADGE: Record<string, "task" | "cognition" | "northstar" | "campaign" | "graveyard" | "default"> = {
  // 12 岗位分类
  pm: "northstar",
  designer: "campaign",
  frontend: "task",
  backend: "cognition",
  data: "northstar",
  operations: "campaign",
  marketing: "task",
  hr: "cognition",
  finance: "northstar",
  project: "campaign",
  creator: "task",
  founder: "cognition",
  // 保留分类
  hermes: "cognition",
  custom: "default",
  // 旧分类（向后兼容显示）
  general: "default",
  report: "task",
  review: "cognition",
  knowledge: "campaign",
  meeting: "task",
  product: "campaign",
};

const CATEGORY_LABEL: Record<string, string> = {
  // 12 岗位分类
  pm: "产品经理",
  designer: "设计师",
  frontend: "前端工程师",
  backend: "后端工程师",
  data: "数据分析师",
  operations: "运营",
  marketing: "市场",
  hr: "HR",
  finance: "财务",
  project: "项目经理",
  creator: "内容创作者",
  founder: "创业者",
  // 保留分类
  hermes: "Hermes",
  custom: "自定义",
  // 旧分类（向后兼容显示，避免旧数据显示原始 key）
  general: "通用",
  report: "报告",
  review: "审查",
  knowledge: "知识",
  meeting: "会议",
  product: "产品",
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "手动",
  imported: "导入",
  "ai-generated": "AI 生成",
  "hermes-learned": "Hermes学习",
  "hermes-imported": "Hermes导入",
  marketplace: "广场",
};

const PARAM_TYPES: SkillParamType[] = [
  "text",
  "textarea",
  "select",
  "date",
  "number",
];

// ============ 行级 Diff 算法（基于 LCS 最长公共子序列） ============

function computeLcsDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  // 构建 LCS 动态规划表
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯生成原始 diff（equal / added / removed）
  const rawLines: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rawLines.unshift({
        type: "equal",
        oldNumber: i,
        newNumber: j,
        oldContent: oldLines[i - 1],
        newContent: newLines[j - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawLines.unshift({
        type: "added",
        oldNumber: null,
        newNumber: j,
        oldContent: "",
        newContent: newLines[j - 1],
      });
      j--;
    } else {
      rawLines.unshift({
        type: "removed",
        oldNumber: i,
        newNumber: null,
        oldContent: oldLines[i - 1],
        newContent: "",
      });
      i--;
    }
  }

  // 将相邻的 removed + added 配对为 modified，提升可读性
  const lines: DiffLine[] = [];
  let k = 0;
  while (k < rawLines.length) {
    if (rawLines[k].type === "removed") {
      // 收集连续的 removed 行
      const removedGroup: DiffLine[] = [];
      while (k < rawLines.length && rawLines[k].type === "removed") {
        removedGroup.push(rawLines[k]);
        k++;
      }
      // 收集紧随其后的 added 行
      const addedGroup: DiffLine[] = [];
      while (k < rawLines.length && rawLines[k].type === "added") {
        addedGroup.push(rawLines[k]);
        k++;
      }
      // 按顺序配对为 modified
      const pairCount = Math.min(removedGroup.length, addedGroup.length);
      for (let p = 0; p < pairCount; p++) {
        lines.push({
          type: "modified",
          oldNumber: removedGroup[p].oldNumber,
          newNumber: addedGroup[p].newNumber,
          oldContent: removedGroup[p].oldContent,
          newContent: addedGroup[p].newContent,
        });
      }
      // 剩余未配对的 removed
      for (let p = pairCount; p < removedGroup.length; p++) {
        lines.push(removedGroup[p]);
      }
      // 剩余未配对的 added
      for (let p = pairCount; p < addedGroup.length; p++) {
        lines.push(addedGroup[p]);
      }
    } else {
      lines.push(rawLines[k]);
      k++;
    }
  }

  // 统计变更行数
  const stats = {
    added: lines.filter((l) => l.type === "added").length,
    removed: lines.filter((l) => l.type === "removed").length,
    modified: lines.filter((l) => l.type === "modified").length,
  };

  return { lines, stats };
}

// ============ 主页面 ============

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [modal, setModal] = useState<ModalMode>(null);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/skills?category=${encodeURIComponent(activeCategory)}`
      );
      const data = await res.json();
      if (res.ok) {
        setSkills(data.skills || []);
      } else {
        toast(data.error || "加载失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // 前端搜索过滤（基于当前分类下的 skills）
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;
    const q = searchQuery.trim().toLowerCase();
    return skills.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
    );
  }, [skills, searchQuery]);

  const {
    page,
    pageSize,
    total,
    paginated,
    onPageChange,
    onPageSizeChange,
  } = useClientPagination(filteredSkills);

  // 分类切换时回到第 1 页
  useEffect(() => {
    onPageChange(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const openCreate = () => {
    setEditingSkill(null);
    setModal("create");
  };

  const openEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setModal("edit");
  };

  const openImport = () => {
    setModal("import");
  };

  const openAI = () => {
    setModal("ai");
  };

  const closeModal = () => {
    setModal(null);
    setEditingSkill(null);
  };

  const handleDelete = async (skill: Skill) => {
    if (!confirm(`确定删除「${skill.name}」？`)) return;
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast("已删除", "success");
        fetchSkills();
      } else {
        toast(data.error || "删除失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    }
  };

  const handleExport = async (skill: Skill) => {
    // 触发浏览器下载
    const url = `/api/skills/${skill.id}?export=1`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${skill.name}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("已开始下载", "success");
  };

  const handlePublish = async (skill: Skill) => {
    try {
      const res = await fetch(`/api/skills/${skill.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast("已发布到广场", "success");
        fetchSkills();
      } else {
        toast(data.error || "发布失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    }
  };

  const handleUnpublish = async (skill: Skill) => {
    if (!confirm(`确定从广场下架「${skill.name}」？`)) return;
    try {
      const res = await fetch(`/api/skills/${skill.id}/publish`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast("已下架", "success");
        fetchSkills();
      } else {
        toast(data.error || "下架失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    }
  };

  const handleUse = (skill: Skill) => {
    // 跳转到 AI 工作空间并传递 skill id（简化：直接提示）
    toast(`「${skill.name}」已就绪，可在 AI 工作空间使用`, "info");
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="技能管理"
        subtitle="可复用的 AI 技能模板：创建、导入、AI 生成、导出"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={openAI}>
              <Sparkles className="h-3.5 w-3.5" /> AI 生成
            </Button>
            <Button variant="outline" onClick={openImport}>
              <Upload className="h-3.5 w-3.5" /> 导入
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> 新建
            </Button>
            <HelpButton contentKey="skills" />
          </div>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 分类侧边栏 */}
        <aside className="lg:w-44 lg:shrink-0">
          <div className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              const count =
                cat.key === "all"
                  ? skills.length
                  : cat.key === "hermes"
                    ? skills.filter((s) => s.source === "hermes-learned" || s.source === "hermes-imported").length
                    : skills.filter((s) => s.category === cat.key).length;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={cn(
                    "group flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">{cat.label}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0 text-[10px]",
                        isActive
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Skill 卡片列表 */}
        <div className="min-w-0 flex-1">
          {loading ? (
            <LoadingState title="技能管理" />
          ) : skills.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="暂无技能"
              description="创建你的第一个技能模板，或从 Markdown 导入，也可让 AI 帮你生成"
              action={
                <div className="flex gap-2">
                  <Button onClick={openCreate}>
                    <Plus className="h-3.5 w-3.5" /> 新建技能
                  </Button>
                  <Button variant="outline" onClick={openAI}>
                    <Sparkles className="h-3.5 w-3.5" /> AI 生成
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <div className="mb-4">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="按名称或描述搜索..."
                />
              </div>
              {paginated.length === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="未匹配到结果"
                  description="尝试更换搜索关键词"
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {paginated.map((skill) => (
                      <SkillCard
                        key={skill.id}
                        skill={skill}
                        onEdit={() => openEdit(skill)}
                        onDelete={() => handleDelete(skill)}
                        onExport={() => handleExport(skill)}
                        onUse={() => handleUse(skill)}
                        onPublish={() => handlePublish(skill)}
                        onUnpublish={() => handleUnpublish(skill)}
                      />
                    ))}
                  </div>
                  <div className="mt-5">
                    <Pagination
                      page={page}
                      pageSize={pageSize}
                      total={total}
                      onPageChange={onPageChange}
                      onPageSizeChange={onPageSizeChange}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 弹窗 */}
      {modal === "create" || modal === "edit" ? (
        <SkillEditModal
          skill={editingSkill}
          onClose={closeModal}
          onSaved={() => {
            closeModal();
            fetchSkills();
          }}
        />
      ) : null}

      {modal === "import" ? (
        <ImportModal
          onClose={closeModal}
          onImported={() => {
            closeModal();
            fetchSkills();
          }}
        />
      ) : null}

      {modal === "ai" ? (
        <AIGenerateModal
          onClose={closeModal}
          onGenerated={() => {
            closeModal();
            fetchSkills();
          }}
        />
      ) : null}
    </div>
  );
}

// ============ Skill 卡片 ============

function SkillCard({
  skill,
  onEdit,
  onDelete,
  onExport,
  onUse,
  onPublish,
  onUnpublish,
}: {
  skill: Skill;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onUse: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  return (
    <Card className="flex flex-col" hover>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-medium">{skill.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {skill.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {skill.isPublic && (
            <Badge color="cognition">已发布</Badge>
          )}
          <Badge color={CATEGORY_BADGE[skill.category] || "default"}>
            {CATEGORY_LABEL[skill.category] || skill.category}
          </Badge>
        </div>
      </div>

      {/* 标签 */}
      {skill.tags && skill.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {skill.tags.slice(0, 4).map((t, i) => (
            <span
              key={i}
              className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* 元信息 */}
      <div className="mb-3 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Play className="h-3 w-3" />
          {skill.usageCount} 次
        </span>
        <span className="inline-flex items-center gap-1">
          <Tag className="h-3 w-3" />
          {skill.parameters.length} 参数
        </span>
        <span className="rounded bg-muted/50 px-1 py-0">
          {SOURCE_LABEL[skill.source] || skill.source}
        </span>
      </div>

      {/* 操作 */}
      <div className="mt-auto flex items-center gap-1.5 border-t border-border/60 pt-3">
        <Button size="sm" variant="primary" onClick={onUse}>
          <Play className="h-3 w-3" /> 使用
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Edit3 className="h-3 w-3" /> 编辑
        </Button>
        <Button size="sm" variant="ghost" onClick={onExport} title="导出">
          <Download className="h-3 w-3" />
        </Button>
        {skill.isPublic ? (
          <Button size="sm" variant="ghost" onClick={onUnpublish} title="从广场下架">
            <Store className="h-3 w-3 text-cognition" />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onPublish} title="发布到广场">
            <Store className="h-3 w-3" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDelete} title="删除">
          <Trash2 className="h-3 w-3 text-graveyard" />
        </Button>
      </div>
    </Card>
  );
}

// ============ 新建/编辑弹窗 ============

function SkillEditModal({
  skill,
  onClose,
  onSaved,
}: {
  skill: Skill | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!skill;
  const [activeTab, setActiveTab] = useState<EditTab>("edit");
  const [name, setName] = useState(skill?.name || "");
  const [description, setDescription] = useState(skill?.description || "");
  const [category, setCategory] = useState(skill?.category || "custom");
  const [content, setContent] = useState(skill?.content || "");
  const [promptTemplate, setPromptTemplate] = useState(
    skill?.promptTemplate || ""
  );
  const [tags, setTags] = useState((skill?.tags || []).join(", "));
  const [parameters, setParameters] = useState<SkillParameter[]>(
    skill?.parameters || []
  );
  const [saving, setSaving] = useState(false);

  const addParam = () => {
    setParameters([
      ...parameters,
      {
        key: `param${parameters.length + 1}`,
        label: "新参数",
        type: "text",
        required: false,
      },
    ]);
  };

  const updateParam = (idx: number, patch: Partial<SkillParameter>) => {
    setParameters(
      parameters.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    );
  };

  const removeParam = (idx: number) => {
    setParameters(parameters.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast("请填写名称", "error");
      return;
    }
    if (!description.trim()) {
      toast("请填写描述", "error");
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      category,
      content,
      promptTemplate,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      parameters,
    };

    setSaving(true);
    try {
      const url = isEdit ? `/api/skills/${skill!.id}` : "/api/skills";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast(isEdit ? "已更新" : "已创建", "success");
        onSaved();
      } else {
        toast(data.error || "保存失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[6vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl transition-all animate-in zoom-in-95 duration-200 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-cognition" />
            <h2 className="text-base font-semibold">
              {isEdit ? "编辑技能" : "新建技能"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 标签栏（仅编辑模式显示版本历史） */}
        {isEdit && (
          <div className="mb-4 flex gap-1 border-b border-border/60">
            <button
              onClick={() => setActiveTab("edit")}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                activeTab === "edit"
                  ? "border-cognition text-cognition"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Edit3 className="h-3.5 w-3.5" /> 编辑
            </button>
            <button
              onClick={() => setActiveTab("versions")}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                activeTab === "versions"
                  ? "border-cognition text-cognition"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <History className="h-3.5 w-3.5" /> 版本历史
            </button>
          </div>
        )}

        {activeTab === "versions" && isEdit && skill ? (
          <VersionHistoryPanel
            skillId={skill.id}
            onRolledBack={() => {
              onSaved();
            }}
          />
        ) : (
          <>
          <div className="space-y-4">
          {/* 名称 + 分类 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">
                名称 <span className="text-graveyard">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：财务预测"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">
                分类
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
              >
                {CATEGORIES.filter((c) => c.key !== "all").map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 描述 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              描述 <span className="text-graveyard">*</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="一句话说明用途"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
            />
          </div>

          {/* 标签 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              标签（逗号分隔）
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="如：财务, 预测, 报告"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
            />
          </div>

          {/* 正文 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              正文（含步骤等）
            </label>
            <RichTextEditor
              value={content}
              onChange={(html) => setContent(html)}
              placeholder="技能名称&#10;&#10;步骤&#10;1. ...&#10;2. ..."
              minHeight={160}
            />
          </div>

          {/* 提示词模板 */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              AI 提示词模板（用 {"{{param}}"} 占位）
            </label>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder={"你是一个专家。请基于 {{context}} 完成..."}
              rows={4}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
            />
          </div>

          {/* 参数编辑器 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-foreground/80">
                参数定义
              </label>
              <Button size="sm" variant="outline" onClick={addParam}>
                <Plus className="h-3 w-3" /> 添加参数
              </Button>
            </div>
            {parameters.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-[11px] text-muted-foreground">
                暂无参数，点击右上角添加
              </div>
            ) : (
              <div className="space-y-2">
                {parameters.map((p, idx) => (
                  <ParamEditor
                    key={idx}
                    param={p}
                    onChange={(patch) => updateParam(idx, patch)}
                    onRemove={() => removeParam(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

            {/* 底部操作 */}
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-border/60 pt-4">
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 保存中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============ 版本详情弹窗 ============

function VersionDetailModal({
  skillId,
  version,
  onClose,
  onRollback,
}: {
  skillId: string;
  version: SkillVersionSummary;
  onClose: () => void;
  onRollback: () => void;
}) {
  const [detail, setDetail] = useState<SkillVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/skills/${skillId}/versions/${version.version}`
        );
        const data = await res.json();
        if (res.ok) {
          setDetail(data.version as SkillVersionDetail);
        } else {
          toast(data.error || "加载版本详情失败", "error");
        }
      } catch (e) {
        toast("网络错误：" + (e as Error).message, "error");
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [skillId, version.version]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-4 pt-[6vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-200 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-cognition" />
            <h2 className="text-base font-semibold">版本详情</h2>
            <Badge color="cognition">v{version.version}</Badge>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载版本详情...
          </div>
        ) : detail ? (
          <div className="space-y-4">
            {/* 版本号 + 创建时间 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  版本号
                </label>
                <div className="text-xs font-medium">v{detail.version}</div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  创建时间
                </label>
                <div className="text-xs">
                  {new Date(detail.createdAt).toLocaleString("zh-CN")}
                </div>
              </div>
            </div>

            {/* 名称 */}
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                名称
              </label>
              <div className="text-xs">{detail.name}</div>
            </div>

            {/* 版本说明 */}
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                版本说明
              </label>
              <div className="text-xs text-muted-foreground">
                {detail.description || "（无）"}
              </div>
            </div>

            {/* 分类 + 标签 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  分类
                </label>
                <div className="text-xs">
                  {CATEGORY_LABEL[detail.category] || detail.category}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  标签
                </label>
                <div className="text-xs text-muted-foreground">
                  {detail.tags && detail.tags.length > 0
                    ? detail.tags.join("、")
                    : "（无）"}
                </div>
              </div>
            </div>

            {/* 提示词模板 */}
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                提示词模板（promptTemplate）
              </label>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-3 text-[11px] leading-relaxed">
                {detail.promptTemplate || "（空）"}
              </pre>
            </div>

            {/* 参数配置 */}
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                参数配置（parameters / config）
              </label>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-3 text-[11px] leading-relaxed">
                {detail.parameters && detail.parameters.length > 0
                  ? JSON.stringify(detail.parameters, null, 2)
                  : "（空）"}
              </pre>
            </div>

            {/* 正文内容 */}
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                Markdown 正文（content）
              </label>
              <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-3 text-[11px] leading-relaxed">
                {detail.content || "（空）"}
              </pre>
            </div>

            {/* 底部操作 */}
            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
              <Button variant="ghost" onClick={onClose}>
                关闭
              </Button>
              <Button onClick={onRollback}>
                <RotateCcw className="h-3.5 w-3.5" /> 回滚到此版本
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={X}
            title="加载失败"
            description="无法获取版本详情，请稍后重试"
          />
        )}
      </div>
    </div>
  );
}

// ============ 回滚确认弹窗 ============

function RollbackConfirmDialog({
  version,
  onConfirm,
  onCancel,
  loading,
}: {
  version: SkillVersionSummary;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-graveyard" />
          <h3 className="text-sm font-semibold">确认回滚</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          回滚将用版本 v{version.version}{" "}
          的内容覆盖当前 Skill，当前内容会丢失，是否确认？
        </p>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> 回滚中...
              </>
            ) : (
              "确认回滚"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ 版本历史面板 ============

function VersionHistoryPanel({
  skillId,
  onRolledBack,
}: {
  skillId: string;
  onRolledBack: () => void;
}) {
  const [versions, setVersions] = useState<SkillVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  // 当前正在回滚的版本 ID
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  // 待确认回滚的版本
  const [confirmVersion, setConfirmVersion] =
    useState<SkillVersionSummary | null>(null);
  // 正在查看详情的版本
  const [viewingVersion, setViewingVersion] =
    useState<SkillVersionSummary | null>(null);
  // 版本对比：选中的版本号列表（最多 2 个）
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);
  // 是否显示对比弹窗
  const [showDiff, setShowDiff] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skills/${skillId}/versions`);
      const data = await res.json();
      if (res.ok) {
        setVersions(data.versions || []);
      } else {
        toast(data.error || "加载版本失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleRollback = async (version: SkillVersionSummary) => {
    setRollingBackId(version.id);
    try {
      const res = await fetch(`/api/skills/${skillId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: version.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`已回滚到版本 ${version.version}`, "success");
        setConfirmVersion(null);
        setViewingVersion(null);
        onRolledBack();
      } else {
        toast(data.error || "回滚失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setRollingBackId(null);
    }
  };

  // 切换版本选中状态（最多选 2 个，超过时替换最早选的）
  const toggleVersionSelection = (version: number) => {
    setSelectedVersions((prev) => {
      if (prev.includes(version)) {
        return prev.filter((v) => v !== version);
      }
      if (prev.length >= 2) {
        return [prev[1], version];
      }
      return [...prev, version];
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载版本列表...
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
        <History className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">
          暂无历史版本，保存修改后会自动生成版本快照
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <History className="h-3 w-3" />
          <span>共 {versions.length} 个历史版本（最多保留 20 个）</span>
        </div>
        {selectedVersions.length === 2 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDiff(true)}
          >
            <GitCompare className="h-3 w-3" /> 对比版本
          </Button>
        )}
      </div>
      {selectedVersions.length > 0 && selectedVersions.length < 2 && (
        <div className="rounded-lg bg-cognition/5 px-3 py-1.5 text-[10px] text-cognition">
          已选择 {selectedVersions.length} 个版本，再选 1 个即可对比
        </div>
      )}

      {versions.map((v) => (
        <div
          key={v.id}
          className={cn(
            "flex items-center gap-3 rounded-xl border p-3 transition-colors",
            selectedVersions.includes(v.version)
              ? "border-cognition/40 bg-cognition/5"
              : "border-border bg-muted/20"
          )}
        >
          <input
            type="checkbox"
            checked={selectedVersions.includes(v.version)}
            onChange={() => toggleVersionSelection(v.version)}
            className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-cognition"
          />
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cognition/10 text-xs font-semibold text-cognition">
            v{v.version}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{v.name}</div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{new Date(v.createdAt).toLocaleString("zh-CN")}</span>
              {v.tags && v.tags.length > 0 && (
                <span className="truncate">
                  {v.tags.slice(0, 3).join("、")}
                </span>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setViewingVersion(v)}
            disabled={rollingBackId !== null}
            title="查看详情"
          >
            <Eye className="h-3 w-3" /> 查看详情
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmVersion(v)}
            disabled={rollingBackId !== null}
          >
            {rollingBackId === v.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <RotateCcw className="h-3 w-3" /> 回滚
              </>
            )}
          </Button>
        </div>
      ))}

      {/* 版本详情弹窗 */}
      {viewingVersion && (
        <VersionDetailModal
          skillId={skillId}
          version={viewingVersion}
          onClose={() => setViewingVersion(null)}
          onRollback={() => setConfirmVersion(viewingVersion)}
        />
      )}

      {/* 回滚确认弹窗 */}
      {confirmVersion && (
        <RollbackConfirmDialog
          version={confirmVersion}
          onConfirm={() => handleRollback(confirmVersion)}
          onCancel={() => setConfirmVersion(null)}
          loading={rollingBackId === confirmVersion.id}
        />
      )}

      {/* 版本对比弹窗 */}
      {showDiff && selectedVersions.length === 2 && (
        <DiffModal
          skillId={skillId}
          versionA={Math.min(...selectedVersions)}
          versionB={Math.max(...selectedVersions)}
          onClose={() => setShowDiff(false)}
        />
      )}
    </div>
  );
}

// ============ 版本对比弹窗 ============

function DiffModal({
  skillId,
  versionA,
  versionB,
  onClose,
}: {
  skillId: string;
  versionA: number;
  versionB: number;
  onClose: () => void;
}) {
  const [versionDataA, setVersionDataA] = useState<SkillVersionDetail | null>(
    null
  );
  const [versionDataB, setVersionDataB] = useState<SkillVersionDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [activeField, setActiveField] = useState<DiffField>("content");

  // 并行获取两个版本的详情
  useEffect(() => {
    const fetchVersions = async () => {
      setLoading(true);
      try {
        const [resA, resB] = await Promise.all([
          fetch(`/api/skills/${skillId}/versions/${versionA}`),
          fetch(`/api/skills/${skillId}/versions/${versionB}`),
        ]);
        const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);
        if (resA.ok && resB.ok) {
          setVersionDataA(dataA.version as SkillVersionDetail);
          setVersionDataB(dataB.version as SkillVersionDetail);
        } else {
          toast(
            dataA.error || dataB.error || "加载版本详情失败",
            "error"
          );
        }
      } catch (e) {
        toast("网络错误：" + (e as Error).message, "error");
      } finally {
        setLoading(false);
      }
    };
    fetchVersions();
  }, [skillId, versionA, versionB]);

  // 计算当前字段的 Diff 结果
  const diffResult = useMemo(() => {
    if (!versionDataA || !versionDataB) return null;
    // 提取指定字段的文本内容
    const extract = (v: SkillVersionDetail): string => {
      switch (activeField) {
        case "content":
          return v.content || "";
        case "promptTemplate":
          return v.promptTemplate || "";
        case "description":
          return v.description || "";
        case "parameters":
          return JSON.stringify(v.parameters, null, 2);
        default:
          return "";
      }
    };
    return computeLcsDiff(extract(versionDataA), extract(versionDataB));
  }, [versionDataA, versionDataB, activeField]);

  // 可对比字段列表
  const diffFields: { key: DiffField; label: string }[] = [
    { key: "content", label: "内容" },
    { key: "promptTemplate", label: "提示词模板" },
    { key: "description", label: "描述" },
    { key: "parameters", label: "参数" },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-4 pt-[4vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] min-h-[60vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部：标题 + 版本标识 */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-cognition" />
            <h2 className="text-base font-semibold">版本对比</h2>
            <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted/60 px-2 py-0.5 font-medium text-foreground">
                v{versionA}
              </span>
              <span>→</span>
              <span className="rounded-md bg-cognition/10 px-2 py-0.5 font-medium text-cognition">
                v{versionB}
              </span>
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

        {/* 字段切换标签 */}
        <div className="flex shrink-0 gap-1 border-b border-border/60 px-4 sm:px-5">
          {diffFields.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveField(f.key)}
              className={cn(
                "border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                activeField === f.key
                  ? "border-cognition text-cognition"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 统计栏：新增/删除/修改行数 */}
        {diffResult && (
          <div className="flex shrink-0 items-center gap-4 border-b border-border/60 bg-muted/20 px-4 py-2 text-[11px] sm:px-5">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              新增{" "}
              <span className="font-semibold text-green-600">
                {diffResult.stats.added}
              </span>{" "}
              行
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              删除{" "}
              <span className="font-semibold text-red-600">
                {diffResult.stats.removed}
              </span>{" "}
              行
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              修改{" "}
              <span className="font-semibold text-yellow-600">
                {diffResult.stats.modified}
              </span>{" "}
              行
            </span>
          </div>
        )}

        {/* Diff 内容区域 */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载版本详情...
            </div>
          ) : !versionDataA || !versionDataB ? (
            <div className="py-16 text-center text-xs text-muted-foreground">
              加载失败
            </div>
          ) : diffResult ? (
            <DiffView diff={diffResult} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============ Diff 视图（左右分栏，同步滚动） ============

function DiffView({ diff }: { diff: DiffResult }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  // 防止滚动同步时触发循环
  const syncing = useRef(false);

  // 同步左右两侧的垂直滚动
  const handleScroll = (side: "left" | "right") => {
    if (syncing.current) return;
    syncing.current = true;
    const source = side === "left" ? leftRef.current : rightRef.current;
    const target = side === "left" ? rightRef.current : leftRef.current;
    if (source && target) {
      target.scrollTop = source.scrollTop;
    }
    syncing.current = false;
  };

  // 根据行类型和侧别返回高亮样式
  const getRowClass = (type: DiffLineType, side: "old" | "new"): string => {
    if (type === "equal") return "";
    if (type === "modified") return "bg-yellow-500/10";
    if (type === "added") {
      // 新增行：右侧绿色高亮，左侧灰色占位
      return side === "new" ? "bg-green-500/10" : "bg-muted/30";
    }
    if (type === "removed") {
      // 删除行：左侧红色高亮，右侧灰色占位
      return side === "old" ? "bg-red-500/10" : "bg-muted/30";
    }
    return "";
  };

  return (
    <div className="flex h-full min-h-0">
      {/* 左侧：旧版本 */}
      <div className="flex w-1/2 flex-col border-r border-border/60">
        <div className="shrink-0 border-b border-border/60 bg-muted/30 px-3 py-1.5 text-[10px] font-medium text-muted-foreground">
          旧版本
        </div>
        <div
          ref={leftRef}
          onScroll={() => handleScroll("left")}
          className="min-h-0 flex-1 overflow-auto"
        >
          <div className="font-mono text-[11px] leading-5">
            {diff.lines.map((line, idx) => (
              <div
                key={idx}
                className={cn("flex", getRowClass(line.type, "old"))}
              >
                <span className="w-12 shrink-0 select-none border-r border-border/40 px-2 text-right text-muted-foreground/60">
                  {line.oldNumber ?? ""}
                </span>
                <span className="whitespace-pre px-2 text-foreground">
                  {line.oldContent || "\u00A0"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧：新版本 */}
      <div className="flex w-1/2 flex-col">
        <div className="shrink-0 border-b border-border/60 bg-muted/30 px-3 py-1.5 text-[10px] font-medium text-muted-foreground">
          新版本
        </div>
        <div
          ref={rightRef}
          onScroll={() => handleScroll("right")}
          className="min-h-0 flex-1 overflow-auto"
        >
          <div className="font-mono text-[11px] leading-5">
            {diff.lines.map((line, idx) => (
              <div
                key={idx}
                className={cn("flex", getRowClass(line.type, "new"))}
              >
                <span className="w-12 shrink-0 select-none border-r border-border/40 px-2 text-right text-muted-foreground/60">
                  {line.newNumber ?? ""}
                </span>
                <span className="whitespace-pre px-2 text-foreground">
                  {line.newContent || "\u00A0"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ 参数编辑器 ============

function ParamEditor({
  param,
  onChange,
  onRemove,
}: {
  param: SkillParameter;
  onChange: (patch: Partial<SkillParameter>) => void;
  onRemove: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <input
          value={param.key}
          onChange={(e) => onChange({ key: e.target.value })}
          placeholder="key"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] focus:border-cognition/40 focus:outline-none"
        />
        <input
          value={param.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="标签"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] focus:border-cognition/40 focus:outline-none"
        />
        <select
          value={param.type}
          onChange={(e) =>
            onChange({ type: e.target.value as SkillParamType })
          }
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] focus:border-cognition/40 focus:outline-none"
        >
          {PARAM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={param.required}
              onChange={(e) => onChange({ required: e.target.checked })}
              className="h-3 w-3"
            />
            必填
          </label>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="ml-auto text-[10px] text-cognition hover:underline"
          >
            {showAdvanced ? "收起" : "展开"}
          </button>
          <button
            onClick={onRemove}
            className="text-graveyard hover:opacity-70"
            aria-label="删除参数"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {showAdvanced && (
        <div className="mt-2 space-y-2">
          <input
            value={param.placeholder || ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="placeholder（提示文字）"
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] focus:border-cognition/40 focus:outline-none"
          />
          <input
            value={param.defaultValue || ""}
            onChange={(e) => onChange({ defaultValue: e.target.value })}
            placeholder="defaultValue（默认值）"
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] focus:border-cognition/40 focus:outline-none"
          />
          {param.type === "select" && (
            <input
              value={(param.options || []).join(", ")}
              onChange={(e) =>
                onChange({
                  options: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="options（逗号分隔）"
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[11px] focus:border-cognition/40 focus:outline-none"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============ 导入弹窗 ============

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [markdown, setMarkdown] = useState("");
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!markdown.trim()) {
      toast("请粘贴 Markdown 内容", "error");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`已导入 ${data.imported} 个，失败 ${data.failed} 个`, "success");
        onImported();
      } else {
        toast(data.error || "导入失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setImporting(false);
    }
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setMarkdown(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl transition-all animate-in zoom-in-95 duration-200 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-cognition" />
            <h2 className="text-base font-semibold">导入 Skill</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
            <input
              type="file"
              accept=".md,.markdown,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="hidden"
              id="skill-file-input"
            />
            <label
              htmlFor="skill-file-input"
              className="flex cursor-pointer flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <FileText className="h-6 w-6" />
              <span>点击选择 .md 文件</span>
            </label>
          </div>

          <div className="text-center text-[10px] text-muted-foreground">
            或粘贴 Markdown 内容
          </div>

          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder={"---\nname: 技能名称\ndescription: ...\ncategory: custom\ntags: [标签]\nparameters:\n  - key: param1\n    label: 参数1\n    type: text\n    required: true\n---\n\n# 技能正文"}
            rows={12}
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleImport} disabled={importing}>
            {importing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 导入中...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" /> 导入
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ AI 生成弹窗 ============

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function AIGenerateModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [workLog, setWorkLog] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedSkill, setGeneratedSkill] = useState<Partial<Skill> | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    if (!workLog.trim() && conversation.length === 0) {
      toast("请先输入工作记录", "error");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/skills/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workLog,
          conversation: conversation.map((c) => ({
            role: c.role,
            content: c.content,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedSkill(data.skill);
        if (data.fallback) {
          // 降级模式：展示明确的降级原因
          toast(data.fallbackReason || "AI 调用失败，已降级为简单分类", "info");
        } else if (data.mock) {
          toast("AI_API_KEY 未配置，已用 Mock 逻辑生成", "info");
        } else {
          toast("已生成技能", "success");
        }
      } else {
        toast(data.error || "生成失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendMessage = () => {
    if (!input.trim()) return;
    setConversation([...conversation, { role: "user", content: input.trim() }]);
    setInput("");
  };

  const handleSave = async () => {
    if (!generatedSkill) return;
    setSaving(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...generatedSkill,
          source: "ai-generated",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("已保存技能", "success");
        onGenerated();
      } else {
        toast(data.error || "保存失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[6vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl transition-all animate-in zoom-in-95 duration-200 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cognition" />
            <h2 className="text-base font-semibold">AI 生成技能</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!generatedSkill ? (
          <div className="space-y-4">
            {/* 工作记录输入 */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                <FileText className="h-3.5 w-3.5" />
                工作记录
              </label>
              <textarea
                value={workLog}
                onChange={(e) => setWorkLog(e.target.value)}
                placeholder="粘贴你的工作记录、会议纪要、对话内容等，AI 会从中提取可复用的技能模式..."
                rows={6}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
              />
            </div>

            {/* 对话区（可选） */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                <MessageSquare className="h-3.5 w-3.5" />
                补充对话（可选）
              </label>
              {conversation.length > 0 && (
                <div className="mb-2 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
                  {conversation.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-2.5 py-1.5 text-[11px]",
                          msg.role === "user"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="补充说明（按 Enter 发送）"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
                />
                <Button size="sm" variant="outline" onClick={handleSendMessage}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* 生成按钮 */}
            <div className="flex items-center justify-between border-t border-border/60 pt-4">
              <span className="text-[10px] text-muted-foreground">
                AI 将分析工作记录，提取可复用技能模式
              </span>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> 生成技能
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <GeneratedSkillPreview
            skill={generatedSkill}
            saving={saving}
            onRegenerate={handleGenerate}
            onSave={handleSave}
            onCancel={() => setGeneratedSkill(null)}
          />
        )}
      </div>
    </div>
  );
}

// ============ 生成结果预览 ============

function GeneratedSkillPreview({
  skill,
  saving,
  onRegenerate,
  onSave,
  onCancel,
}: {
  skill: Partial<Skill>;
  saving: boolean;
  onRegenerate: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = JSON.stringify(skill, null, 2);
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-cognition/30 bg-cognition/5 p-3 text-xs text-cognition">
        <Bot className="h-4 w-4 shrink-0" />
        <span>AI 已生成技能，请确认后保存</span>
      </div>

      {/* 预览内容 */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            {skill.name || "(未命名)"}
          </h3>
          {skill.category && (
            <Badge color={CATEGORY_BADGE[skill.category] || "default"}>
              {CATEGORY_LABEL[skill.category] || skill.category}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {skill.description || "(无描述)"}
        </p>
        {skill.tags && skill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skill.tags.map((t, i) => (
              <span
                key={i}
                className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {skill.parameters && skill.parameters.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] font-medium text-muted-foreground">
              参数（{skill.parameters.length}）
            </div>
            <div className="flex flex-wrap gap-1">
              {skill.parameters.map((p, i) => (
                <span
                  key={i}
                  className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px]"
                >
                  {p.key}
                  {p.required ? "*" : ""}
                </span>
              ))}
            </div>
          </div>
        )}
        {skill.promptTemplate && (
          <div>
            <div className="mb-1 text-[10px] font-medium text-muted-foreground">
              提示词模板
            </div>
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-2 text-[10px] leading-relaxed">
              {skill.promptTemplate}
            </pre>
          </div>
        )}
        {skill.content && (
          <div>
            <div className="mb-1 text-[10px] font-medium text-muted-foreground">
              正文
            </div>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-2 text-[10px] leading-relaxed">
              {skill.content}
            </pre>
          </div>
        )}
      </div>

      {/* 操作 */}
      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <Button size="sm" variant="ghost" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="h-3 w-3" /> 已复制
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> 复制 JSON
            </>
          )}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            重新生成
          </Button>
          <Button variant="outline" onClick={onRegenerate}>
            再试一次
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 保存中...
              </>
            ) : (
              "保存技能"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

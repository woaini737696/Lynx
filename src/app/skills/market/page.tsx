"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import {
  Store,
  Star,
  Upload,
  Download,
  Share2,
  X,
  Loader2,
  FileText,
  Tag,
  Play,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  LoadingState,
  EmptyState,
} from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { SearchInput, FilterSelect, Pagination, useClientPagination } from "@/components/ui/ListControls";
import type { SkillParameter } from "@/lib/skill-parser";
import { useSearchParams } from "next/navigation";

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
}

// ============ 评分评论类型 ============

interface Review {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
}

interface ReviewStats {
  average: number;
  count: number;
  reviews: Review[];
}

const CATEGORY_BADGE: Record<
  string,
  "task" | "cognition" | "northstar" | "campaign" | "graveyard" | "default"
> = {
  general: "default",
  finance: "northstar",
  report: "task",
  review: "cognition",
  knowledge: "campaign",
  meeting: "task",
  product: "campaign",
  custom: "default",
};

const CATEGORY_LABEL: Record<string, string> = {
  general: "通用",
  finance: "财务",
  report: "报告",
  review: "审查",
  knowledge: "知识",
  meeting: "会议",
  product: "产品",
  custom: "自定义",
};

// ============ 主页面 ============

export default function SkillMarketPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <LoadingState title="Skill 市场" />
        </div>
      }
    >
      <SkillMarketContent />
    </Suspense>
  );
}

function SkillMarketContent() {
  const searchParams = useSearchParams();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [importModal, setImportModal] = useState(false);
  const [shareModal, setShareModal] = useState<Skill | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codePreview, setCodePreview] = useState<Partial<Skill> | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeImporting, setCodeImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reviewsMap, setReviewsMap] = useState<Record<string, ReviewStats>>({});
  const [reviewModal, setReviewModal] = useState<Skill | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/skills?category=all");
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
  }, []);

  // 获取所有 Skill 的评分评论数据
  const fetchAllReviews = useCallback(async (skillIds: string[]) => {
    if (skillIds.length === 0) return;
    try {
      const results = await Promise.all(
        skillIds.map(async (id) => {
          try {
            const res = await fetch(`/api/skills/${id}/reviews`);
            if (!res.ok) return null;
            const data = await res.json();
            return [id, data] as const;
          } catch {
            return null;
          }
        })
      );
      const map: Record<string, ReviewStats> = {};
      for (const result of results) {
        if (result) {
          const [id, data] = result;
          map[id] = {
            average: data.average,
            count: data.count,
            reviews: data.reviews,
          };
        }
      }
      setReviewsMap(map);
    } catch (e) {
      // 静默失败，不影响主页面
      console.error("获取评论失败:", e);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // 前端搜索 + 分类过滤
  const filteredSkills = useMemo(() => {
    let list = skills;
    if (categoryFilter !== "all") {
      list = list.filter((s) => s.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [skills, searchQuery, categoryFilter]);

  const {
    page,
    pageSize,
    total,
    paginated,
    onPageChange,
    onPageSizeChange,
  } = useClientPagination(filteredSkills);

  // Skills 加载完成后获取评论数据
  useEffect(() => {
    if (skills.length > 0) {
      fetchAllReviews(skills.map((s) => s.id));
    }
  }, [skills, fetchAllReviews]);

  // 处理 URL 中的分享码
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setCodeInput(code);
      handleResolveCode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleExport = async (skill: Skill) => {
    // 单个 Skill 导出为 JSON
    const url = `/api/skills/${skill.id}?export=1`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${skill.name}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast("已开始下载", "success");
  };

  const handleExportJson = async (skill: Skill) => {
    // 单个 Skill 导出为 JSON（通过批量导出接口）
    try {
      const res = await fetch("/api/skills/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillIds: [skill.id] }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "导出失败", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const now = new Date();
      const dateStr =
        now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, "0") +
        now.getDate().toString().padStart(2, "0");
      a.download = `lynnhub-skills-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("已导出 JSON", "success");
    } catch (e) {
      toast("导出失败：" + (e as Error).message, "error");
    }
  };

  const handleShare = (skill: Skill) => {
    setShareModal(skill);
  };

  const handleResolveCode = async (code: string) => {
    if (!code.trim()) {
      toast("请输入分享码", "error");
      return;
    }
    setCodeLoading(true);
    setCodePreview(null);
    try {
      const res = await fetch(`/api/skills/share-code?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setCodePreview(data.skill);
        toast("已解析分享码", "success");
      } else {
        toast(data.error || "解析失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setCodeLoading(false);
    }
  };

  const handleImportFromCode = async () => {
    if (!codePreview) return;
    setCodeImporting(true);
    try {
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: { skills: [codePreview] },
          mode: "skip",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`已导入 ${data.imported} 个 Skill`, "success");
        setCodePreview(null);
        setCodeInput("");
        fetchSkills();
      } else {
        toast(data.error || "导入失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setCodeImporting(false);
    }
  };

  const handleFileImport = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      toast("请选择 .json 文件", "error");
      return;
    }
    try {
      const text = await file.text();
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: text, mode: "skip" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(
          `导入完成：新增 ${data.created || 0}，覆盖 ${data.overwritten || 0}，跳过 ${data.skipped || 0}`,
          "success"
        );
        setImportModal(false);
        fetchSkills();
      } else {
        toast(data.error || "导入失败", "error");
      }
    } catch (e) {
      toast("导入失败：" + (e as Error).message, "error");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileImport(file);
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="Skill 市场"
        subtitle="导入、导出、分享 Skill：通过 JSON 文件或分享码交换技能"
        action={
          <div className="flex items-center gap-2">
            <Button onClick={() => setImportModal(true)}>
              <Upload className="h-3.5 w-3.5" /> 导入 JSON
            </Button>
            <HelpButton contentKey="skills-market" />
          </div>
        }
      />

      {/* 分享码输入区 */}
      <Card className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              <Share2 className="mr-1 inline h-3 w-3" />
              分享码
            </label>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleResolveCode(codeInput);
              }}
              placeholder="粘贴分享码，解析后可导入"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => handleResolveCode(codeInput)}
            disabled={codeLoading || !codeInput.trim()}
          >
            {codeLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "解析"
            )}
          </Button>
        </div>

        {/* 分享码解析结果 */}
        {codePreview && (
          <div className="mt-4 rounded-xl border border-cognition/30 bg-cognition/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Check className="h-4 w-4 text-cognition" />
              <span className="text-xs font-medium text-cognition">
                已解析 Skill
              </span>
            </div>
            <div className="mb-3 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">
                  {codePreview.name || "(未命名)"}
                </h4>
                {codePreview.category && (
                  <Badge color={CATEGORY_BADGE[codePreview.category] || "default"}>
                    {CATEGORY_LABEL[codePreview.category] || codePreview.category}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {codePreview.description || "(无描述)"}
              </p>
              {codePreview.tags && codePreview.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {codePreview.tags.map((t, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCodePreview(null);
                  setCodeInput("");
                }}
              >
                取消
              </Button>
              <Button size="sm" onClick={handleImportFromCode} disabled={codeImporting}>
                {codeImporting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Download className="h-3 w-3" /> 导入到我的技能
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 搜索 + 分类筛选 */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="按名称或描述搜索..."
          className="flex-1"
        />
        <FilterSelect
          value={categoryFilter}
          onChange={setCategoryFilter}
          label="分类"
          options={[
            { value: "all", label: "全部" },
            ...Object.entries(CATEGORY_LABEL).map(([k, v]) => ({
              value: k,
              label: v,
            })),
          ]}
        />
      </div>

      {/* Skill 列表 */}
      {loading ? (
        <LoadingState title="Skill 市场" />
      ) : skills.length === 0 ? (
        <EmptyState
          icon={<Store className="h-7 w-7" />}
          title="暂无 Skill"
          description="导入 JSON 文件或通过分享码获取 Skill"
          action={
            <Button onClick={() => setImportModal(true)}>
              <Upload className="h-3.5 w-3.5" /> 导入 JSON
            </Button>
          }
        />
      ) : paginated.length === 0 ? (
        <EmptyState
          icon={<Store className="h-7 w-7" />}
          title="未匹配到结果"
          description="尝试更换搜索关键词或分类"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginated.map((skill) => (
              <MarketSkillCard
                key={skill.id}
                skill={skill}
                reviewStats={reviewsMap[skill.id]}
                onExport={() => handleExport(skill)}
                onExportJson={() => handleExportJson(skill)}
                onShare={() => handleShare(skill)}
                onReview={() => setReviewModal(skill)}
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

      {/* 导入弹窗 */}
      {importModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh] backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setImportModal(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl transition-all animate-in zoom-in-95 duration-200 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-cognition" />
                <h2 className="text-base font-semibold">导入 Skill（JSON）</h2>
              </div>
              <button
                onClick={() => setImportModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className={cn(
                "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                dragOver
                  ? "border-cognition bg-cognition/5"
                  : "border-border bg-muted/20"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
              <p className="mb-1 text-xs font-medium">拖拽 JSON 文件到此处</p>
              <p className="mb-3 text-[10px] text-muted-foreground">
                或点击下方按钮选择文件
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileImport(f);
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3 w-3" /> 选择文件
              </Button>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/30 p-3 text-[10px] text-muted-foreground">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                支持 LynnHub 导出格式（{"{ skills: [...] }"}）或直接数组格式。
                同名 Skill 默认跳过。
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 分享弹窗 */}
      {shareModal && (
        <ShareModal
          skill={shareModal}
          onClose={() => setShareModal(null)}
        />
      )}

      {/* 评分评论弹窗 */}
      {reviewModal && (
        <ReviewModal
          skill={reviewModal}
          onClose={() => setReviewModal(null)}
          onSubmitted={() => {
            // 提交后刷新该 Skill 的评论数据
            fetchAllReviews([reviewModal.id]);
          }}
        />
      )}
    </div>
  );
}

// ============ 市场卡片 ============

function MarketSkillCard({
  skill,
  reviewStats,
  onExport,
  onExportJson,
  onShare,
  onReview,
}: {
  skill: Skill;
  reviewStats?: ReviewStats;
  onExport: () => void;
  onExportJson: () => void;
  onShare: () => void;
  onReview: () => void;
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
        <Badge color={CATEGORY_BADGE[skill.category] || "default"}>
          {CATEGORY_LABEL[skill.category] || skill.category}
        </Badge>
      </div>

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

      <div className="mb-3 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Play className="h-3 w-3" />
          {skill.usageCount} 次
        </span>
        <span className="inline-flex items-center gap-1">
          <Tag className="h-3 w-3" />
          {skill.parameters.length} 参数
        </span>
        <button
          onClick={onReview}
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          title="查看评分与评论"
        >
          <Star className="h-3 w-3" />
          {reviewStats && reviewStats.count > 0
            ? `${reviewStats.average} (${reviewStats.count})`
            : "暂无评分"}
        </button>
      </div>

      <div className="mt-auto flex items-center gap-1.5 border-t border-border/60 pt-3">
        <Button size="sm" variant="ghost" onClick={onExport} title="导出 Markdown">
          <FileText className="h-3 w-3" /> MD
        </Button>
        <Button size="sm" variant="ghost" onClick={onExportJson} title="导出 JSON">
          <Download className="h-3 w-3" /> JSON
        </Button>
        <Button size="sm" variant="outline" onClick={onShare} title="生成分享码">
          <Share2 className="h-3 w-3" /> 分享
        </Button>
      </div>
    </Card>
  );
}

// ============ 分享弹窗 ============

function ShareModal({
  skill,
  onClose,
}: {
  skill: Skill;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/skills/share-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: skill.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setCode(data.code);
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        setShareUrl(`${origin}${data.shareUrl}`);
        toast("分享码已生成", "success");
      } else {
        toast(data.error || "生成失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl transition-all animate-in zoom-in-95 duration-200 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-cognition" />
            <h2 className="text-base font-semibold">分享 Skill</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{skill.name}</h4>
            <Badge color={CATEGORY_BADGE[skill.category] || "default"}>
              {CATEGORY_LABEL[skill.category] || skill.category}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {skill.description}
          </p>
        </div>

        {generating ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成分享码中...
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">
                分享码
              </label>
              <div className="flex gap-2">
                <input
                  value={code}
                  readOnly
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(code)}
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/80">
                分享链接
              </label>
              <div className="flex gap-2">
                <input
                  value={shareUrl}
                  readOnly
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[11px] text-foreground"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(shareUrl)}
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-muted/30 p-3 text-[10px] text-muted-foreground">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                将分享码或链接发送给他人，对方在 Skill 市场页面粘贴分享码即可导入。
              </span>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ 评分评论弹窗 ============

function ReviewModal({
  skill,
  onClose,
  onSubmitted,
}: {
  skill: Skill;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [author, setAuthor] = useState("");
  const [comment, setComment] = useState("");

  // 获取评论列表
  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skills/${skill.id}/reviews`);
      const data = await res.json();
      if (res.ok) {
        setReviews(data.reviews || []);
        setAverage(data.average || 0);
        setCount(data.count || 0);
      }
    } catch (e) {
      toast("获取评论失败：" + (e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 提交评论
  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) {
      toast("请选择 1-5 星评分", "error");
      return;
    }
    if (!comment.trim()) {
      toast("请输入评论内容", "error");
      return;
    }
    if (!author.trim()) {
      toast("请输入作者名称", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/skills/${skill.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim(),
          author: author.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("评论已提交", "success");
        setRating(0);
        setComment("");
        setAuthor("");
        fetchReviews();
        onSubmitted();
      } else {
        toast(data.error || "提交失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // 格式化时间
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh] backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl transition-all animate-in zoom-in-95 duration-200 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-cognition" />
            <h2 className="text-base font-semibold">评分与评论</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Skill 信息 */}
        <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{skill.name}</h4>
            <Badge color={CATEGORY_BADGE[skill.category] || "default"}>
              {CATEGORY_LABEL[skill.category] || skill.category}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {skill.description}
          </p>
          {count > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              <span className="font-medium text-cognition">{average}</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn(
                      "h-3 w-3",
                      n <= Math.round(average)
                        ? "fill-cognition text-cognition"
                        : "text-muted-foreground/40"
                    )}
                  />
                ))}
              </div>
              <span className="text-muted-foreground">({count} 人评分)</span>
            </div>
          )}
        </div>

        {/* 评分输入区 */}
        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              评分
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="rounded p-0.5 transition-transform hover:scale-110"
                  aria-label={`评 ${n} 星`}
                >
                  <Star
                    className={cn(
                      "h-6 w-6 transition-colors",
                      n <= (hoverRating || rating)
                        ? "fill-cognition text-cognition"
                        : "text-muted-foreground/40"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              作者
            </label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="输入你的名称"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/80">
              评论
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="分享你的使用体验..."
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-cognition/40 focus:outline-none focus:ring-2 focus:ring-cognition/20"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Star className="h-3.5 w-3.5" /> 提交评论
              </>
            )}
          </Button>
        </div>

        {/* 评论列表 */}
        <div className="border-t border-border pt-4">
          <h4 className="mb-3 text-xs font-medium text-foreground/80">
            评论列表 ({count})
          </h4>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              暂无评论，快来发表第一条评论吧
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-border bg-muted/20 p-3"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {review.author}
                      </span>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={cn(
                              "h-2.5 w-2.5",
                              n <= review.rating
                                ? "fill-cognition text-cognition"
                                : "text-muted-foreground/40"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(review.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/80">
                    {review.comment}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

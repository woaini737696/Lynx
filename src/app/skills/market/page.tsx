"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import {
  Store,
  Star,
  Download,
  Share2,
  X,
  Loader2,
  FileText,
  Check,
  User,
  Calendar,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  LoadingState,
} from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { SearchInput, FilterSelect, Pagination } from "@/components/ui/ListControls";
import type { SkillParameter } from "@/lib/skill-parser";
import { useSearchParams, useRouter } from "next/navigation";

// ============ 类型定义 ============

interface MarketplaceSkill {
  id: string;
  publicId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  downloadCount: number;
  ratingAvg: number;
  publishedAt: string;
  author: { username: string; displayName: string };
}

interface MarketplaceSkillDetail extends MarketplaceSkill {
  content: string;
  promptTemplate: string;
  parameters: SkillParameter[];
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
}

const CATEGORY_BADGE: Record<
  string,
  "task" | "cognition" | "northstar" | "campaign" | "graveyard" | "default"
> = {
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
  custom: "自定义",
  // 旧分类（向后兼容显示，避免旧数据显示原始 key）
  general: "通用",
  report: "报告",
  review: "审查",
  knowledge: "知识",
  meeting: "会议",
  product: "产品",
};

const SORT_OPTIONS = [
  { value: "newest", label: "最新发布" },
  { value: "popular", label: "最多加载" },
  { value: "rating", label: "最高评分" },
];

// 广场筛选项：仅展示 12 岗位 + 自定义（hermes 为本地分类，旧分类不再作为筛选项）
const CATEGORY_OPTIONS = [
  { value: "all", label: "全部分类" },
  { value: "pm", label: "产品经理" },
  { value: "designer", label: "设计师" },
  { value: "frontend", label: "前端工程师" },
  { value: "backend", label: "后端工程师" },
  { value: "data", label: "数据分析师" },
  { value: "operations", label: "运营" },
  { value: "marketing", label: "市场" },
  { value: "hr", label: "HR" },
  { value: "finance", label: "财务" },
  { value: "project", label: "项目经理" },
  { value: "creator", label: "内容创作者" },
  { value: "founder", label: "创业者" },
  { value: "custom", label: "自定义" },
];

// ============ 主页面 ============

export default function SkillMarketPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <LoadingState title="技能广场" />
        </div>
      }
    >
      <SkillMarketContent />
    </Suspense>
  );
}

function SkillMarketContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<string>("newest");

  const [localSkillNames, setLocalSkillNames] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());

  const [detailModal, setDetailModal] = useState<MarketplaceSkill | null>(null);

  // 分享码导入（次要位置）
  const [showCodeBox, setShowCodeBox] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codePreview, setCodePreview] = useState<Partial<MarketplaceSkill> | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeImporting, setCodeImporting] = useState(false);

  // 拉取广场列表（服务端分页）
  const fetchMarketplace = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("category", category);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search.trim()) params.set("search", search.trim());
      params.set("sort", sort);
      const res = await fetch(`/api/skills/marketplace?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setSkills(data.skills || []);
        setTotal(data.total || 0);
      } else {
        toast(data.error || "加载失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [category, page, pageSize, search, sort]);

  // 拉取本地技能名（用于判断"已加载"）—— 未登录时静默失败
  const fetchLocalSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills?category=all");
      if (!res.ok) return;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return;
      const data = await res.json();
      const names = new Set<string>(
        (data.skills || []).map((s: { name: string }) => s.name)
      );
      setLocalSkillNames(names);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchMarketplace();
  }, [fetchMarketplace]);

  useEffect(() => {
    fetchLocalSkills();
  }, [fetchLocalSkills]);

  // 搜索防抖：输入变化后延迟触发请求并回到第 1 页
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // URL 分享码自动解析
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setCodeInput(code);
      setShowCodeBox(true);
      handleResolveCode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleCategoryChange = (v: string) => {
    setCategory(v);
    setPage(1);
  };

  const handleSortChange = (v: string) => {
    setSort(v);
    setPage(1);
  };

  const handlePageSizeChange = (s: number) => {
    setPageSize(s);
    setPage(1);
  };

  const redirectToLogin = () => {
    const cb =
      typeof window !== "undefined"
        ? window.location.pathname
        : "/skills/market";
    router.push(`/?login=1&callbackUrl=${encodeURIComponent(cb)}`);
  };

  // 加载广场技能到我的技能库
  const handleLoad = async (skill: MarketplaceSkill) => {
    if (localSkillNames.has(skill.name) || loadedIds.has(skill.publicId)) {
      toast("已加载过该技能", "info");
      return;
    }
    setLoadingIds((prev) => new Set(prev).add(skill.publicId));
    try {
      const res = await fetch(`/api/skills/marketplace/${skill.publicId}/load`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast(`已加载「${skill.name}」到我的技能库`, "success");
        setLoadedIds((prev) => new Set(prev).add(skill.publicId));
        setLocalSkillNames((prev) => new Set(prev).add(skill.name));
      } else if (res.status === 401) {
        redirectToLogin();
      } else {
        toast(data.error || "加载失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(skill.publicId);
        return next;
      });
    }
  };

  // 分享码解析
  const handleResolveCode = async (code: string) => {
    if (!code.trim()) {
      toast("请输入分享码", "error");
      return;
    }
    setCodeLoading(true);
    setCodePreview(null);
    try {
      const res = await fetch(
        `/api/skills/share-code?code=${encodeURIComponent(code.trim())}`
      );
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
        fetchLocalSkills();
      } else if (res.status === 401) {
        redirectToLogin();
      } else {
        toast(data.error || "导入失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setCodeImporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="技能广场"
        subtitle="发现社区分享的 AI 技能，一键加载到你的技能库"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowCodeBox((v) => !v)}>
              <Share2 className="h-3.5 w-3.5" /> 分享码导入
            </Button>
            <HelpButton contentKey="skills-market" />
          </div>
        }
      />

      {/* 分享码导入区（折叠/次要位置） */}
      {showCodeBox && (
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
                placeholder="粘贴分享码，解析后可导入到我的技能库"
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
                        className="ios-glass-sm rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground"
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
      )}

      {/* 顶部工具栏：搜索 + 分类 + 排序 */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="按名称或描述搜索..."
          className="flex-1"
        />
        <FilterSelect
          value={category}
          onChange={handleCategoryChange}
          label="分类"
          options={CATEGORY_OPTIONS}
        />
        <FilterSelect
          value={sort}
          onChange={handleSortChange}
          label="排序"
          options={SORT_OPTIONS}
        />
      </div>

      {/* 技能卡片网格 */}
      {loading ? (
        <LoadingState title="技能广场" />
      ) : skills.length === 0 ? (
        <EmptyState
          icon={Store}
          title="广场暂无技能"
          description="还没有社区分享的技能，稍后再来看看吧"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {skills.map((skill) => {
              const loaded =
                localSkillNames.has(skill.name) ||
                loadedIds.has(skill.publicId);
              const isLoading = loadingIds.has(skill.publicId);
              return (
                <MarketplaceSkillCard
                  key={skill.publicId || skill.id}
                  skill={skill}
                  loaded={loaded}
                  isLoading={isLoading}
                  onDetail={() => setDetailModal(skill)}
                  onLoad={() => handleLoad(skill)}
                />
              );
            })}
          </div>
          <div className="mt-5">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        </>
      )}

      {/* 详情弹窗 */}
      {detailModal && (
        <SkillDetailModal
          skill={detailModal}
          loaded={
            localSkillNames.has(detailModal.name) ||
            loadedIds.has(detailModal.publicId)
          }
          onClose={() => setDetailModal(null)}
          onLoad={async () => {
            await handleLoad(detailModal);
          }}
        />
      )}
    </div>
  );
}

// ============ 星级显示 ============

function Stars({ value, size = "h-3 w-3" }: { value: number; size?: string }) {
  const rounded = Math.round(value);
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            size,
            n <= rounded
              ? "fill-cognition text-cognition"
              : "text-muted-foreground/40"
          )}
        />
      ))}
    </div>
  );
}

// ============ 广场技能卡片 ============

function MarketplaceSkillCard({
  skill,
  loaded,
  isLoading,
  onDetail,
  onLoad,
}: {
  skill: MarketplaceSkill;
  loaded: boolean;
  isLoading: boolean;
  onDetail: () => void;
  onLoad: () => void;
}) {
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("zh-CN");
    } catch {
      return iso;
    }
  };

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
              className="ios-glass-sm rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1" title="作者">
          <User className="h-3 w-3" />
          {skill.author?.displayName || skill.author?.username || "匿名"}
        </span>
        <span className="inline-flex items-center gap-1" title="加载次数">
          <Download className="h-3 w-3" />
          {skill.downloadCount || 0} 次
        </span>
        <span className="inline-flex items-center gap-1" title="发布时间">
          <Calendar className="h-3 w-3" />
          {formatDate(skill.publishedAt)}
        </span>
        {(skill.ratingAvg ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1">
            <Stars value={skill.ratingAvg} />
            <span className="font-medium text-cognition">
              {Number(skill.ratingAvg).toFixed(1)}
            </span>
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1.5 border-t border-border/60 pt-3">
        <Button size="sm" variant="ghost" onClick={onDetail}>
          <FileText className="h-3 w-3" /> 查看详情
        </Button>
        {loaded ? (
          <Button size="sm" variant="outline" disabled className="ml-auto">
            <Check className="h-3 w-3" /> 已加载
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onLoad}
            disabled={isLoading}
            className="ml-auto"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Download className="h-3 w-3" /> 加载到我的技能库
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}

// ============ 详情弹窗（含评论） ============

function SkillDetailModal({
  skill,
  loaded,
  onClose,
  onLoad,
}: {
  skill: MarketplaceSkill;
  loaded: boolean;
  onClose: () => void;
  onLoad: () => Promise<void>;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<MarketplaceSkillDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadingSkill, setLoadingSkill] = useState(false);

  // 评论
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [author, setAuthor] = useState("");

  // 获取详情
  useEffect(() => {
    const fetchDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/skills/marketplace/${skill.publicId}`);
        const data = await res.json();
        if (res.ok) {
          setDetail((data.skill || data) as MarketplaceSkillDetail);
        } else {
          toast(data.error || "加载详情失败", "error");
        }
      } catch (e) {
        toast("网络错误：" + (e as Error).message, "error");
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [skill.publicId]);

  // 获取评论（用 publicId 查询）
  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const res = await fetch(`/api/skills/${skill.publicId}/reviews`);
      if (!res.ok) return;
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return;
      const data = await res.json();
      setReviews(data.reviews || []);
      setAverage(data.average || 0);
      setCount(data.count || 0);
    } catch (e) {
      console.error("获取评论失败:", e);
    } finally {
      setReviewsLoading(false);
    }
  }, [skill.publicId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleLoadClick = async () => {
    setLoadingSkill(true);
    try {
      await onLoad();
    } finally {
      setLoadingSkill(false);
    }
  };

  const handleSubmitReview = async () => {
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
      const res = await fetch(`/api/skills/${skill.publicId}/reviews`, {
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
      } else if (res.status === 401) {
        const cb =
          typeof window !== "undefined"
            ? window.location.pathname
            : "/skills/market";
        router.push(`/?login=1&callbackUrl=${encodeURIComponent(cb)}`);
      } else {
        toast(data.error || "提交失败", "error");
      }
    } catch (e) {
      toast("网络错误：" + (e as Error).message, "error");
    } finally {
      setSubmitting(false);
    }
  };

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
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 p-4 pt-[6vh] backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto glass-modal p-5 transition-all animate-in zoom-in-95 duration-200 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Store className="h-5 w-5 shrink-0 text-cognition" />
            <h2 className="truncate text-base font-semibold">{skill.name}</h2>
            <Badge color={CATEGORY_BADGE[skill.category] || "default"}>
              {CATEGORY_LABEL[skill.category] || skill.category}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 概要信息 */}
        <div className="glass-card mb-4 p-3">
          <p className="mb-2 text-xs leading-relaxed text-foreground/80">
            {skill.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {skill.author?.displayName || skill.author?.username || "匿名"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Download className="h-3 w-3" />
              {skill.downloadCount || 0} 次加载
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatTime(skill.publishedAt)}
            </span>
            {(skill.ratingAvg ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Stars value={skill.ratingAvg} />
                <span className="font-medium text-cognition">
                  {Number(skill.ratingAvg).toFixed(1)}
                </span>
              </span>
            )}
          </div>
          {skill.tags && skill.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {skill.tags.map((t, i) => (
                <span
                  key={i}
                  className="ios-glass-sm rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 加载按钮 */}
        <div className="mb-4 flex justify-end">
          {loaded ? (
            <Button variant="outline" disabled>
              <Check className="h-3.5 w-3.5" /> 已加载到我的技能库
            </Button>
          ) : (
            <Button onClick={handleLoadClick} disabled={loadingSkill}>
              {loadingSkill ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 加载中...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" /> 加载到我的技能库
                </>
              )}
            </Button>
          )}
        </div>

        {/* 详情内容 */}
        {loadingDetail ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载详情...
          </div>
        ) : detail ? (
          <div className="space-y-4">
            {detail.promptTemplate && (
              <div>
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  提示词模板
                </label>
                <pre className="ios-glass-sm max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl p-3 text-[11px] leading-relaxed">
                  {detail.promptTemplate}
                </pre>
              </div>
            )}

            {detail.parameters && detail.parameters.length > 0 && (
              <div>
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  参数配置
                </label>
                <pre className="ios-glass-sm max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl p-3 text-[11px] leading-relaxed">
                  {JSON.stringify(detail.parameters, null, 2)}
                </pre>
              </div>
            )}

            {detail.content && (
              <div>
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  正文内容
                </label>
                <pre className="ios-glass-sm max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl p-3 text-[11px] leading-relaxed">
                  {detail.content}
                </pre>
              </div>
            )}
          </div>
        ) : null}

        {/* 评论区 */}
        <div className="mt-6 border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-medium text-foreground/80">
              评分与评论 ({count})
            </h4>
            {count > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <span className="font-medium text-cognition">
                  {Number(average).toFixed(1)}
                </span>
                <Stars value={average} />
              </div>
            )}
          </div>

          {/* 评论表单（需登录） */}
          <div className="glass-card mb-4 space-y-3 p-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium text-muted-foreground">
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
                        "h-5 w-5 transition-colors",
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
              <label className="mb-1.5 block text-[10px] font-medium text-muted-foreground">
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
              <label className="mb-1.5 block text-[10px] font-medium text-muted-foreground">
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
              size="sm"
              onClick={handleSubmitReview}
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
          {reviewsLoading ? (
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
                  className="glass-card p-3"
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {review.author}
                      </span>
                      <Stars value={review.rating} size="h-2.5 w-2.5" />
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

"use client";

import { useMemo, useState } from "react";
import { BookOpen, Brain, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { COGNITION_TYPES, type CognitionType } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { PageHeader, Card, Button, Badge, Skeleton } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { EmptyState } from "@/components/layout/EmptyState";
import { SearchInput, Pagination, useClientPagination } from "@/components/ui/ListControls";
import { useAsyncLoading } from "@/lib/use-async-loading";
import { useCognitions } from "@/lib/use-api";
import { AnimatedList } from "@/components/ui/AnimatedList";
import { openContextMenu } from "@/components/ui/ContextMenu";

interface Cognition {
  id: string;
  type: CognitionType;
  content: string;
  source: string;
  createdAt: string;
}

export default function CognitionPage() {
  const { data, error, isLoading, mutate } = useCognitions();
  const cognitions: Cognition[] = data?.cognitions || [];
  const loading = isLoading && !data;
  const [filter, setFilter] = useState<CognitionType | "all">("all");
  const [showExtract, setShowExtract] = useState(false);
  const [extractContent, setExtractContent] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // 全局异步加载反馈：耗时超过 800ms 的操作会显示 overlay
  const { run: runAsync } = useAsyncLoading();

  // SWR 加载失败提示（仅首次加载失败时）
  if (error && !data) {
    toast("加载认知库失败", "error");
  }

  const handleExtract = async () => {
    if (!extractContent.trim()) {
      toast("请输入内容", "error");
      return;
    }
    setExtracting(true);
    try {
      const res = await runAsync("AI 提取认知", fetch("/api/cognitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: extractContent, source: "manual" }),
      }));
      if (res.ok) {
        const data = await res.json();
        await mutate();
        setShowExtract(false);
        setExtractContent("");
        toast(`提取完成，新增 ${data.count} 条认知`, "success");
      } else {
        const err = await res.json();
        toast(err.error || "提取失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
    setExtracting(false);
  };

  const handleDeleteCognition = async (id: string) => {
    if (!confirm("确定删除这条认知？")) return;
    try {
      const res = await fetch(`/api/cognitions/${id}`, { method: "DELETE" });
      if (res.ok) {
        await mutate();
        toast("已删除认知", "success");
      } else {
        toast("删除失败", "error");
      }
    } catch (err) {
      console.error("删除失败:", err);
      toast("删除失败", "error");
    }
  };

  const filtered = useMemo(() => {
    let list =
      filter === "all" ? cognitions : cognitions.filter((c) => c.type === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.content?.toLowerCase().includes(q) ||
          c.source?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [cognitions, filter, searchQuery]);

  const {
    page,
    pageSize,
    total,
    paginated,
    onPageChange,
    onPageSizeChange,
  } = useClientPagination(filtered);

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="认知库"
        subtitle="自动沉淀方法论、经验、提示词模板"
        action={
          <div className="flex items-center gap-2">
            <HelpButton contentKey="cognition" />
            <Button onClick={() => setShowExtract(true)}>
              <Sparkles className="h-3.5 w-3.5" /> AI 提取认知
            </Button>
          </div>
        }
      />

      {showExtract && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Brain className="h-4 w-4 text-cognition" />
            AI 提取认知
          </div>
          <textarea
            value={extractContent}
            onChange={(e) => setExtractContent(e.target.value)}
            placeholder="粘贴一段内容，AI 会自动提炼方法论 / 经验 / 提示词..."
            className="min-h-[120px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-cognition"
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowExtract(false)}>
              取消
            </Button>
            <Button onClick={handleExtract} disabled={extracting}>
              {extracting ? "提取中..." : "开始提取"}
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["all", "全部"],
            ...Object.entries(COGNITION_TYPES).map(([k, v]) => [k, v.label]),
          ] as [string, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key as CognitionType | "all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-all",
              filter === key
                ? "border-cognition bg-cognition/10 font-medium text-cognition"
                : "glass-card text-muted-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="按内容或来源搜索..."
          className="max-w-md"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="flex flex-col">
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-16 w-full" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={filter === "all" ? "暂无认知资产" : `暂无${COGNITION_TYPES[filter].label}类认知`}
          description={
            filter === "all"
              ? "粘贴内容，AI 自动提炼方法论 / 经验 / 提示词"
              : "切换其他类型或点击 AI 提取认知"
          }
          action={
            filter === "all" ? (
              <Button onClick={() => setShowExtract(true)}>
                <Plus className="h-3.5 w-3.5" /> 提取第一条认知
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <AnimatedList
            items={paginated}
            keyExtractor={(c) => c.id}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {(c: Cognition) => (
              <Card
                className="flex flex-col"
                hover
                onContextMenu={(e) => openContextMenu(e, [
                  { label: "删除", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onClick: () => handleDeleteCognition(c.id) },
                ])}
              >
                <div className="mb-3 flex items-center justify-between">
                  <Badge color={c.type as any}>{COGNITION_TYPES[c.type].label}</Badge>
                  <span className="text-[10px] text-muted-foreground">{formatTime(c.createdAt)}</span>
                </div>
                <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
              </Card>
            )}
          </AnimatedList>
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
    </div>
  );
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

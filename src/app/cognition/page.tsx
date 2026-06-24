"use client";

import { useEffect, useState } from "react";
import { BookOpen, Brain, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { COGNITION_TYPES, type CognitionType } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { PageHeader, EmptyState, Card, Button, Badge, Skeleton } from "@/components/layout/PageHeader";

interface Cognition {
  id: string;
  type: CognitionType;
  content: string;
  source: string;
  createdAt: string;
}

export default function CognitionPage() {
  const [cognitions, setCognitions] = useState<Cognition[]>([]);
  const [filter, setFilter] = useState<CognitionType | "all">("all");
  const [loading, setLoading] = useState(true);
  const [showExtract, setShowExtract] = useState(false);
  const [extractContent, setExtractContent] = useState("");
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/cognitions");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setCognitions(data.cognitions || []);
        }
      } catch (e) {
        if (!mounted) return;
        console.error(e);
        toast("加载认知库失败", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleExtract = async () => {
    if (!extractContent.trim()) {
      toast("请输入内容", "error");
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch("/api/cognitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: extractContent, source: "manual" }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadCognitions();
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

  const loadCognitions = async () => {
    try {
      const res = await fetch("/api/cognitions");
      if (res.ok) {
        const data = await res.json();
        setCognitions(data.cognitions || []);
      }
    } catch {
      // ignore
    }
  };

  const filtered =
    filter === "all" ? cognitions : cognitions.filter((c) => c.type === filter);

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="认知库"
        subtitle="自动沉淀方法论、经验、提示词模板"
        action={
          <Button onClick={() => setShowExtract(true)}>
            <Sparkles className="h-3.5 w-3.5" /> AI 提取认知
          </Button>
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
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
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
          icon={<BookOpen className="h-8 w-8 text-cognition" />}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="flex flex-col" hover>
              <div className="mb-3 flex items-center justify-between">
                <Badge color={c.type as any}>{COGNITION_TYPES[c.type].label}</Badge>
                <span className="text-[10px] text-muted-foreground">{formatTime(c.createdAt)}</span>
              </div>
              <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
            </Card>
          ))}
        </div>
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

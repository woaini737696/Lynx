"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowRight, Moon, Trash2, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { SearchInput, FilterSelect, Pagination, useClientPagination } from "@/components/ui/ListControls";

interface Idea {
  id: string;
  content: string;
  source: string;
  createdAt: string;
}

const COLUMNS = [
  { key: "northstar", label: "北极星", color: "text-northstar", bg: "bg-northstar/10", border: "border-northstar/30" },
  { key: "campaign", label: "战役", color: "text-campaign", bg: "bg-campaign/10", border: "border-campaign/30" },
  { key: "task", label: "任务", color: "text-task", bg: "bg-task/10", border: "border-task/30" },
] as const;

export default function ConvergePage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [initialCount, setInitialCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [abandoning, setAbandoning] = useState<Idea | null>(null);
  const [reason, setReason] = useState("");
  const [condition, setCondition] = useState("");
  const [now, setNow] = useState(new Date());

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTime, setFilterTime] = useState<"all" | "today" | "7days">("all");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/ideas");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          const list = data.ideas || [];
          setIdeas(list);
          setInitialCount((prev) => (prev === 0 ? list.length : prev));
        }
      } catch (e) {
        if (!mounted) return;
        console.error(e);
        toast("加载灵感失败", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const board = async (idea: Idea, column: typeof COLUMNS[number]["key"]) => {
    setProcessing(idea.id);
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "board", column }),
      });
      if (res.ok) {
        setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
        setExpanding(null);
        toast(`已归位${COLUMNS.find((c) => c.key === column)?.label}`, "success");
      } else if (res.status === 409) {
        const err = await res.json();
        toast(err.error || "该列已满", "error");
      } else {
        toast("归位失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
    setProcessing(null);
  };

  const abandon = async () => {
    if (!abandoning) return;
    if (!reason.trim() || !condition.trim()) {
      toast("原因和复活条件都必须填写", "error");
      return;
    }
    setProcessing(abandoning.id);
    try {
      const res = await fetch(`/api/ideas/${abandoning.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abandon", reason, reviveCondition: condition }),
      });
      if (res.ok) {
        setIdeas((prev) => prev.filter((i) => i.id !== abandoning.id));
        setAbandoning(null);
        setReason("");
        setCondition("");
        toast("已安葬灵感", "success");
      } else {
        toast("放弃失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
    setProcessing(null);
  };

  const filtered = useMemo(() => {
    return ideas.filter((idea) => {
      if (searchQuery && !idea.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterTime !== "all") {
        const created = new Date(idea.createdAt).getTime();
        const elapsed = now.getTime() - created;
        const dayMs = 24 * 60 * 60 * 1000;
        if (filterTime === "today" && elapsed > dayMs) return false;
        if (filterTime === "7days" && elapsed > 7 * dayMs) return false;
      }
      return true;
    });
  }, [ideas, searchQuery, filterTime, now]);

  const { page, pageSize, total: pageTotal, paginated, onPageChange, onPageSizeChange } = useClientPagination(filtered);

  const isConvergeTime = now.getHours() >= 23 || now.getHours() < 6;
  const total = initialCount;
  const done = total - ideas.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 rounded-3xl border border-northstar/20 bg-gradient-to-br from-northstar/10 to-transparent p-5 text-center sm:p-8">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-northstar/10 text-northstar">
          <Moon className="h-6 w-6" />
        </div>
        <div className="mb-2 text-xs tracking-widest text-northstar">灵感收敛</div>
        <h1 className="text-xl font-semibold sm:text-2xl">
          {ideas.length === 0 ? "今日已收敛" : `还有 ${ideas.length} 条灵感待收敛`}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          {ideas.length === 0 ? "今天的输入都已归位，可以安心休息了" : "逐条决定：归位看板 或 送入墓地"}
        </p>
        {total > 0 && (
          <div className="mx-auto mt-4 max-w-md">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>已完成 {done}/{total}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-muted/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingState title="灵感收敛" />
      ) : ideas.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="收敛完成"
          description="Inbox 已清空，灵感各有归处"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索灵感内容..." className="max-w-xs" />
            <FilterSelect
              value={filterTime}
              onChange={setFilterTime}
              options={[
                { value: "all", label: "全部时间" },
                { value: "today", label: "今天" },
                { value: "7days", label: "最近 7 天" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-3">
            {paginated.map((idea, i) => {
              const isExpanding = expanding === idea.id;
              return (
                <Card key={idea.id} className="p-0 overflow-hidden" hover>
                  <div className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                    <span className="hidden w-6 text-right text-[11px] text-muted-foreground/60 sm:block">
                      {(page - 1) * pageSize + i + 1}/{filtered.length}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm leading-relaxed">{idea.content}</div>
                      <div className="mt-1.5 text-[10px] text-muted-foreground/80">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-1.5 py-0.5">
                          {idea.source === "lightning" ? "⚡ 闪电输入" : "💬 对话提取"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isExpanding ? (
                        <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                          {COLUMNS.map((col) => (
                            <button
                              key={col.key}
                              onClick={() => board(idea, col.key)}
                              disabled={processing === idea.id}
                              className={`rounded-lg border ${col.border} ${col.bg} ${col.color} px-2 py-1 text-[10px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50`}
                            >
                              {col.label}
                            </button>
                          ))}
                          <button
                            onClick={() => setExpanding(null)}
                            className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setExpanding(idea.id)} disabled={processing === idea.id} className="h-8">
                            <ArrowRight className="h-3 w-3" /> 归位
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAbandoning(idea)} disabled={processing === idea.id} className="h-8 text-graveyard hover:bg-graveyard/10 hover:text-graveyard">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
              没有匹配的灵感
            </div>
          )}

          <Pagination page={page} pageSize={pageSize} total={pageTotal} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />

          {isConvergeTime && (
            <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-xs text-destructive">
              收敛时间（23:00-06:00）· 必须处理完所有 {ideas.length} 条才能休息
            </div>
          )}
        </>
      )}

      {abandoning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md" onClick={() => setAbandoning(null)}>
          <div className="w-full max-w-md rounded-3xl border border-graveyard/30 bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2 text-graveyard">
              <Trash2 className="h-4 w-4" />
              <span className="text-sm font-semibold">送入灵感墓地</span>
            </div>
            <p className="mb-4 rounded-xl bg-muted/50 p-2 text-sm text-foreground/80">{abandoning.content}</p>
            <div className="mb-3 space-y-1">
              <label className="text-[11px] text-muted-foreground">放弃原因（必填）</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[72px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-graveyard" placeholder="为什么放弃..." />
            </div>
            <div className="mb-4 space-y-1">
              <label className="text-[11px] text-muted-foreground">复活条件（必填）</label>
              <textarea value={condition} onChange={(e) => setCondition(e.target.value)} className="min-h-[72px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-graveyard" placeholder="什么条件下复活..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setAbandoning(null); setReason(""); setCondition(""); }}>取消</Button>
              <Button size="sm" variant="danger" onClick={abandon} disabled={processing === abandoning.id}>
                {processing === abandoning.id ? "处理中..." : "送入墓地"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

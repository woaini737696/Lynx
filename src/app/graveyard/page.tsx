"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Skull, X, Eye } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { PageHeader, Card, Button, Badge, LoadingState } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";

interface GraveyardItem {
  id: string;
  ideaId: string;
  content: string;
  reason: string;
  reviveCondition: string;
  revivedAt?: string;
  createdAt: string;
  abandonedAt: string;
}

export default function GraveyardPage() {
  const [items, setItems] = useState<GraveyardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revivingId, setRevivingId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<GraveyardItem | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/graveyard");
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (e) {
        if (!mounted) return;
        console.error(e);
        toast("加载灵感墓地失败", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const revive = async (graveyardId: string) => {
    setRevivingId(graveyardId);
    try {
      const res = await fetch("/api/graveyard", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graveyardId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "复活失败");
      }
      setItems((prev) => prev.filter((it) => it.id !== graveyardId));
      setDetailItem(null);
      toast("灵感已复活，回到 Inbox", "success");
    } catch {
      toast("复活失败", "error");
    } finally {
      setRevivingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="灵感墓地"
        subtitle="记录放弃原因和复活条件，时机成熟可一键复活"
      />

      {loading ? (
        <LoadingState title="灵感墓地" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Skull}
          title="墓地空空如也"
          description="暂时没有放弃的灵感"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col"
              hover
              onClick={() => setDetailItem(item)}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <Badge color="graveyard">已放弃</Badge>
                <span className="text-[10px] text-muted-foreground">
                  {formatTime(item.abandonedAt)}放弃
                </span>
              </div>
              <p className="mb-4 line-clamp-3 text-sm font-medium leading-relaxed">
                {item.content || "无内容"}
              </p>

              <div className="space-y-2">
                <div className="rounded-xl bg-graveyard/5 p-2.5">
                  <div className="mb-0.5 text-[10px] text-graveyard/80">放弃原因</div>
                  <div className="line-clamp-2 text-xs text-foreground/80">{item.reason}</div>
                </div>
                <div className="rounded-xl bg-northstar/5 p-2.5">
                  <div className="mb-0.5 text-[10px] text-northstar/80">复活条件</div>
                  <div className="line-clamp-2 text-xs text-foreground/80">{item.reviveCondition}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailItem(item);
                  }}
                  className="flex-1"
                >
                  <Eye className="h-3 w-3" /> 查看详情
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    revive(item.id);
                  }}
                  disabled={revivingId === item.id}
                  className="flex-1"
                >
                  <RefreshCw className={`h-3 w-3 ${revivingId === item.id ? "animate-spin" : ""}`} />
                  {revivingId === item.id ? "复活中..." : "复活"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {detailItem && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-3xl border border-graveyard/30 bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-graveyard">
                <Skull className="h-4 w-4" />
                <span className="text-sm font-semibold">灵感墓地详情</span>
              </div>
              <button
                onClick={() => setDetailItem(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-2xl bg-muted/40 p-4">
              <div className="mb-1.5 text-[11px] text-muted-foreground">原始灵感</div>
              <p className="text-sm leading-relaxed">{detailItem.content || "无内容"}</p>
            </div>

            <div className="mb-3 space-y-3">
              <div className="rounded-xl bg-graveyard/5 p-3">
                <div className="mb-1 text-[11px] text-graveyard/80">放弃原因</div>
                <div className="text-sm text-foreground/80">{detailItem.reason}</div>
              </div>
              <div className="rounded-xl bg-northstar/5 p-3">
                <div className="mb-1 text-[11px] text-northstar/80">复活条件</div>
                <div className="text-sm text-foreground/80">{detailItem.reviveCondition}</div>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span>创建于 {formatTime(detailItem.createdAt)}</span>
              <span>放弃于 {formatTime(detailItem.abandonedAt)}</span>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setDetailItem(null)}>
                关闭
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => revive(detailItem.id)}
                disabled={revivingId === detailItem.id}
              >
                <RefreshCw className={`h-3 w-3 ${revivingId === detailItem.id ? "animate-spin" : ""}`} />
                {revivingId === detailItem.id ? "复活中..." : "复活到 Inbox"}
              </Button>
            </div>
          </div>
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

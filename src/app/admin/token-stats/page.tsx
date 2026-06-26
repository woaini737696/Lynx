"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Coins, TrendingUp, TrendingDown, Calendar, Infinity as InfinityIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Card, Button, LoadingState, Badge } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";

interface TokenSummary {
  tokens: number;
  count: number;
}

interface TokenRecord {
  id: string;
  tokens: number;
  provider: string | null;
  model: string | null;
  durationMs: number | null;
  createdAt: string;
  sessionId: string;
  sessionTitle: string;
  username: string | null;
}

interface ProviderStat {
  provider: string;
  tokens: number;
  count: number;
}

interface TokenStatsData {
  summary: {
    today: TokenSummary;
    yesterday: TokenSummary;
    last7Days: TokenSummary;
    total: TokenSummary;
  };
  byProvider: ProviderStat[];
  records: TokenRecord[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

const PAGE_SIZE = 30;

/** 格式化 Token 数（千分位 + k 简写） */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return n.toLocaleString();
}

/** 格式化耗时（毫秒 → 秒） */
function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** 格式化时间（YYYY-MM-DD HH:mm） */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PROVIDER_BADGE: Record<string, { color: "cognition" | "campaign" | "northstar" | "default" }> = {
  deepseek: { color: "cognition" },
  mimo: { color: "campaign" },
  hermes: { color: "northstar" },
};

export default function TokenStatsPage() {
  const [data, setData] = useState<TokenStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (off: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/token-stats?limit=${PAGE_SIZE}&offset=${off}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "加载失败");
      }
      const json = (await res.json()) as TokenStatsData;
      setData(json);
    } catch (e) {
      toast("加载 Token 统计失败：" + (e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(offset);
  }, [offset, load]);

  if (loading && !data) {
    return <LoadingState title="词元统计" />;
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-8">
        <PageHeader title="词元统计" subtitle="加载失败" />
      </div>
    );
  }

  const { summary, byProvider, records, pagination } = data;
  const todayVsYesterday = summary.yesterday.tokens > 0
    ? ((summary.today.tokens - summary.yesterday.tokens) / summary.yesterday.tokens) * 100
    : null;

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="词元统计"
        subtitle="AI 模型 Token 消耗记录与统计"
        action={<HelpButton contentKey="admin-token-stats" />}
      />

      {/* ===== 顶部 4 个统计卡片 ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 今日消耗 */}
        <Card className="border-northstar/20 bg-northstar/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">今日消耗</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatTokens(summary.today.tokens)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {summary.today.count} 次对话
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-northstar/10 text-northstar">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          {todayVsYesterday != null && (
            <div className="mt-2 flex items-center gap-1 text-[10px]">
              {todayVsYesterday >= 0 ? (
                <TrendingUp className="h-3 w-3 text-graveyard" />
              ) : (
                <TrendingDown className="h-3 w-3 text-campaign" />
              )}
              <span className={todayVsYesterday >= 0 ? "text-graveyard" : "text-campaign"}>
                {todayVsYesterday >= 0 ? "+" : ""}{todayVsYesterday.toFixed(1)}% vs 昨日
              </span>
            </div>
          )}
        </Card>

        {/* 昨日消耗 */}
        <Card className="border-campaign/20 bg-campaign/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">昨日消耗</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatTokens(summary.yesterday.tokens)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {summary.yesterday.count} 次对话
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-campaign/10 text-campaign">
              <Coins className="h-5 w-5" />
            </div>
          </div>
        </Card>

        {/* 近 7 天消耗 */}
        <Card className="border-cognition/20 bg-cognition/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">近 7 天消耗</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatTokens(summary.last7Days.tokens)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {summary.last7Days.count} 次对话 · 日均 {formatTokens(Math.round(summary.last7Days.tokens / 7))}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cognition/10 text-cognition">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </Card>

        {/* 累计消耗 */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">累计消耗</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {formatTokens(summary.total.tokens)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {summary.total.count} 次对话
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
              <InfinityIcon className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* ===== Provider 分布（近 7 天）===== */}
      {byProvider.length > 0 && (
        <Card className="mt-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Provider 分布（近 7 天）
          </h3>
          <div className="space-y-2">
            {byProvider.map((p) => {
              const total = byProvider.reduce((s, x) => s + x.tokens, 0) || 1;
              const percent = (p.tokens / total) * 100;
              const badge = PROVIDER_BADGE[p.provider] || { color: "default" as const };
              return (
                <div key={p.provider} className="flex items-center gap-3">
                  <div className="w-20 shrink-0">
                    <Badge color={badge.color}>{p.provider}</Badge>
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-cognition transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="w-32 shrink-0 text-right text-xs text-muted-foreground">
                    {formatTokens(p.tokens)} · {p.count} 次
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ===== 消耗记录列表 ===== */}
      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            消耗记录
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              共 {pagination.total} 条
            </span>
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(offset)}
            disabled={loading}
            title="刷新"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "刷新"}
          </Button>
        </div>

        {records.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            暂无 Token 消耗记录
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">时间</th>
                    <th className="px-2 py-2 font-medium">Provider</th>
                    <th className="px-2 py-2 font-medium">模型</th>
                    <th className="px-2 py-2 text-right font-medium">Tokens</th>
                    <th className="px-2 py-2 text-right font-medium">耗时</th>
                    <th className="px-2 py-2 font-medium">会话</th>
                    <th className="px-2 py-2 font-medium">用户</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {records.map((r) => {
                    const badge = PROVIDER_BADGE[r.provider || ""];
                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                          {formatTime(r.createdAt)}
                        </td>
                        <td className="px-2 py-2">
                          {r.provider ? (
                            <Badge color={badge?.color}>{r.provider}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {r.model || "-"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-medium text-foreground">
                          {r.tokens.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right text-muted-foreground">
                          {formatDuration(r.durationMs)}
                        </td>
                        <td className="max-w-[200px] truncate px-2 py-2 text-muted-foreground" title={r.sessionTitle}>
                          {r.sessionTitle}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                          {r.username || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-[10px] text-muted-foreground">
                第 {offset + 1} - {Math.min(offset + records.length, pagination.total)} 条 / 共 {pagination.total} 条
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0 || loading}
                >
                  <ChevronLeft className="h-3 w-3" /> 上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={!pagination.hasMore || loading}
                >
                  下一页 <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

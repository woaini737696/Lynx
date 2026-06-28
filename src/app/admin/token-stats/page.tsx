"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Coins, TrendingUp, TrendingDown, Calendar, Infinity as InfinityIcon, ChevronLeft, ChevronRight, Trophy, Users, X } from "lucide-react";
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

interface UserStat {
  userId: string;
  username: string;
  displayName: string;
  tokens: number;
  count: number;
}

interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  profession: string | null;
  totalTokens: number;
  totalCount: number;
}

interface NullUserStats {
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
  byUser: UserStat[];
  records: TokenRecord[];
  users: UserInfo[];
  nullUser: NullUserStats;
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

const PAGE_SIZE = 30;

/** 格式化词元数（千分位 + k/M 简写） */
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

const RANK_COLORS = [
  "text-yellow-500",   // 第 1 名 金色
  "text-gray-400",     // 第 2 名 银色
  "text-orange-600 dark:text-orange-400",   // 第 3 名 铜色
];

export default function TokenStatsPage() {
  const [data, setData] = useState<TokenStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const load = useCallback(async (off: number, userId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/token-stats?limit=${PAGE_SIZE}&offset=${off}&userId=${userId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "加载失败");
      }
      const json = (await res.json()) as TokenStatsData;
      setData(json);
    } catch (e) {
      toast("加载词元统计失败：" + (e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(offset, selectedUserId);
  }, [offset, selectedUserId, load]);

  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    setOffset(0);
  };

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

  const { summary, byProvider, byUser, records, users, pagination, nullUser } = data;
  const todayVsYesterday = summary.yesterday.tokens > 0
    ? ((summary.today.tokens - summary.yesterday.tokens) / summary.yesterday.tokens) * 100
    : null;

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="词元统计"
        subtitle="AI 模型词元消耗记录与统计"
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowLeaderboard(true)}
              className="gap-1.5"
            >
              <Trophy className="h-3.5 w-3.5" />
              词元排行榜
            </Button>
            <HelpButton contentKey="admin-token-stats" />
          </div>
        }
      />

      {/* ===== 用户切换器 ===== */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>查看用户：</span>
          </div>
          <select
            value={selectedUserId}
            onChange={(e) => handleUserChange(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">全部用户（{users.length}）</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}{u.displayName ? ` (${u.displayName})` : ""}{u.profession ? ` · ${u.profession}` : ""}
                {u.totalCount > 0 ? ` · ${u.totalCount} 条` : " · 无记录"}
              </option>
            ))}
            {nullUser.count > 0 && (
              <option value="__null__">未知用户（历史数据）· {nullUser.count} 条</option>
            )}
          </select>
          {selectedUserId !== "all" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleUserChange("all")}
              className="h-7 px-2 text-[11px]"
            >
              <X className="h-3 w-3" />
              清除筛选
            </Button>
          )}
        </div>
      </Card>

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
        <Card>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl ios-glass-sm text-muted-foreground">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
        </Card>

        {/* 近 7 天 */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">近 7 天</p>
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

        {/* 累计 */}
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-campaign/10 text-campaign">
              <InfinityIcon className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* ===== Provider 分布 + 用户排行简览 ===== */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Provider 分布（近 7 天） */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Provider 分布（近 7 天）</h3>
          {byProvider.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {byProvider.map((p) => {
                const maxTokens = byProvider[0]?.tokens || 1;
                const pct = (p.tokens / maxTokens) * 100;
                const badge = PROVIDER_BADGE[p.provider] || { color: "default" as const };
                return (
                  <div key={p.provider}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Badge color={badge.color}>{p.provider}</Badge>
                        <span className="text-muted-foreground">{p.count} 次</span>
                      </div>
                      <span className="font-medium text-foreground">{formatTokens(p.tokens)} 词元</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full ios-glass-sm">
                      <div
                        className="h-full rounded-full bg-cognition transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 用户排行简览（近 7 天 Top 5） */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">用户排行（近 7 天 Top 5）</h3>
            <button
              onClick={() => setShowLeaderboard(true)}
              className="text-[11px] text-primary hover:underline"
            >
              查看全部 →
            </button>
          </div>
          {byUser.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-1.5">
              {byUser.slice(0, 5).map((u, i) => (
                <div key={u.userId} className="flex items-center gap-2 text-xs">
                  <span className={`w-5 text-center font-bold ${RANK_COLORS[i] || "text-muted-foreground"}`}>
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate font-medium text-foreground">
                    {u.username}
                    {u.displayName ? ` · ${u.displayName}` : ""}
                  </span>
                  <span className="text-muted-foreground">{u.count} 次</span>
                  <span className="font-medium text-foreground">{formatTokens(u.tokens)} 词元</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ===== 消耗记录表格 ===== */}
      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">消耗记录</h3>
          <p className="text-[11px] text-muted-foreground">
            共 {pagination.total} 条
            {selectedUserId !== "all" && "（已筛选用户）"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border ios-glass-sm text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">时间</th>
                <th className="px-3 py-2 text-left font-medium">Provider</th>
                <th className="px-3 py-2 text-left font-medium">模型</th>
                <th className="px-3 py-2 text-right font-medium">词元</th>
                <th className="px-3 py-2 text-right font-medium">耗时</th>
                <th className="px-3 py-2 text-left font-medium">会话</th>
                <th className="px-3 py-2 text-left font-medium">用户</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    {selectedUserId === "all"
                      ? "暂无词元消耗记录"
                      : selectedUserId === "__null__"
                        ? "历史数据中无词元消耗记录"
                        : "该用户暂无词元消耗记录（仅统计 assistant 消息且 tokens > 0）"}
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const badge = r.provider ? PROVIDER_BADGE[r.provider] : null;
                  return (
                    <tr key={r.id} className="hover:bg-primary/10 hover:text-primary">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {formatTime(r.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        {r.provider && badge ? (
                          <Badge color={badge.color}>{r.provider}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-muted-foreground">
                        {r.model || "-"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-foreground">
                        {formatTokens(r.tokens)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground">
                        {formatDuration(r.durationMs)}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground">
                        {r.sessionTitle}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {r.username || "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <span className="text-[11px] text-muted-foreground">
            第 {offset + 1} - {Math.min(offset + records.length, pagination.total)} 条 / 共 {pagination.total} 条
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="h-7 px-2"
            >
              <ChevronLeft className="h-3 w-3" />
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!pagination.hasMore || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="h-7 px-2"
            >
              下一页
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </Card>

      {/* ===== 词元排行榜弹窗 ===== */}
      {showLeaderboard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl glass-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <h2 className="text-sm font-semibold text-foreground">词元消耗排行榜</h2>
                <span className="text-[11px] text-muted-foreground">（近 7 天）</span>
              </div>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {byUser.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">暂无排行数据</p>
              ) : (
                <div className="space-y-2">
                  {byUser.map((u, i) => (
                    <div
                      key={u.userId}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${
                        i < 3 ? "border-yellow-500/30 bg-yellow-500/5" : "border-border bg-background"
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        i === 0 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                        : i === 1 ? "bg-gray-400/20 text-gray-500 dark:text-gray-300"
                        : i === 2 ? "bg-orange-700/20 text-orange-600 dark:text-orange-400"
                        : "ios-glass-sm text-muted-foreground"
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {u.username}
                          {u.displayName ? ` · ${u.displayName}` : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {u.count} 次对话 · 日均 {formatTokens(Math.round(u.tokens / 7))} 词元
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{formatTokens(u.tokens)}</p>
                        <p className="text-[10px] text-muted-foreground">词元</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

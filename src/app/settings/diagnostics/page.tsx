"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Database,
  Brain,
  Clock,
  Cpu,
  HardDrive,
  Zap,
  RefreshCw,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Layers,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface Diagnostics {
  timestamp: string;
  apiDurationMs: number;
  db: {
    status: string;
    counts: Record<string, number>;
    distributions: {
      ideaStatus: Array<{ status: string; _count: number }>;
      taskStatus: Array<{ status: string; _count: number }>;
      taskColumn: Array<{ column: string; _count: number }>;
    };
  };
  embedding: {
    mode: string;
    cacheTotal: number;
    cacheByProvider: Record<string, number>;
  };
  scheduler: {
    running: boolean;
    scheduledCount: number;
    jobs: Array<{ flowId: string; flowName: string; timeStr: string }>;
  };
  system: {
    uptimeSeconds: number;
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    nodeVersion: string;
    platform: string;
  };
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days}天 ${hours}时 ${mins}分`;
  if (hours > 0) return `${hours}时 ${mins}分 ${secs}秒`;
  if (mins > 0) return `${mins}分 ${secs}秒`;
  return `${secs}秒`;
}

const TABLE_LABELS: Record<string, string> = {
  ideas: "灵感",
  tasks: "任务",
  conversations: "对话资产",
  cognitions: "认知",
  memories: "记忆节点",
  skills: "技能",
  skillVersions: "技能版本",
  skillReviews: "技能评分",
  larkTasks: "飞书任务",
  larkTaskComments: "任务评论",
  larkWebhookEvents: "Webhook 事件",
  chatSessions: "对话会话",
  chatMessages: "对话消息",
  embeddingCache: "Embedding 缓存",
};

export default function DiagnosticsPage() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 404 监控相关状态
  const [nfData, setNfData] = useState<{
    logs: Array<{
      id: string;
      path: string;
      method: string;
      referer: string | null;
      ip: string | null;
      timestamp: number;
    }>;
    stats: {
      total: number;
      uniquePaths: number;
      topPaths: Array<{ path: string; count: number; lastSeen: number }>;
    };
  } | null>(null);
  const [nfLoading, setNfLoading] = useState(false);
  const [nfClearing, setNfClearing] = useState(false);

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/diagnostics");
      if (!res.ok) throw new Error(`加载失败（${res.status}）`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 拉取 404 监控数据
  const fetchNotFoundData = useCallback(async () => {
    setNfLoading(true);
    try {
      const res = await fetch("/api/health/404s?limit=30");
      if (!res.ok) throw new Error(`404 日志加载失败（${res.status}）`);
      const json = await res.json();
      setNfData({
        logs: json.logs || [],
        stats: json.stats || { total: 0, uniquePaths: 0, topPaths: [] },
      });
    } catch {
      // 静默失败
    } finally {
      setNfLoading(false);
    }
  }, []);

  // 清空 404 日志（仅 admin）
  const clearNotFoundLogs = useCallback(async () => {
    setNfClearing(true);
    try {
      const res = await fetch("/api/health/404s", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "清空失败", "error");
      } else {
        toast(`已清空 ${json.cleared} 条 404 日志`, "success");
        await fetchNotFoundData();
      }
    } catch (e: any) {
      toast(e.message || "清空失败", "error");
    } finally {
      setNfClearing(false);
    }
  }, [fetchNotFoundData]);

  useEffect(() => {
    fetchDiagnostics();
    fetchNotFoundData();
    // 每 30 秒自动刷新
    const timer = setInterval(() => {
      fetchDiagnostics();
      fetchNotFoundData();
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchDiagnostics, fetchNotFoundData]);

  if (loading && !data) {
    return <LoadingState title="性能监控" />;
  }

  if (error && !data) {
    return (
      <div className="p-4 sm:p-8">
        <PageHeader title="性能监控" subtitle="加载失败" />
        <Card className="mt-4">
          <div className="flex items-center gap-2 text-sm text-graveyard">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
          <Button className="mt-3" onClick={fetchDiagnostics}>
            <RefreshCw className="h-3 w-3" /> 重试
          </Button>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const memUsagePercent = data.system.memory.heapTotal > 0
    ? Math.round((data.system.memory.heapUsed / data.system.memory.heapTotal) * 100)
    : 0;

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="性能监控"
        subtitle="系统运行状态 · 数据库统计 · 资源使用"
        action={
          <div className="flex items-center gap-2">
            <HelpButton contentKey="settings-diagnostics" />
            <Button variant="outline" onClick={fetchDiagnostics} disabled={loading}>
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> 刷新
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* API 响应时间 */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cognition/10">
                <Zap className="h-4 w-4 text-cognition" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">API 响应</span>
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{data.apiDurationMs}ms</div>
          <div className="text-[10px] text-muted-foreground">诊断接口耗时</div>
        </Card>

        {/* 运行时间 */}
        <Card>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-northstar/10">
              <Clock className="h-4 w-4 text-northstar" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">运行时间</span>
          </div>
          <div className="mt-2 text-lg font-bold tabular-nums">{formatUptime(data.system.uptimeSeconds)}</div>
          <div className="text-[10px] text-muted-foreground">Node {data.system.nodeVersion} · {data.system.platform}</div>
        </Card>

        {/* 内存使用 */}
        <Card>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-campaign/10">
              <HardDrive className="h-4 w-4 text-campaign" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">堆内存</span>
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums">
            {data.system.memory.heapUsed}<span className="text-sm text-muted-foreground">/{data.system.memory.heapTotal}MB</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                memUsagePercent > 80 ? "bg-graveyard" : memUsagePercent > 60 ? "bg-campaign" : "bg-task"
              )}
              style={{ width: `${memUsagePercent}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">RSS: {data.system.memory.rss}MB · 使用率 {memUsagePercent}%</div>
        </Card>

        {/* Flows 调度器 */}
        <Card>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-task/10">
              <Activity className="h-4 w-4 text-task" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Flows 调度器</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn(
              "inline-flex h-2 w-2 rounded-full",
              data.scheduler.running ? "bg-task animate-pulse" : "bg-muted-foreground/40"
            )} />
            <span className="text-lg font-bold">{data.scheduler.running ? "运行中" : "未启动"}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">{data.scheduler.scheduledCount} 个定时任务</div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 数据库表计数 */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-cognition" />
            <h2 className="text-sm font-semibold">数据库表统计</h2>
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-task">
              <CheckCircle2 className="h-3 w-3" /> 已连接
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(data.db.counts).map(([key, count]) => (
              <div key={key} className="rounded-lg border border-border bg-muted/30 p-2">
                <div className="text-[10px] text-muted-foreground">{TABLE_LABELS[key] || key}</div>
                <div className="text-lg font-bold tabular-nums">{count}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Embedding 缓存 */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-cognition" />
            <h2 className="text-sm font-semibold">Embedding 缓存</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2">
              <span className="text-xs text-muted-foreground">当前模式</span>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                data.embedding.mode.includes("AI") ? "bg-task/10 text-task" : "bg-campaign/10 text-campaign"
              )}>
                {data.embedding.mode}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2">
              <span className="text-xs text-muted-foreground">缓存总数</span>
              <span className="text-lg font-bold tabular-nums">{data.embedding.cacheTotal}</span>
            </div>
            {Object.entries(data.embedding.cacheByProvider).map(([provider, count]) => (
              <div key={provider} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2">
                <span className="text-xs text-muted-foreground">{provider === "ai" ? "AI 向量" : "TF-IDF"}</span>
                <span className="text-sm font-medium tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 灵感状态分布 */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-northstar" />
            <h2 className="text-sm font-semibold">灵感状态分布</h2>
          </div>
          <div className="space-y-2">
            {data.db.distributions.ideaStatus.map((item) => {
              const total = data.db.counts.ideas || 1;
              const percent = Math.round((item._count / total) * 100);
              const labels: Record<string, string> = { inbox: "收件箱", board: "看板", graveyard: "墓地" };
              const colors: Record<string, string> = { inbox: "bg-northstar", board: "bg-campaign", graveyard: "bg-graveyard" };
              return (
                <div key={item.status}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{labels[item.status] || item.status}</span>
                    <span className="tabular-nums">{item._count} ({percent}%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", colors[item.status] || "bg-muted-foreground")} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 任务看板分布 */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-campaign" />
            <h2 className="text-sm font-semibold">任务看板分布</h2>
          </div>
          <div className="space-y-2">
            {data.db.distributions.taskColumn.map((item) => {
              const total = data.db.counts.tasks || 1;
              const percent = Math.round((item._count / total) * 100);
              const labels: Record<string, string> = { northstar: "北极星", campaign: "战役", task: "任务" };
              const colors: Record<string, string> = { northstar: "bg-northstar", campaign: "bg-campaign", task: "bg-task" };
              return (
                <div key={item.column}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{labels[item.column] || item.column}</span>
                    <span className="tabular-nums">{item._count} ({percent}%)</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", colors[item.column] || "bg-muted-foreground")} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Flows 调度任务列表 */}
      {data.scheduler.jobs.length > 0 && (
        <Card className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-task" />
            <h2 className="text-sm font-semibold">定时调度任务</h2>
          </div>
          <div className="space-y-1">
            {data.scheduler.jobs.map((job, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                <span className="font-medium">{job.flowName}</span>
                <span className="font-mono text-muted-foreground">{job.timeStr}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 404 监控 */}
      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-graveyard" />
            <h2 className="text-sm font-semibold">404 访问监控</h2>
            {nfData && (
              <span className="text-[10px] text-muted-foreground">
                共 {nfData.stats.total} 次 · {nfData.stats.uniquePaths} 个不同路径
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchNotFoundData}
              disabled={nfLoading}
            >
              <RefreshCw className={cn("h-3 w-3", nfLoading && "animate-spin")} />
              刷新
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearNotFoundLogs}
              disabled={nfClearing || !nfData?.stats.total}
            >
              {nfClearing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              清空
            </Button>
          </div>
        </div>

        {nfData?.stats.topPaths && nfData.stats.topPaths.length > 0 ? (
          <>
            {/* Top 404 路径 */}
            <div className="mb-3">
              <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">高频 404 路径</div>
              <div className="space-y-1">
                {nfData.stats.topPaths.slice(0, 5).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-[11px]"
                  >
                    <span className="truncate font-mono text-foreground" title={p.path}>{p.path}</span>
                    <span className="ml-2 shrink-0 rounded-full bg-graveyard/10 px-2 py-0.5 font-medium text-graveyard">
                      {p.count} 次
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 最近的 404 日志 */}
            <div>
              <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">最近 404 访问</div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">路径</th>
                      <th className="px-2 py-1.5 text-left font-medium">IP</th>
                      <th className="px-2 py-1.5 text-right font-medium">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nfData.logs.map((log) => (
                      <tr key={log.id} className="border-t border-border">
                        <td className="px-2 py-1.5 font-mono text-foreground" title={log.path}>
                          <div className="max-w-[280px] truncate">{log.path}</div>
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">{log.ip || "-"}</td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString("zh-CN", { hour12: false })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-task" />
            暂无 404 访问记录
          </div>
        )}
      </Card>

      <div className="mt-4 text-center text-[10px] text-muted-foreground/60">
        最后更新：{new Date(data.timestamp).toLocaleString("zh-CN")} · 每 30 秒自动刷新
      </div>
    </div>
  );
}

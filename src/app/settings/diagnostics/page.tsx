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
} from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
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

  useEffect(() => {
    fetchDiagnostics();
    // 每 30 秒自动刷新
    const timer = setInterval(fetchDiagnostics, 30000);
    return () => clearInterval(timer);
  }, [fetchDiagnostics]);

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
          <Button variant="outline" onClick={fetchDiagnostics} disabled={loading}>
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> 刷新
          </Button>
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

      <div className="mt-4 text-center text-[10px] text-muted-foreground/60">
        最后更新：{new Date(data.timestamp).toLocaleString("zh-CN")} · 每 30 秒自动刷新
      </div>
    </div>
  );
}

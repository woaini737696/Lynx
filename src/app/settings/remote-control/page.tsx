"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Monitor,
  Send,
  Loader2,
  RefreshCw,
  Wifi,
  WifiOff,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface PcSession {
  id: string;
  deviceName: string;
  agentVersion: string;
  capabilities: string[];
  wsChannelId: string;
  status: string;
  authMode: string;
  lastHeartbeat: string;
  createdAt: string;
}

interface RemoteCommandRecord {
  id: string;
  commandId: string;
  command: string;
  targetDeviceId: string | null;
  source: string;
  status: string;
  route: string;
  result: unknown;
  error: string | null;
  durationMs: number | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "待执行", color: "text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
  dispatched: { label: "已下发", color: "text-campaign", icon: <Send className="h-3 w-3" /> },
  executing: { label: "执行中", color: "text-campaign", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed: { label: "已完成", color: "text-task", icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: "失败", color: "text-graveyard", icon: <XCircle className="h-3 w-3" /> },
  offline: { label: "离线", color: "text-muted-foreground", icon: <WifiOff className="h-3 w-3" /> },
};

export default function RemoteControlPage() {
  const [sessions, setSessions] = useState<PcSession[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<RemoteCommandRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/pc-sessions?includeOffline=true");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        // 自动选择第一个在线设备
        const online = (data.sessions || []).find((s: PcSession) => s.status === "online");
        if (online && !selectedDevice) {
          setSelectedDevice(online.wsChannelId);
        }
      }
    } catch (e: any) {
      toast("加载 PC 设备列表失败", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedDevice]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/hermes/remote-command?list=1&limit=20");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.commands || []);
      }
    } catch {
      // 静默失败
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadHistory();
    // 每 15 秒刷新设备列表
    const timer = setInterval(loadSessions, 15_000);
    return () => clearInterval(timer);
  }, [loadSessions, loadHistory]);

  const handleSend = async () => {
    const cmd = command.trim();
    if (!cmd) {
      toast("请输入指令内容", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/hermes/remote-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: cmd,
          targetDeviceId: selectedDevice,
          source: "web",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast("指令已下发到 PC", "success");
        setCommand("");
        // 延迟刷新历史
        setTimeout(loadHistory, 1000);
      } else {
        toast(data.error || "下发失败", "error");
      }
    } catch (e: any) {
      toast("请求失败：" + e.message, "error");
    } finally {
      setSending(false);
    }
  };

  const onlineCount = sessions.filter((s) => s.status === "online").length;

  if (loading) {
    return <LoadingState title="远程操控" />;
  }

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="远程操控"
        subtitle={`通过手机/Web 远程控制你的 PC · 在线设备 ${onlineCount} 台`}
        action={<HelpButton contentKey="remote-control" />}
      />

      {/* PC 设备列表 */}
      <Card className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-northstar" />
            <h2 className="text-sm font-semibold">PC 设备列表</h2>
            <span className="text-[11px] text-muted-foreground">
              ({onlineCount} 在线 / {sessions.length} 总计)
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={loadSessions} className="gap-1.5">
            <RefreshCw className="h-3 w-3" /> 刷新
          </Button>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            <Monitor className="mx-auto mb-2 h-8 w-8 opacity-30" />
            暂无 PC 设备
            <div className="mt-1 text-[11px]">
              请在电脑上下载并启动奇思桌面端，登录同账号后自动出现在此处
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const isOnline = s.status === "online";
              const isSelected = selectedDevice === s.wsChannelId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => isOnline && setSelectedDevice(s.wsChannelId)}
                  disabled={!isOnline}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors",
                    isSelected
                      ? "border-northstar/50 bg-northstar/5"
                      : isOnline
                      ? "border-border/60 bg-background hover:border-northstar/30"
                      : "border-border/40 bg-muted/20 opacity-60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md",
                      isOnline ? "bg-task/10 text-task" : "bg-muted text-muted-foreground"
                    )}>
                      <Monitor className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{s.deviceName}</span>
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-task">
                            <Wifi className="h-2.5 w-2.5" /> 在线
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <WifiOff className="h-2.5 w-2.5" /> 离线
                          </span>
                        )}
                        {isSelected && (
                          <span className="rounded-full bg-northstar/15 px-1.5 py-0.5 text-[9px] text-northstar">
                            已选中
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        v{s.agentVersion} · {s.authMode === "approve" ? "弹窗审批" : s.authMode === "once" ? "一次授权" : "免审批"}
                        · 最后心跳 {new Date(s.lastHeartbeat).toLocaleString("zh-CN", { hour12: false })}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* 指令输入 */}
      <Card className="mb-5">
        <div className="mb-3 flex items-center gap-2">
          <Send className="h-4 w-4 text-campaign" />
          <h2 className="text-sm font-semibold">下发远程指令</h2>
          {selectedDevice && (
            <span className="text-[11px] text-muted-foreground">
              → {sessions.find((s) => s.wsChannelId === selectedDevice)?.deviceName || "默认设备"}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !sending) handleSend();
            }}
            placeholder="输入指令，如：打开浏览器访问 github.com / 创建灵感：xxx / 截图保存到桌面"
            className="flex-1 rounded-md border border-border/60 bg-background px-3 py-2 text-xs"
            disabled={sending || onlineCount === 0}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !command.trim() || onlineCount === 0}
            className="gap-1.5"
          >
            {sending ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> 下发中...</>
            ) : (
              <><Send className="h-3 w-3" /> 下发指令</>
            )}
          </Button>
        </div>

        {onlineCount === 0 && (
          <div className="mt-2 text-[11px] text-graveyard">
            ⚠ 没有在线的 PC 设备，请先在电脑上启动桌面端
          </div>
        )}

        {/* 快捷指令 */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            "打开浏览器访问 github.com",
            "截图保存到桌面",
            "查看今天北京天气",
            "创建灵感：测试远程指令",
          ].map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setCommand(ex)}
              disabled={sending}
              className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-campaign/40 hover:text-campaign disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </Card>

      {/* 指令历史 */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">指令历史</h2>
            <span className="text-[11px] text-muted-foreground">最近 20 条</span>
          </div>
          <Button size="sm" variant="ghost" onClick={loadHistory} disabled={historyLoading} className="gap-1.5">
            {historyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            刷新
          </Button>
        </div>

        {history.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">暂无指令记录</div>
        ) : (
          <div className="space-y-2">
            {history.map((cmd) => {
              const statusInfo = STATUS_LABELS[cmd.status] || STATUS_LABELS.pending;
              return (
                <div
                  key={cmd.id}
                  className="rounded-md border border-border/60 bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", statusInfo.color)}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {cmd.source === "android" ? <Smartphone className="inline h-2.5 w-2.5" /> : null}
                          {new Date(cmd.createdAt).toLocaleString("zh-CN", { hour12: false })}
                        </span>
                        {cmd.route && cmd.route !== "pending" && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            {cmd.route}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs text-foreground" title={cmd.command}>
                        {cmd.command}
                      </div>
                      {cmd.error && (
                        <div className="mt-1 text-[11px] text-graveyard">⚠ {cmd.error}</div>
                      )}
                      {cmd.result != null && (
                        <pre className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-1.5 text-[10px] text-foreground">
                          {typeof cmd.result === "string" ? cmd.result : JSON.stringify(cmd.result, null, 2)}
                        </pre>
                      )}
                    </div>
                    {cmd.durationMs && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {(cmd.durationMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

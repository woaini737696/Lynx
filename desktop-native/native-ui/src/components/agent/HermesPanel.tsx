import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Loader2,
  Power,
  PowerOff,
  Download,
  AlertCircle,
  CheckCircle2,
  Terminal,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { invoke } from "@/lib/tauri";
import type { AgentStatus } from "@/types/api";
import type { AgentInstallState, AgentLogEntry } from "@/types/agent";

export function HermesPanel() {
  const queryClient = useQueryClient();
  const [logs] = useState<AgentLogEntry[]>([]);

  const { data: status } = useQuery<AgentStatus>({
    queryKey: ["agent-status"],
    queryFn: async () => invoke<AgentStatus>("get_agent_status"),
    refetchInterval: 5000,
  });

  const installMutation = useMutation({
    mutationFn: () => invoke<{ success: boolean; message?: string }>("install_ai_env"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-status"] }),
  });

  const startMutation = useMutation({
    mutationFn: () => invoke<void>("start_hermes_agent"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-status"] }),
  });

  const getInstallState = (): AgentInstallState => {
    if (installMutation.isPending) return "installing";
    if (startMutation.isPending) return "starting";
    if (!status) return "unknown";
    if (status.wsConnected) return "running";
    return status.hasToken ? "installed" : "not_installed";
  };

  const state = getInstallState();

  const stateConfig: Record<AgentInstallState, { label: string; color: string; icon: React.ElementType }> = {
    unknown: { label: "检测中", color: "text-muted-foreground", icon: Loader2 },
    not_installed: { label: "未安装", color: "text-muted-foreground", icon: PowerOff },
    installing: { label: "安装中", color: "text-primary", icon: Loader2 },
    installed: { label: "已安装", color: "text-task", icon: CheckCircle2 },
    starting: { label: "启动中", color: "text-primary", icon: Loader2 },
    running: { label: "运行中", color: "text-task", icon: Power },
    error: { label: "异常", color: "text-destructive", icon: AlertCircle },
  };

  const StateIcon = stateConfig[state].icon;

  return (
    <div className="ios-glass flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">HermesAgent</h3>
            <p className="text-xs text-muted-foreground">本地超级助理 · 一键部署</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-1.5 text-sm font-medium", stateConfig[state].color)}>
          <StateIcon className={cn("h-4 w-4", state === "installing" || state === "starting" || state === "unknown" ? "animate-spin" : "")} />
          {stateConfig[state].label}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-muted/50 px-3 py-2">
          <span className="text-muted-foreground">版本</span>
          <p className="font-medium text-foreground">{status?.version || "—"}</p>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2">
          <span className="text-muted-foreground">授权模式</span>
          <p className="font-medium text-foreground">
            {status?.authMode === "approve" ? "弹窗审批" : status?.authMode === "once" ? "一次性" : "免审批"}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {state === "not_installed" || state === "error" ? (
          <button
            onClick={() => installMutation.mutate()}
            disabled={installMutation.isPending}
            className="btn-primary-glass flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
          >
            {installMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            一键安装
          </button>
        ) : state === "running" ? (
          <button
            disabled
            className="btn-glass flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
          >
            <CheckCircle2 className="h-4 w-4" /> 运行中
          </button>
        ) : (
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="btn-primary-glass flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
          >
            {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            启动 HermesAgent
          </button>
        )}
      </div>

      {logs.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-black/40 p-3 font-mono text-xs">
          <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" /> 日志
          </div>
          <div className="flex max-h-32 flex-col gap-1 overflow-auto">
            {logs.map((log, i) => (
              <span
                key={i}
                className={cn(
                  "break-all",
                  log.level === "error" && "text-destructive",
                  log.level === "warn" && "text-amber-400",
                  log.level === "info" && "text-foreground/70"
                )}
              >
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

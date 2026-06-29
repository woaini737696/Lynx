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
  Shield,
  ShieldAlert,
  ShieldCheck,
  FolderPlus,
  Trash2,
  Wifi,
  WifiOff,
  OctagonAlert,
  Globe,
  FileText,
  Monitor,
  Cpu,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { invoke } from "@/lib/tauri";
import { toast } from "@/lib/toast";
import type { AgentStatus } from "@/types/api";

const AUTH_MODES = [
  {
    key: "approve",
    label: "弹窗审批",
    desc: "每次本地操作前弹出授权窗口",
    icon: ShieldAlert,
  },
  {
    key: "once",
    label: "一次性授权",
    desc: "同一会话内首次审批，后续放行",
    icon: Shield,
  },
  {
    key: "free",
    label: "免审批仅记录",
    desc: "自动执行并记录日志",
    icon: ShieldCheck,
  },
] as const;

// 核心能力清单
const CAPABILITIES = [
  { key: "browser", label: "浏览器自动化", desc: "打开网页、提取数据、表单操作", icon: Globe },
  { key: "desktop", label: "桌面 RPA", desc: "启动应用、截图、窗口操作", icon: Monitor },
  { key: "file", label: "文件操作", desc: "读写授权目录内文件", icon: FileText },
  { key: "shell", label: "Shell 命令", desc: "执行系统命令和脚本", icon: Terminal },
] as const;

type AgentState = "unknown" | "not_installed" | "installed" | "running";

export function HermesPanel() {
  const queryClient = useQueryClient();
  const [newDir, setNewDir] = useState("");
  const [addingDir, setAddingDir] = useState(false);
  const [stopping, setStopping] = useState(false);

  const { data: status, isLoading } = useQuery<AgentStatus>({
    queryKey: ["agent-status"],
    queryFn: async () => invoke<AgentStatus>("get_agent_status"),
    refetchInterval: 3000,
  });

  const installMutation = useMutation({
    mutationFn: () => invoke<{ success: boolean; message?: string }>("install_ai_env"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
      toast.success("AI 环境安装完成");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "安装失败"),
  });

  const startMutation = useMutation({
    mutationFn: () => invoke<void>("start_hermes_agent"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
      toast.success("Lynx Agent 已启动");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "启动失败"),
  });

  const setAuthMode = useMutation({
    mutationFn: (mode: string) => invoke<string>("set_auth_mode", { payload: { mode } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
      toast.success("授权模式已更新");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "设置失败"),
  });

  const addDir = useMutation({
    mutationFn: (dir: string) => invoke<string[]>("add_authorized_dir", { dir }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
      setNewDir("");
      toast.success("已添加授权目录");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "添加目录失败"),
  });

  const removeDir = useMutation({
    mutationFn: (dir: string) => invoke<string[]>("remove_authorized_dir", { dir }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
      toast.success("已移除授权目录");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "移除目录失败"),
  });

  const handleEmergencyStop = async () => {
    setStopping(true);
    try {
      await invoke<string>("emergency_stop");
      toast.success("已触发紧急停止");
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "紧急停止失败");
    } finally {
      setStopping(false);
    }
  };

  const handleAddDir = async () => {
    const dir = newDir.trim();
    if (!dir) return;
    setAddingDir(true);
    try {
      await addDir.mutateAsync(dir);
    } finally {
      setAddingDir(false);
    }
  };

  // 判断当前状态：未安装 / 待启动 / 已运行
  const getAgentState = (): AgentState => {
    if (isLoading || !status) return "unknown";
    if (status.wsConnected) return "running";
    if (status.hasToken) return "installed";
    return "not_installed";
  };

  const state = getAgentState();

  const stateConfig: Record<AgentState, { label: string; color: string; dotColor: string; icon: React.ElementType }> = {
    unknown: { label: "检测中", color: "text-muted-foreground", dotColor: "bg-muted-foreground", icon: Loader2 },
    not_installed: { label: "未安装", color: "text-muted-foreground", dotColor: "bg-muted-foreground", icon: PowerOff },
    installed: { label: "待启动", color: "text-amber-500", dotColor: "bg-amber-500", icon: Power },
    running: { label: "已运行", color: "text-task", dotColor: "bg-task", icon: Power },
  };

  const isRunning = state === "running";
  const isInstalled = state === "installed" || state === "running";

  // 从 cloudEndpoint 提取端口号
  const getPort = (endpoint: string): string => {
    try {
      const url = new URL(endpoint);
      return url.port || (url.protocol === "https:" ? "443" : "80");
    } catch {
      return "5176";
    }
  };
  const port = status?.cloudEndpoint ? getPort(status.cloudEndpoint) : "5176";

  return (
    <div className="flex flex-col gap-4">
      {/* 主面板：状态 + 启停控制 */}
      <div className="ios-glass flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Lynx Agent</h3>
              <p className="text-xs text-muted-foreground">本地超级助理 · 一键部署</p>
            </div>
          </div>
          {/* 实时状态显示 */}
          <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium", stateConfig[state].color, "bg-muted/30")}>
            <span className={cn("h-2 w-2 rounded-full", stateConfig[state].dotColor, state === "running" && "animate-pulse")} />
            {stateConfig[state].label}
          </div>
        </div>

        {/* 状态信息卡片：端口 + WebSocket + 能力数 */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">服务端口</span>
            <p className="flex items-center gap-1 font-medium text-foreground">
              <Cpu className="h-3 w-3" />
              {port}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">WebSocket</span>
            <p className={cn("flex items-center gap-1 font-medium", status?.wsConnected ? "text-task" : "text-muted-foreground")}>
              {status?.wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {status?.wsConnected ? "已连接" : "未连接"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">核心能力</span>
            <p className="font-medium text-foreground">{CAPABILITIES.length} 项</p>
          </div>
        </div>

        {/* WebSocket 未连接说明 */}
        {isRunning && !status?.wsConnected && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" />
              WebSocket 未连接
            </div>
            <p className="mt-1 text-muted-foreground">
              Agent 进程已启动但 WebSocket 连接未建立。可能原因：网络不通、云端服务未启动、Token 过期。
              请检查网络连接和登录状态后重新启动。
            </p>
          </div>
        )}

        {/* 按钮状态：未安装→一键安装，已安装→启动/停止切换 */}
        <div className="flex gap-2">
          {!isInstalled ? (
            <button
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending}
              className="btn-primary-glass flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
            >
              {installMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {installMutation.isPending ? "安装中..." : "一键安装 AI 环境"}
            </button>
          ) : isRunning ? (
            <>
              <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-task/30 bg-task/10 py-2.5 text-sm font-medium text-task">
                <CheckCircle2 className="h-4 w-4" /> Agent 运行中
              </div>
              <button
                onClick={handleEmergencyStop}
                disabled={stopping}
                title="紧急停止所有本地操作"
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
              >
                {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <OctagonAlert className="h-4 w-4" />}
                紧急停止
              </button>
            </>
          ) : (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="btn-primary-glass flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
            >
              {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              {startMutation.isPending ? "启动中..." : "启动 Lynx Agent"}
            </button>
          )}
        </div>

        {installMutation.isPending && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
            <div className="mb-1.5 flex items-center gap-1.5 font-medium text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              正在安装 AI 环境...
            </div>
            <p className="text-muted-foreground">
              正在下载 Node.js、npm、agent-browser、hermes-agent 等依赖，请保持网络畅通。
            </p>
          </div>
        )}
      </div>

      {/* 核心能力展示 */}
      <div className="ios-glass flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">核心能力</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Lynx Agent 启动后可执行以下四类本地操作
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            const enabled = status?.capabilities?.includes(cap.key);
            return (
              <div
                key={cap.key}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                  enabled
                    ? "border-primary/20 bg-primary/5"
                    : "border-border/40 bg-muted/20"
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", enabled ? "text-primary" : "text-muted-foreground")} />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{cap.label}</span>
                    {enabled && <CheckCircle2 className="h-3 w-3 text-task" />}
                  </div>
                  <div className="text-xs text-muted-foreground">{cap.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 授权模式 */}
      <div className="ios-glass flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">授权模式</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          控制 Lynx Agent 执行本地操作时的审批策略
        </p>
        <div className="flex flex-col gap-2">
          {AUTH_MODES.map((opt) => {
            const Icon = opt.icon;
            const selected = status?.authMode === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setAuthMode.mutate(opt.key)}
                disabled={setAuthMode.isPending}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border/40 bg-muted/20 hover:border-primary/30"
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                <div className="flex-1">
                  <div className={cn("text-sm font-medium", selected ? "text-primary" : "text-foreground")}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </div>
                {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 授权目录 */}
      <div className="ios-glass flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <FolderPlus className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">授权目录</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Lynx Agent 仅允许读取/写入以下目录中的文件
        </p>

        <div className="flex gap-2">
          <input
            value={newDir}
            onChange={(e) => setNewDir(e.target.value)}
            placeholder="如：D:\Projects\MyWork"
            className="h-9 flex-1 rounded-xl border border-border/60 bg-background/60 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !addingDir) handleAddDir();
            }}
          />
          <button
            onClick={handleAddDir}
            disabled={addingDir || !newDir.trim()}
            className="btn-primary-glass flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm disabled:opacity-50"
          >
            {addingDir ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
            添加
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {status?.authorizedDirs?.length ? (
            status.authorizedDirs.map((dir) => (
              <div
                key={dir}
                className="group flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
              >
                <span className="truncate font-mono text-xs text-foreground/80" title={dir}>
                  {dir}
                </span>
                <button
                  onClick={() => removeDir.mutate(dir)}
                  disabled={removeDir.isPending}
                  title="移除目录"
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border/40 px-3 py-4 text-center text-xs text-muted-foreground">
              暂无授权目录
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

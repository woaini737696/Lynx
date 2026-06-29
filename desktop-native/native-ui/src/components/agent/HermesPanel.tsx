import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Loader2,
  Power,
  Download,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Globe,
  FileText,
  Monitor,
  Cpu,
  Rocket,
  ExternalLink,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { invoke } from "@/lib/tauri";
import { toast } from "@/lib/toast";

interface HermesStatus {
  installed: boolean;
  installVersion?: string;
  connected?: boolean;
  version?: string;
  config?: {
    endpoint?: string;
    enabled?: boolean;
    autoStart?: boolean;
    status?: string;
    capabilities?: string[];
  };
}

const CAPABILITIES = [
  { key: "computer_use", label: "桌面控制", desc: "截图、鼠标键盘操作", icon: Monitor },
  { key: "shell", label: "Shell 命令", desc: "执行系统命令和脚本", icon: Terminal },
  { key: "browser", label: "浏览器自动化", desc: "打开网页、提取数据", icon: Globe },
  { key: "skills_hub", label: "技能中心", desc: "自主学习和技能管理", icon: FileText },
] as const;

type AgentState = "unknown" | "not_installed" | "installed" | "running";

export function HermesPanel() {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<HermesStatus>({
    queryKey: ["agent-status"],
    queryFn: async () => cloudApi.get<HermesStatus>("/api/hermes/status"),
    refetchInterval: 10000,
  });

  const installMutation = useMutation({
    mutationFn: async () => {
      return cloudApi.post<{ success: boolean; error?: string }>("/api/hermes/install", { action: "install" });
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["agent-status"] });
        toast.success("Lynx Agent 安装成功");
      } else {
        toast.error(data.error || "安装失败");
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "安装失败"),
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const endpoint = status?.config?.endpoint || "http://localhost:9119";
      const port = endpoint.match(/:(\d+)$/)?.[1] || "9119";
      return cloudApi.post<{ success: boolean; message?: string; error?: string }>("/api/hermes/install", {
        action: "start",
        port: parseInt(port, 10),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["agent-status"] });
        toast.success(data.message || "Lynx Agent 已启动");
      } else {
        toast.error(data.error || "启动失败");
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "启动失败"),
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      return cloudApi.post<{ success: boolean }>("/api/hermes/install", { action: "stop" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
      toast.success("Lynx Agent 已停止");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "停止失败"),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      return cloudApi.post<{ success: boolean; message?: string }>("/api/hermes/test", {});
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("连接测试成功");
      } else {
        toast.error(data.message || "连接测试失败");
      }
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "测试失败"),
  });

  const handleOpenDashboard = async () => {
    const endpoint = status?.config?.endpoint || "http://localhost:9119";
    try {
      // 如果未运行，先启动
      if (status?.config?.status !== "running" && status?.installed) {
        const port = endpoint.match(/:(\d+)$/)?.[1] || "9119";
        await cloudApi.post("/api/hermes/install", { action: "start", port: parseInt(port, 10) });
        queryClient.invalidateQueries({ queryKey: ["agent-status"] });
      }
      await invoke("open_external", { url: endpoint });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "打开 Dashboard 失败");
    }
  };

  const getAgentState = (): AgentState => {
    if (isLoading || !status) return "unknown";
    if (status.config?.status === "running") return "running";
    if (status.installed) return "installed";
    return "not_installed";
  };

  const state = getAgentState();
  const isRunning = state === "running";
  const isInstalled = state === "installed" || state === "running";

  const stateConfig: Record<AgentState, { label: string; color: string; dotColor: string; icon: React.ElementType }> = {
    unknown: { label: "检测中", color: "text-muted-foreground", dotColor: "bg-muted-foreground", icon: Loader2 },
    not_installed: { label: "未安装", color: "text-muted-foreground", dotColor: "bg-gray-400", icon: Download },
    installed: { label: "待启动", color: "text-amber-500", dotColor: "bg-amber-500", icon: Power },
    running: { label: "运行中", color: "text-green-500", dotColor: "bg-green-500", icon: CheckCircle2 },
  };

  const endpoint = status?.config?.endpoint || "http://localhost:9119";
  const configuredCaps = status?.config?.capabilities || [];

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
              <p className="text-xs text-muted-foreground">
                本地 AI 代理 · 操控电脑 · 数据不出本机
                {status?.installVersion && (
                  <span className="ml-1.5 text-muted-foreground/70">v{status.installVersion}</span>
                )}
              </p>
            </div>
          </div>
          <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium", stateConfig[state].color, "bg-muted/30")}>
            <span className={cn("h-2 w-2 rounded-full", stateConfig[state].dotColor, isRunning && "animate-pulse")} />
            {stateConfig[state].label}
          </div>
        </div>

        {/* 状态信息卡片 */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">服务地址</span>
            <p className="flex items-center gap-1 font-medium text-foreground truncate" title={endpoint}>
              <Cpu className="h-3 w-3 shrink-0" />
              <span className="truncate">{endpoint}</span>
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">连接状态</span>
            <p className={cn("flex items-center gap-1 font-medium", status?.connected ? "text-green-500" : "text-muted-foreground")}>
              {status?.connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {status?.connected ? "已连接" : "未连接"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">核心能力</span>
            <p className="font-medium text-foreground">{CAPABILITIES.length} 项</p>
          </div>
        </div>

        {/* 按钮区 */}
        <div className="flex flex-wrap gap-2">
          {!isInstalled ? (
            <button
              onClick={() => installMutation.mutate()}
              disabled={installMutation.isPending}
              className="btn-primary-glass flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
            >
              {installMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {installMutation.isPending ? "安装中..." : "一键安装"}
            </button>
          ) : isRunning ? (
            <>
              <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 py-2.5 text-sm font-medium text-green-500">
                <CheckCircle2 className="h-4 w-4" /> Agent 运行中
              </div>
              <button
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
              >
                {stopMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                停止
              </button>
              <button
                onClick={handleOpenDashboard}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
              >
                <ExternalLink className="h-4 w-4" />
                Dashboard
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="btn-primary-glass flex flex-1 items-center justify-center gap-2 py-2.5 text-sm"
              >
                {startMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                {startMutation.isPending ? "启动中..." : "启动 Lynx Agent"}
              </button>
              <button
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                测试连接
              </button>
            </>
          )}
        </div>

        {installMutation.isPending && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
            <div className="mb-1.5 flex items-center gap-1.5 font-medium text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              正在安装 Lynx Agent...
            </div>
            <p className="text-muted-foreground">
              正在服务端部署 Hermes Agent 环境，请保持网络畅通。安装过程可能需要 1-2 分钟。
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
          Lynx Agent 启动后可执行以下本地操作
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            const enabled = configuredCaps.includes(cap.key);
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
                    {enabled && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                  </div>
                  <div className="text-xs text-muted-foreground">{cap.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 说明 */}
      <div className="ios-glass flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">关于 Lynx Agent</h3>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          基于 Hermes Agent 技术深度定制开发，让 AI 助理升级为 Lynx 超级助理，可以直接操控你的电脑（桌面控制、Shell 命令、浏览器控制），并拥有自主学习与自我成长能力。所有操作在本地执行，数据不出本机。
        </p>
        <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600">
          <ShieldAlert className="h-3 w-3 shrink-0" />
          <span>Agent 运行时会拥有本地操作权限，请确保只执行可信任务。</span>
        </div>
      </div>
    </div>
  );
}

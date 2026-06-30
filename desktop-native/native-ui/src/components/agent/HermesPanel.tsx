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
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { invoke, listen } from "@/lib/tauri";
import { toast } from "@/lib/toast";

interface LocalDetectStatus {
  tauri: boolean;
  python: boolean;
  pythonVersion?: string;
  pip: boolean;
  pipPath?: string;
  node: boolean;
  nodeVersion?: string;
  agentBrowser: boolean;
  hermesAgent: boolean;
  hermesVersion?: string;
  hermesPath?: string;
  authorizedDir: boolean;
  ready: boolean;
}

interface InstallProgress {
  step: number;
  total: number;
  message: string;
  percent: number;
}

const CAPABILITIES = [
  { key: "computer_use", label: "桌面控制", desc: "截图、鼠标键盘操作", icon: Monitor },
  { key: "shell", label: "Shell 命令", desc: "执行系统命令和脚本", icon: Terminal },
  { key: "browser", label: "浏览器自动化", desc: "打开网页、提取数据", icon: Globe },
  { key: "skills_hub", label: "技能中心", desc: "自主学习和技能管理", icon: FileText },
] as const;

type AgentState = "unknown" | "not_installed" | "installed" | "running";

const DASHBOARD_PORT = 9119;

export function HermesPanel() {
  const queryClient = useQueryClient();
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [isDashboardRunning, setIsDashboardRunning] = useState(false);
  // 安装进行中标志：用于暂停 refetch，避免与安装进程竞态导致重复触发安装或控制台闪烁
  const [isInstalling, setIsInstalling] = useState(false);
  // 测试运行中标志：调用本地 HermesAgent HTTP API 验证可用性
  const [testing, setTesting] = useState(false);

  // 本地检测 AI 环境（通过 Tauri 命令，不走云端 API）
  // 安装期间暂停 refetch + 禁用查询，避免 detect_ai_env 调用子进程导致控制台闪烁
  const { data: status, isLoading } = useQuery<LocalDetectStatus>({
    queryKey: ["local-ai-env"],
    queryFn: async () => invoke<LocalDetectStatus>("detect_ai_env"),
    refetchInterval: isInstalling ? false : 15000,
    enabled: !isInstalling,
  });

  // 检测 Dashboard 是否在运行（HTTP 探测本地端口）
  const { data: dashboardOnline } = useQuery<boolean>({
    queryKey: ["dashboard-online"],
    queryFn: async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(`http://127.0.0.1:${DASHBOARD_PORT}/api/status`, {
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        return res.ok;
      } catch {
        return false;
      }
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    setIsDashboardRunning(!!dashboardOnline);
  }, [dashboardOnline]);

  // 监听安装进度事件
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<InstallProgress>("install-progress", (payload) => {
      setInstallProgress(payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // 安装：调用本地 Tauri 命令（从服务器下载 wheel + 本地 pip install）
  const installMutation = useMutation({
    mutationFn: async () => {
      setInstallProgress({ step: 0, total: 6, message: "开始安装...", percent: 0 });
      // 监听进度
      const unlisten = await listen<InstallProgress>("install-progress", (p) => {
        setInstallProgress(p);
      });
      try {
        const result = await invoke<{ success: boolean; message?: string; error?: string }>("install_ai_env");
        return result;
      } finally {
        unlisten();
      }
    },
    onMutate: () => {
      // 安装开始：立即暂停 detect_ai_env 轮询，避免子进程弹窗 + 竞态重复安装
      setIsInstalling(true);
    },
    onSuccess: (data) => {
      setInstallProgress(null);
      setIsInstalling(false);
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["local-ai-env"] });
        toast.success("Lynx Agent 安装成功");
        // 安装成功后自动启动 WS 连接（PC 上线，远程操控可用）
        // 需要先 set_user_token + set_cloud_endpoint，再 start_hermes_agent
        (async () => {
          try {
            const { useAuthStore } = await import("@/stores/authStore");
            const { getCloudEndpoint } = await import("@/lib/cloud-api");
            const st = useAuthStore.getState();
            if (st.user?.id && st.token) {
              await invoke("set_user_token", { token: `user:${st.user.id}` });
              await invoke("set_cloud_endpoint", { endpoint: getCloudEndpoint() });
              await invoke("start_hermes_agent");
              console.log("[HermesPanel] 安装后自动启动 WS 连接成功");
            }
          } catch (e) {
            console.warn("[HermesPanel] 安装后自动启动 WS 失败:", e);
          }
        })();
      } else {
        toast.error(data.error || data.message || "安装失败");
      }
    },
    onError: (e: unknown) => {
      setInstallProgress(null);
      setIsInstalling(false);
      toast.error(e instanceof Error ? e.message : "安装失败");
    },
  });

  // 启动 Dashboard + WS 连接：调用本地 Tauri 命令
  const startMutation = useMutation({
    mutationFn: async () => {
      // 1. 启动 WS 连接（PC 上线，远程操控可用）
      try {
        const { useAuthStore } = await import("@/stores/authStore");
        const { getCloudEndpoint } = await import("@/lib/cloud-api");
        const st = useAuthStore.getState();
        if (st.user?.id && st.token) {
          await invoke("set_user_token", { token: `user:${st.user.id}` });
          await invoke("set_cloud_endpoint", { endpoint: getCloudEndpoint() });
          await invoke("start_hermes_agent");
        }
      } catch (e) {
        console.warn("[HermesPanel] 启动 WS 连接失败:", e);
      }
      // 2. 启动本地 Dashboard
      return invoke<{ success: boolean; pid?: number; port: number; endpoint: string }>("start_hermes_dashboard", {
        port: DASHBOARD_PORT,
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["dashboard-online"] });
        toast.success(`Lynx Agent 已启动（Dashboard 端口 ${data.port}，WS 已连接云端）`);
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "启动失败"),
  });

  // 停止 Dashboard：调用本地 Tauri 命令
  const stopMutation = useMutation({
    mutationFn: async () => {
      return invoke<{ success: boolean; killed?: number }>("stop_hermes_dashboard", {
        port: DASHBOARD_PORT,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-online"] });
      queryClient.invalidateQueries({ queryKey: ["local-ai-env"] });
      toast.success("Lynx Agent Dashboard 已停止");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "停止失败"),
  });

  // 测试连接：HTTP fetch 本地 Dashboard
  const testMutation = useMutation({
    mutationFn: async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      try {
        const res = await fetch(`http://127.0.0.1:${DASHBOARD_PORT}/api/status`, {
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          return { success: true as const, version: (data as { version?: string }).version };
        }
        return { success: false as const, error: `HTTP ${res.status}` };
      } catch (e) {
        clearTimeout(timer);
        return { success: false as const, error: e instanceof Error ? e.message : "连接失败" };
      }
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`连接测试成功${data.version ? `（v${data.version}）` : ""}`);
      } else {
        toast.error(data.error || "连接测试失败");
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard-online"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "测试失败"),
  });

  const handleOpenDashboard = async () => {
    const endpoint = `http://localhost:${DASHBOARD_PORT}`;
    // 如果未运行，先启动
    if (!isDashboardRunning && status?.hermesAgent) {
      await invoke("start_hermes_dashboard", { port: DASHBOARD_PORT });
      queryClient.invalidateQueries({ queryKey: ["dashboard-online"] });
      // 等待 1 秒让服务启动
      await new Promise((r) => setTimeout(r, 1000));
    }
    await invoke("open_external", { url: endpoint });
  };

  // 测试运行：调用本地 HermesAgent HTTP API 执行一个简单 prompt，验证 Agent 可用性
  const handleTestRun = async () => {
    setTesting(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 35000);
    try {
      const res = await fetch(`http://127.0.0.1:${DASHBOARD_PORT}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: '你好，请回复"测试成功"', timeout: 30 }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        toast.error(`测试失败：HTTP ${res.status}`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        output?: string;
        result?: string;
        message?: string;
        error?: string;
      };
      const output = (data.output || data.result || data.message || "").trim();
      if (data.success === false || data.error) {
        toast.error(`测试失败：${data.error || output || "未知错误"}`);
      } else {
        toast.success(`测试成功${output ? `：${output}` : ""}`);
      }
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof DOMException && e.name === "AbortError") {
        toast.error("测试失败：请求超时");
      } else {
        toast.error(e instanceof Error ? `测试失败：${e.message}` : "测试失败");
      }
    } finally {
      setTesting(false);
    }
  };

  const getAgentState = (): AgentState => {
    if (isLoading || !status) return "unknown";
    if (!status.hermesAgent) return "not_installed";
    if (isDashboardRunning) return "running";
    return "installed";
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

  const endpoint = `http://localhost:${DASHBOARD_PORT}`;
  const hermesVersion = status?.hermesVersion?.replace("hermes-agent ", "") || "";

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
                {hermesVersion && (
                  <span className="ml-1.5 text-muted-foreground/70">v{hermesVersion}</span>
                )}
              </p>
            </div>
          </div>
          <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium", stateConfig[state].color, "bg-muted/30")}>
            <span className={cn("h-2 w-2 rounded-full", stateConfig[state].dotColor, isRunning && "animate-pulse")} />
            {stateConfig[state].label}
          </div>
        </div>

        {/* 环境状态卡片 */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Python</span>
            <p className={cn("flex items-center gap-1 font-medium", status?.python ? "text-green-500" : "text-red-500")}>
              {status?.python ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {status?.python ? status.pythonVersion?.split(" ")[1] || "已安装" : "未安装"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Dashboard</span>
            <p className={cn("flex items-center gap-1 font-medium", isRunning ? "text-green-500" : "text-muted-foreground")}>
              {isRunning ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {isRunning ? "运行中" : "未启动"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">服务地址</span>
            <p className="flex items-center gap-1 font-medium text-foreground truncate" title={endpoint}>
              <Cpu className="h-3 w-3 shrink-0" />
              <span className="truncate">:{DASHBOARD_PORT}</span>
            </p>
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
                onClick={handleTestRun}
                disabled={testing}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                title="执行一个简单测试任务，验证 HermesAgent 是否正常工作"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
                {testing ? "测试中..." : "测试运行"}
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

        {/* 安装进度 */}
        {installMutation.isPending && installProgress && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                {installProgress.message}
              </span>
              <span className="text-muted-foreground">{installProgress.percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${installProgress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              步骤 {installProgress.step}/{installProgress.total} · 从服务器下载 HermesAgent 并本地安装
            </p>
          </div>
        )}

        {/* 环境缺失提示 */}
        {status && !status.python && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">未检测到 Python</p>
                <p className="mt-0.5">请先安装 Python 3.9+（<span className="underline">https://python.org/downloads</span>）后再点击一键安装</p>
              </div>
            </div>
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
            const enabled = isRunning;
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

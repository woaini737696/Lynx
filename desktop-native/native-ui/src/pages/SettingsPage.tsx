import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Shield,
  FolderOpen,
  Globe,
  Info,
  Loader2,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { invoke } from "@/lib/tauri";
import { getCloudEndpoint, setCloudEndpoint } from "@/lib/cloud-api";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { clearAuth } from "@/lib/auth-persistence";
import { openLoginModal } from "@/lib/login-modal";
import { applyTheme, saveTheme, type Theme } from "@/lib/theme";
import { HelpButton } from "@/components/ui/HelpButton";
import { Logo } from "@/components/ui/Logo";
import { toast } from "@/lib/toast";
import type { AgentStatus } from "@/types/api";

const tabs = [
  { key: "account", label: "账号", icon: User },
  { key: "general", label: "通用", icon: Monitor },
  { key: "agent", label: "Agent", icon: Shield },
  { key: "about", label: "关于", icon: Info },
];

const authModeOptions = [
  { key: "approve", label: "弹窗审批", desc: "每次本地操作前弹出授权窗口" },
  { key: "once", label: "一次性授权", desc: "同一会话内首次审批，后续放行" },
  { key: "free", label: "免审批仅记录", desc: "自动执行并记录日志" },
];

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const [activeTab, setActiveTab] = useState("account");
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [endpoint, setEndpoint] = useState("");
  const [savingEndpoint, setSavingEndpoint] = useState(false);

  const [newDir, setNewDir] = useState("");
  const [addingDir, setAddingDir] = useState(false);

  // 检查更新
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    currentVersion: string;
    notes?: string;
  } | null>(null);

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateInfo(null);
    try {
      // P0 修复：改用 IPC handler check_app_update（之前用了不存在的云 API /api/desktop/update-info）
      // main.js 的 check_app_update handler 会从 /api/hermes/app-version 获取最新版本并对比
      const result = await invoke<{
        success: boolean;
        hasUpdate: boolean;
        current: string;
        latest: string;
        downloadUrl: string;
        releaseNotes?: string;
        error?: string;
      }>("check_app_update");

      if (!result.success) {
        toast.error(result.error || "无法获取服务器版本信息");
        return;
      }

      if (result.hasUpdate) {
        // 有新版本：自动下载并安装
        toast.success(`发现新版本 v${result.latest}，正在自动下载安装...`);
        setInstalling(true);
        try {
          await invoke("download_and_install_update", { downloadUrl: result.downloadUrl });
          // download_and_install_update 成功后会自动启动安装程序退出当前应用
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "下载安装失败");
        } finally {
          setInstalling(false);
        }
      } else {
        // 无新版本：Toast 提示
        toast.success("当前已经是最新版本了");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "检查更新失败，请稍后重试");
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadInstall = async () => {
    // 已废弃：检查更新现在自动下载安装，不再需要手动打开下载页面
    // 保留函数避免 UI 引用错误
    setInstalling(true);
    try {
      await invoke("open_external", { url: "https://www.lynxdo.com/download" });
      toast.success("已在浏览器中打开下载页面");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "打开下载页面失败");
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const s = await invoke<AgentStatus>("get_agent_status");
      setStatus(s);
      // cloud_endpoint 改为从 localStorage 读取（前端 fetch 方案，不再依赖 Rust 端）
      setEndpoint(getCloudEndpoint());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载 Agent 状态失败");
    } finally {
      setLoadingStatus(false);
    }
  }

  const handleSignOut = async () => {
    try {
      await clearAuth();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "退出登录失败");
    } finally {
      signOut();
      // P0 修复：不导航 /login（路由不存在），改为弹出登录弹窗（与 AUTH_EXPIRED 一致）
      openLoginModal();
    }
  };

  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    saveTheme(t);
  };

  const handleAuthModeChange = async (mode: string) => {
    try {
      await invoke("set_auth_mode", { mode });
      await loadStatus();
      toast.success("授权模式已切换");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "设置授权模式失败");
    }
  };

  const handleSaveEndpoint = async () => {
    if (!endpoint.trim()) return;
    setSavingEndpoint(true);
    try {
      // cloud_endpoint 改为保存到 localStorage（前端 fetch 方案直接读取）
      setCloudEndpoint(endpoint.trim());
      toast.success("云端地址已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "设置云端地址失败");
    } finally {
      setSavingEndpoint(false);
    }
  };

  const handleAddDir = async () => {
    if (!newDir.trim()) return;
    setAddingDir(true);
    try {
      await invoke("add_authorized_dir", { dir: newDir.trim() });
      setNewDir("");
      await loadStatus();
      toast.success("已添加授权目录");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "添加目录失败");
    } finally {
      setAddingDir(false);
    }
  };

  const handleRemoveDir = async (dir: string) => {
    try {
      await invoke("remove_authorized_dir", { dir });
      await loadStatus();
      toast.success("已移除授权目录");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "移除目录失败");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-4">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">设置</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理账号、外观与本地 Agent 授权</p>
        </div>
        <HelpButton module="settings" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar tabs */}
        <div className="flex shrink-0 flex-col gap-1 lg:w-48">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "glass-active text-foreground"
                    : "text-muted-foreground hover:bg-primary/8 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="ios-glass p-6"
          >
            {activeTab === "account" && (
              <div className="flex flex-col gap-5">
                <h2 className="text-lg font-semibold text-foreground">账号信息</h2>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <User className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground">
                      {user?.displayName || user?.username || "未登录"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user?.username ? `@${user.username}` : "本地模式"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">用户 ID</p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{user?.id || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">会员状态</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {user?.tier || "免费版"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </button>
              </div>
            )}

            {activeTab === "general" && (
              <div className="flex flex-col gap-5">
                <h2 className="text-lg font-semibold text-foreground">外观</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "light", label: "浅色", icon: Sun },
                    { key: "dark", label: "深色", icon: Moon },
                    { key: "system", label: "跟随系统", icon: Monitor },
                  ].map((t) => {
                    const Icon = t.icon;
                    const selected = theme === (t.key as Theme);
                    return (
                      <button
                        key={t.key}
                        onClick={() => handleThemeChange(t.key as Theme)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-medium transition-colors",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                <h2 className="mt-2 text-lg font-semibold text-foreground">云端地址</h2>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="https://ai.lynxdo.com"
                      className="h-11 w-full rounded-xl border border-border/60 bg-background/60 pl-9 pr-4 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    onClick={handleSaveEndpoint}
                    disabled={savingEndpoint || !endpoint.trim()}
                    className="btn-primary-glass flex h-11 items-center gap-1.5 rounded-xl px-4 text-sm disabled:opacity-50"
                  >
                    {savingEndpoint ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    保存
                  </button>
                </div>
              </div>
            )}

            {activeTab === "agent" && (
              <div className="flex flex-col gap-5">
                <h2 className="text-lg font-semibold text-foreground">授权模式</h2>
                <div className="flex flex-col gap-2">
                  {authModeOptions.map((opt) => {
                    const selected = status?.authMode === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => handleAuthModeChange(opt.key)}
                        className={cn(
                          "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors",
                          selected
                            ? "border-primary bg-primary/10"
                            : "border-border/40 bg-muted/20 hover:border-primary/30"
                        )}
                      >
                        <span className={cn("text-sm font-medium", selected ? "text-primary" : "text-foreground")}>
                          {opt.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>

                <h2 className="mt-2 text-lg font-semibold text-foreground">授权目录</h2>
                <p className="text-xs text-muted-foreground">
                  Agent 仅允许读取/写入以下目录中的文件
                </p>

                {loadingStatus ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    加载中...
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(status?.authorizedDirs || []).map((dir) => (
                      <div
                        key={dir}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm text-foreground" title={dir}>
                            {dir}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveDir(dir)}
                          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <input
                        value={newDir}
                        onChange={(e) => setNewDir(e.target.value)}
                        placeholder="输入绝对路径，如 D:\\Lynx\\user-data"
                        className="h-10 flex-1 rounded-xl border border-border/60 bg-background/60 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <button
                        onClick={handleAddDir}
                        disabled={addingDir || !newDir.trim()}
                        className="btn-primary-glass flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm disabled:opacity-50"
                      >
                        {addingDir ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        添加
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "about" && (
              <div className="flex flex-col gap-5">
                <h2 className="text-lg font-semibold text-foreground">关于 Lynx</h2>
                <div className="flex items-center gap-4">
                  <Logo className="h-16 w-16 rounded-2xl" />
                  <div>
                    <p className="text-base font-semibold text-foreground">Lynx 原生桌面端</p>
                    <p className="text-sm text-muted-foreground">基于 Lynx Agent 技术</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">版本</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{status?.version || "1.0.0"}</p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">WebSocket 状态</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {status?.wsConnected ? "已连接" : "未连接"}
                    </p>
                  </div>
                </div>

                {/* 检查更新 */}
                <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">检查更新</p>
                      <p className="text-xs text-muted-foreground">
                        {updateInfo
                          ? `发现新版本 v${updateInfo.version}（当前 v${updateInfo.currentVersion}）`
                          : "检查是否有新版本可用"}
                      </p>
                    </div>
                    {updateInfo ? (
                      <button
                        onClick={handleDownloadInstall}
                        disabled={installing}
                        className="btn-primary-glass flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs disabled:opacity-50"
                      >
                        {installing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )}
                        {installing ? "打开中..." : "前往下载"}
                      </button>
                    ) : (
                      <button
                        onClick={handleCheckUpdate}
                        disabled={checking}
                        className="btn-glass flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs disabled:opacity-50"
                      >
                        {checking ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        {checking ? "检查中..." : "检查更新"}
                      </button>
                    )}
                  </div>
                  {updateInfo?.notes && (
                    <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-3">
                      <p className="text-xs text-muted-foreground/80 whitespace-pre-line">
                        {updateInfo.notes}
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  © 2026 Lynx. 保留所有权利。
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

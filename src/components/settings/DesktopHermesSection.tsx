"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Cpu,
  Rocket,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  FolderPlus,
  FolderX,
  Wifi,
  WifiOff,
  AlertTriangle,
  StopCircle,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  XCircle,
  Power,
  DownloadCloud,
} from "lucide-react";
import { Card, Button } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";
import {
  isDesktop,
  getAgentStatus,
  setAuthMode,
  addAuthorizedDir,
  removeAuthorizedDir,
  emergencyStop,
  installAiEnv,
  detectAiEnv,
  startHermesAgent,
  onInstallProgress,
  onInstallComplete,
  onWsConnected,
  onWsDisconnected,
  onEmergencyStop,
  onEmergencyReset,
  type AgentStatus,
  type InstallProgress,
} from "@/lib/desktop-client";

type AuthMode = "approve" | "once" | "free";

const AUTH_MODES: Array<{
  value: AuthMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}> = [
  {
    value: "approve",
    label: "弹窗审批",
    desc: "每次执行操作前弹窗确认（默认，最安全）",
    icon: <ShieldCheck className="h-4 w-4" />,
    color: "text-task",
  },
  {
    value: "once",
    label: "一次授权",
    desc: "同类操作首次授权后，本会话内不再询问",
    icon: <ShieldAlert className="h-4 w-4" />,
    color: "text-campaign",
  },
  {
    value: "free",
    label: "免审批",
    desc: "仅记录审计日志，不弹窗（效率最高，需谨慎）",
    icon: <ShieldOff className="h-4 w-4" />,
    color: "text-graveyard",
  },
];

/**
 * 桌面端 HermesAgent 专属配置区域
 *
 * 仅在 Tauri 桌面端环境显示，包含：
 * - 一键安装 AI 环境（Node.js / agent-browser / hermes-agent）
 * - 三档授权模式切换器（approve / once / free）
 * - 授权目录管理（允许 HermesAgent 访问的目录白名单）
 * - 安全操作说明弹窗
 * - WS 连接状态 / 紧急停止
 * - HermesAgent 进程启动/状态
 */
export function DesktopHermesSection() {
  const [desktop, setDesktop] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [newDir, setNewDir] = useState("");
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [detectResult, setDetectResult] = useState<Record<string, unknown> | null>(null);
  // 检查更新相关状态
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    currentVersion: string | null;
    latestVersion: string;
    hasUpdate: boolean;
    releaseNotes?: string;
  } | null>(null);

  // 初始化：检测桌面端环境 + 加载状态 + 注册事件监听
  useEffect(() => {
    if (!isDesktop()) {
      setDesktop(false);
      setLoading(false);
      return;
    }
    setDesktop(true);

    let unlistenFns: Array<(() => void) | null> = [];

    const init = async () => {
      await refreshStatus();
      await refreshDetect();

      // 安装进度
      unlistenFns.push(await onInstallProgress((p) => setInstallProgress(p)));
      unlistenFns.push(
        await onInstallComplete((r) => {
          setInstalling(false);
          setInstallProgress(null);
          if (r.success) {
            toast("AI 环境安装完成", "success");
          } else {
            toast("AI 环境安装未完全成功，请查看日志", "error");
          }
          refreshStatus();
          refreshDetect();
        })
      );

      // WS 状态
      unlistenFns.push(
        await onWsConnected(() => {
          toast("已连接到云端状态中心", "success");
          refreshStatus();
        })
      );
      unlistenFns.push(
        await onWsDisconnected(() => {
          toast("与云端状态中心断开", "error");
          refreshStatus();
        })
      );

      // 紧急停止
      unlistenFns.push(
        await onEmergencyStop(() => {
          toast("已触发紧急停止，所有本地操作已暂停", "error");
          refreshStatus();
        })
      );
      unlistenFns.push(
        await onEmergencyReset(() => {
          toast("紧急停止已解除", "success");
          refreshStatus();
        })
      );
    };

    init();
    setLoading(false);

    return () => {
      for (const fn of unlistenFns) {
        try {
          fn?.();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!isDesktop()) return;
    try {
      const s = await getAgentStatus();
      setStatus(s);
    } catch (e) {
      console.error("获取 Agent 状态失败:", e);
    }
  }, []);

  const refreshDetect = useCallback(async () => {
    if (!isDesktop()) return;
    try {
      const r = await detectAiEnv();
      setDetectResult(r);
    } catch (e) {
      console.error("检测 AI 环境失败:", e);
    }
  }, []);

  // 非桌面端：不渲染
  if (!desktop) return null;

  const handleInstall = async () => {
    setInstalling(true);
    setInstallProgress(null);
    try {
      const r = await installAiEnv();
      if (!r.success) {
        toast(r.message || "安装失败", "error");
        setInstalling(false);
        setInstallProgress(null);
      }
      // 成功时由 onInstallComplete 回调处理
    } catch (e: any) {
      toast("安装请求失败：" + e.message, "error");
      setInstalling(false);
      setInstallProgress(null);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await startHermesAgent();
      toast("奇思 Agent 已启动", "success");
      await refreshStatus();
    } catch (e: any) {
      toast("启动失败：" + e.message, "error");
    } finally {
      setStarting(false);
    }
  };

  const handleEmergencyStop = async () => {
    setStopping(true);
    try {
      await emergencyStop();
      toast("已触发紧急停止", "error");
      await refreshStatus();
      // 5 秒后自动解除（Rust 端会自动重置）
      setTimeout(() => {
        refreshStatus();
        setStopping(false);
      }, 5500);
    } catch (e: any) {
      toast("紧急停止失败：" + e.message, "error");
      setStopping(false);
    }
  };

  // 检查 HermesAgent 是否有新版本
  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateInfo(null);
    try {
      const res = await fetch("/api/hermes/update");
      const data = await res.json();
      if (data.error) {
        toast("检查更新失败：" + data.error, "error");
      } else if (data.hasUpdate) {
        toast(`发现新版本 v${data.latestVersion}（当前 v${data.currentVersion || "未知"}）`, "success");
        setUpdateInfo({
          currentVersion: data.currentVersion,
          latestVersion: data.latestVersion,
          hasUpdate: true,
          releaseNotes: data.releaseNotes,
        });
      } else {
        toast(`当前已是最新版本 v${data.currentVersion || data.latestVersion}`, "success");
        setUpdateInfo({
          currentVersion: data.currentVersion,
          latestVersion: data.latestVersion,
          hasUpdate: false,
        });
      }
    } catch (e: any) {
      toast("检查更新请求失败：" + e.message, "error");
    } finally {
      setCheckingUpdate(false);
    }
  };

  // 执行更新：下载最新 wheel 并安装
  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const res = await fetch("/api/hermes/update", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast(`HermesAgent 已更新到 v${data.newVersion || "最新"}`, "success");
        setUpdateInfo(null);
        await refreshStatus();
        await refreshDetect();
      } else {
        toast(data.error || "更新失败", "error");
      }
    } catch (e: any) {
      toast("更新请求失败：" + e.message, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleAuthModeChange = async (mode: AuthMode) => {
    try {
      await setAuthMode(mode);
      toast(`授权模式已切换为：${mode === "approve" ? "弹窗审批" : mode === "once" ? "一次授权" : "免审批"}`, "success");
      await refreshStatus();
    } catch (e: any) {
      toast("切换授权模式失败：" + e.message, "error");
    }
  };

  const handleAddDir = async () => {
    const dir = newDir.trim();
    if (!dir) {
      toast("请输入目录路径", "error");
      return;
    }
    try {
      await addAuthorizedDir(dir);
      setNewDir("");
      toast(`已添加授权目录：${dir}`, "success");
      await refreshStatus();
    } catch (e: any) {
      toast("添加授权目录失败：" + e.message, "error");
    }
  };

  const handleRemoveDir = async (dir: string) => {
    try {
      await removeAuthorizedDir(dir);
      toast(`已移除授权目录：${dir}`, "success");
      await refreshStatus();
    } catch (e: any) {
      toast("移除授权目录失败：" + e.message, "error");
    }
  };

  const currentMode = status?.authMode || "approve";
  const wsConnected = status?.wsConnected ?? false;
  const authorizedDirs = status?.authorizedDirs || [];
  const hasToken = status?.hasToken ?? false;

  // 检测结果展示
  const detectionItems = detectResult
    ? Object.entries(detectResult).map(([k, v]) => ({
        key: k,
        ok: v === true || v === "true" || v === "installed",
        label: renderDetectLabel(k),
        value: typeof v === "string" ? v : v ? "已安装" : "未安装",
      }))
    : [];

  return (
    <Card className="mb-5 border-northstar/20">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-northstar" />
          <h2 className="text-sm font-semibold">桌面端 奇思 Agent（本地超级 AI 助理）</h2>
          {wsConnected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-task/10 px-2 py-0.5 text-[10px] text-task">
              <Wifi className="h-2.5 w-2.5" /> 云端已连接
            </span>
          ) : (
            <span className="ios-glass-sm inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
              <WifiOff className="h-2.5 w-2.5" /> 云端未连接
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowSafetyModal(true)}
          className="btn-glass inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-northstar transition-colors hover:text-northstar"
          title="查看安全操作说明"
        >
          <BookOpen className="h-3 w-3" /> 安全操作说明
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> 加载中...
        </div>
      ) : (
        <div className="space-y-4">
          {/* 环境检测与一键安装 */}
          <div className="glass-card rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-medium text-foreground">AI 环境检测</div>
              <Button size="sm" variant="outline" onClick={handleInstall} disabled={installing} className="gap-1.5">
                {installing ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> 安装中...</>
                ) : (
                  <><Rocket className="h-3 w-3" /> 一键安装 AI 环境</>
                )}
              </Button>
            </div>

            {detectionItems.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {detectionItems.map((item) => (
                  <div key={item.key} className="flex items-center gap-1.5 text-[11px]">
                    {item.ok ? (
                      <CheckCircle2 className="h-3 w-3 text-task" />
                    ) : (
                      <XCircle className="h-3 w-3 text-graveyard" />
                    )}
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={item.ok ? "text-task" : "text-graveyard"}>{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 安装进度 */}
            {installing && installProgress && (
              <div className="ios-glass-sm mt-3 rounded-xl border-northstar/30 p-2">
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-foreground">
                    步骤 {installProgress.step}/{installProgress.total}：{installProgress.message}
                  </span>
                  <span className="text-northstar">{installProgress.percent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-background/50">
                  <div
                    className="h-full bg-northstar transition-all duration-300"
                    style={{ width: `${installProgress.percent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* HermesAgent 进程控制 */}
          <div className="glass-card rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className={`h-2 w-2 rounded-full ${hasToken ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="font-medium text-foreground">
                  奇思 Agent 进程{hasToken ? "（运行中）" : "（未启动）"}
                </span>
                {status?.version && (
                  <span className="text-muted-foreground">v{status.version}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!hasToken && (
                  <Button size="sm" onClick={handleStart} disabled={starting} className="gap-1.5">
                    {starting ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> 启动中...</>
                    ) : (
                      <><Power className="h-3 w-3" /> 启动奇思 Agent</>
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate || updating}
                  className="gap-1.5"
                  title="检查 HermesAgent 是否有新版本"
                >
                  {checkingUpdate ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> 检查中...</>
                  ) : (
                    <><RefreshCw className="h-3 w-3" /> 检查更新</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleEmergencyStop}
                  disabled={stopping}
                  className="gap-1.5"
                  title="紧急停止所有本地操作（5秒后自动解除）"
                >
                  {stopping ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> 停止中...</>
                  ) : (
                    <><StopCircle className="h-3 w-3" /> 紧急停止</>
                  )}
                </Button>
              </div>
            </div>

            {/* 更新提示 */}
            {updateInfo && updateInfo.hasUpdate && (
              <div className="ios-glass-sm mt-3 rounded-xl border-northstar/30 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-northstar">
                  <DownloadCloud className="h-3.5 w-3.5" />
                  发现新版本 v{updateInfo.latestVersion}
                  <span className="text-muted-foreground">
                    （当前 v{updateInfo.currentVersion || "未知"}）
                  </span>
                </div>
                {updateInfo.releaseNotes && (
                  <p className="mb-2 text-[11px] text-foreground/70">{updateInfo.releaseNotes}</p>
                )}
                <Button size="sm" onClick={handleUpdate} disabled={updating} className="gap-1.5">
                  {updating ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> 更新中（1-3分钟）...</>
                  ) : (
                    <><DownloadCloud className="h-3 w-3" /> 立即更新</>
                  )}
                </Button>
              </div>
            )}
            {updateInfo && !updateInfo.hasUpdate && (
              <div className="ios-glass-sm mt-3 flex items-center gap-2 rounded-xl p-2.5 text-xs text-task">
                <CheckCircle2 className="h-3.5 w-3.5" />
                当前已是最新版本 v{updateInfo.currentVersion || updateInfo.latestVersion}
              </div>
            )}
          </div>

          {/* 三档授权模式切换器 */}
          <div className="glass-card rounded-xl p-3">
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-northstar" />
              <span className="text-xs font-medium text-foreground">授权模式（仿 Codex）</span>
              <span className="text-[10px] text-muted-foreground">控制 AI 助理执行本地操作前的确认方式</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {AUTH_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleAuthModeChange(m.value)}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors ${
                    currentMode === m.value
                      ? "border-northstar/50 bg-northstar/10"
                      : "ios-glass-sm border-border/40 hover:border-northstar/30"
                  }`}
                >
                  <div className={`flex items-center gap-1.5 ${currentMode === m.value ? "text-northstar" : m.color}`}>
                    {m.icon}
                    <span className="text-xs font-medium">{m.label}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 授权目录管理 */}
          <div className="glass-card rounded-xl p-3">
            <div className="mb-2 flex items-center gap-2">
              <FolderPlus className="h-3.5 w-3.5 text-campaign" />
              <span className="text-xs font-medium text-foreground">授权目录白名单</span>
              <span className="text-[10px] text-muted-foreground">仅这些目录内的文件可被 AI 助理读写</span>
            </div>
            <div className="mb-2 flex gap-2">
              <input
                type="text"
                value={newDir}
                onChange={(e) => setNewDir(e.target.value)}
                placeholder="输入绝对路径，如 D:\LynnHub\user-data"
                className="ios-glass-sm flex-1 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddDir();
                }}
              />
              <Button size="sm" onClick={handleAddDir} disabled={!newDir.trim()} className="gap-1.5">
                <FolderPlus className="h-3 w-3" /> 添加
              </Button>
            </div>
            {authorizedDirs.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">暂无授权目录</div>
            ) : (
              <div className="space-y-1">
                {authorizedDirs.map((dir) => (
                  <div
                    key={dir}
                    className="ios-glass-sm flex items-center justify-between rounded-xl px-2 py-1.5"
                  >
                    <span className="truncate text-[11px] text-foreground" title={dir}>
                      {dir}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDir(dir)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                      title="移除"
                    >
                      <FolderX className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 紧急停止说明 */}
          <div className="ios-glass-sm flex items-start gap-2 rounded-xl border-red-300/30 p-2.5 text-[11px] text-red-700">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <div>
              <span className="font-medium">紧急停止：</span>
              点击「紧急停止」会立即中断所有正在执行的本地操作（浏览器自动化、文件读写、Shell 命令、桌面 RPA）。
              触发后 5 秒自动解除，期间所有新指令将被拒绝。
            </div>
          </div>
        </div>
      )}

      {/* 安全操作说明弹窗 */}
      <SafetyGuideModal open={showSafetyModal} onClose={() => setShowSafetyModal(false)} />
    </Card>
  );
}

// ============ 安全操作说明弹窗 ============

function SafetyGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="奇思 Agent 安全操作说明" size="lg">
      <div className="space-y-4 text-xs text-foreground">
        <section>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-semibold text-northstar">
            <ShieldCheck className="h-3.5 w-3.5" /> 三级操作分级
          </h4>
          <div className="space-y-1.5 pl-5">
            <div>
              <span className="font-medium text-task">L1 - 云端 CRUD（无需审批）</span>
              <p className="text-muted-foreground">
                创建灵感、跟进飞书任务、制作 Skill 等纯云端数据库操作，直接执行，仅记录审计日志。
              </p>
            </div>
            <div>
              <span className="font-medium text-campaign">L2 - 本地文件/浏览器（首次授权）</span>
              <p className="text-muted-foreground">
                读写授权目录内的文件、打开浏览器访问网址、截图等。首次执行需授权，本会话内同类操作不再询问（取决于授权模式）。
              </p>
            </div>
            <div>
              <span className="font-medium text-graveyard">L3 - Shell / 桌面 RPA（每次审批）</span>
              <p className="text-muted-foreground">
                执行系统命令、模拟键鼠操作、操控桌面应用。每次执行都需弹窗确认（除非切换到「免审批」模式）。
              </p>
            </div>
          </div>
        </section>

        <section>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-semibold text-northstar">
            <ShieldAlert className="h-3.5 w-3.5" /> 三档授权模式
          </h4>
          <div className="space-y-1 pl-5 text-muted-foreground">
            <div>• <span className="text-foreground">弹窗审批（默认）</span>：每次 L2/L3 操作都弹窗确认，最安全。</div>
            <div>• <span className="text-foreground">一次授权</span>：同类操作首次授权后本会话不再询问。</div>
            <div>• <span className="text-foreground">免审批</span>：仅记录日志不弹窗，效率最高，请谨慎使用。</div>
          </div>
        </section>

        <section>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-semibold text-northstar">
            <FolderPlus className="h-3.5 w-3.5" /> 授权目录白名单
          </h4>
          <p className="pl-5 text-muted-foreground">
            AI 助理仅能读写「授权目录」内的文件。默认授权目录为
            <code className="ios-glass-sm mx-1 rounded px-1 py-0.5 text-[10px]">D:\LynnHub\user-data\</code>
            ，可在此页面添加或移除。授权目录之外的路径一律拒绝访问。
          </p>
        </section>

        <section>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-semibold text-red-600">
            <StopCircle className="h-3.5 w-3.5" /> 紧急停止
          </h4>
          <p className="pl-5 text-muted-foreground">
            任何时刻点击「紧急停止」会立即中断所有本地操作，5 秒后自动解除。适用于 AI 助理执行了非预期操作时快速止损。
            也可通过系统托盘菜单的「🛑 紧急停止」触发。
          </p>
        </section>

        <section>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-semibold text-northstar">
            <RefreshCw className="h-3.5 w-3.5" /> 审计日志
          </h4>
          <p className="pl-5 text-muted-foreground">
            所有 L2/L3 操作都会写入审计日志（AgentAuditLog 表），包含操作类型、等级、授权模式、是否已授权、执行结果、耗时等。
            可在「设置 → 操作审计」页面查看历史记录。
          </p>
        </section>

        <section className="glass-card rounded-xl p-2.5">
          <h4 className="mb-1.5 font-semibold text-foreground">数据安全承诺</h4>
          <ul className="space-y-1 pl-5 text-muted-foreground">
            <li>• 所有本地操作在你的电脑上执行，文件内容不上传云端</li>
            <li>• 仅指令文本和执行结果摘要通过 WS 回传到云端（用于多端协同）</li>
            <li>• LLM 调用走你配置的 API Key（DeepSeek / MiMo），不经过中间服务器</li>
            <li>• 奇思 Agent profile 存储在 <code className="ios-glass-sm rounded px-1 py-0.5">D:\LynnHub\.lynnhub\hermes-profiles\</code> 完全本地化</li>
          </ul>
        </section>

        <div className="flex justify-end pt-2">
          <Button size="sm" onClick={onClose}>我已了解</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============ 辅助函数 ============

function renderDetectLabel(key: string): string {
  const map: Record<string, string> = {
    node: "Node.js",
    npm: "npm",
    agentBrowser: "agent-browser",
    hermesAgent: "hermes-agent",
    authorizedDir: "授权目录",
    python: "Python",
    pip: "pip",
  };
  return map[key] || key;
}

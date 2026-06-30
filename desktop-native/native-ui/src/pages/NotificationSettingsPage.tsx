import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Save,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";

interface NotificationSettings {
  ideaReminders: boolean;
  taskDueReminders: boolean;
  dailyDigest: boolean;
  desktopNotifications: boolean;
  feishuNotifications: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  ideaReminders: true,
  taskDueReminders: true,
  dailyDigest: false,
  desktopNotifications: true,
  feishuNotifications: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

// 内联 Toggle 开关组件
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

interface SettingRowProps {
  icon: React.ElementType;
  iconClass?: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

function SettingRow({
  icon: Icon,
  iconClass,
  title,
  description,
  checked,
  onChange,
  disabled,
}: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            iconClass || "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="text-[11px] text-muted-foreground">{description}</div>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  // 读取设置（404 等错误时使用默认设置，仍允许保存）
  const { isLoading, error, data: queryData } = useQuery<NotificationSettings>({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      try {
        const res = await cloudApi.get<NotificationSettings>("/api/notifications/settings");
        return { ...DEFAULT_SETTINGS, ...res };
      } catch (e) {
        const err = e as Error;
        if (err && /404|not found/i.test(err.message)) {
          return DEFAULT_SETTINGS;
        }
        throw err;
      }
    },
    retry: false,
  });

  // 同步 query 数据到本地 state（仅首次加载）
  useEffect(() => {
    if (!isLoading && !loaded) {
      if (queryData) {
        setSettings({ ...DEFAULT_SETTINGS, ...queryData });
      } else if (error) {
        // 读取失败仍允许编辑（使用默认值）
        setSettings(DEFAULT_SETTINGS);
      }
      setLoaded(true);
    }
  }, [isLoading, error, queryData, loaded]);

  const updateField = <K extends keyof NotificationSettings,>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // 保存设置：PATCH 失败回退 POST
  const saveMutation = useMutation({
    mutationFn: async (next: NotificationSettings) => {
      try {
        return await cloudApi.patch<NotificationSettings>(
          "/api/notifications/settings",
          next
        );
      } catch (e) {
        const err = e as Error;
        if (err && /404|not found|method not allowed/i.test(err.message)) {
          return await cloudApi.post<NotificationSettings>(
            "/api/notifications/settings",
            next
          );
        }
        throw e;
      }
    },
    onSuccess: (data) => {
      if (data) {
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      }
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      toast.success("通知设置已保存");
    },
    onError: (e: Error) => toast.error(e.message || "保存失败"),
  });

  // 测试通知
  const handleTest = async () => {
    setTesting(true);
    try {
      await cloudApi.post("/api/notifications/test");
      toast.success("测试通知已发送");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "测试通知发送失败");
    } finally {
      setTesting(false);
    }
  };

  // 请求桌面通知权限
  const requestDesktopPermission = async () => {
    if (typeof Notification === "undefined") {
      toast.error("当前浏览器不支持桌面通知");
      setPermissionStatus("unsupported");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermissionStatus(result);
      if (result === "granted") {
        toast.success("桌面通知权限已开启");
        updateField("desktopNotifications", true);
      } else if (result === "denied") {
        toast.error("桌面通知权限被拒绝，请在浏览器设置中开启");
        updateField("desktopNotifications", false);
      } else {
        toast.info("未做出选择，权限请求已关闭");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "请求权限失败");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      {/* 页头 */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Bell className="h-6 w-6 text-primary" />
            通知设置
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理灵感提醒、任务到期、日报等通知偏好
          </p>
        </div>
        <HelpButton module="notifications" />
      </div>

      {isLoading && !loaded ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">加载通知设置...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 通知类型 */}
          <section className="glass-card overflow-hidden">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">通知类型</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                选择希望接收的通知类型
              </p>
            </div>
            <div className="divide-y divide-border/40">
              <SettingRow
                icon={BellRing}
                iconClass="bg-cognition/10 text-cognition"
                title="灵感提醒"
                description="Inbox 灵感未收敛时定期提醒"
                checked={settings.ideaReminders}
                onChange={(v) => updateField("ideaReminders", v)}
              />
              <SettingRow
                icon={Clock}
                iconClass="bg-campaign/10 text-campaign"
                title="任务到期提醒"
                description="任务即将到期或已逾期时通知"
                checked={settings.taskDueReminders}
                onChange={(v) => updateField("taskDueReminders", v)}
              />
              <SettingRow
                icon={Bell}
                iconClass="bg-northstar/10 text-northstar"
                title="每日日报"
                description="每天固定时间发送工作总结"
                checked={settings.dailyDigest}
                onChange={(v) => updateField("dailyDigest", v)}
              />
            </div>
          </section>

          {/* 通知渠道 */}
          <section className="glass-card overflow-hidden">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">通知渠道</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                选择通知送达的渠道
              </p>
            </div>
            <div className="divide-y divide-border/40">
              <SettingRow
                icon={Monitor}
                iconClass="bg-primary/10 text-primary"
                title="桌面通知"
                description={
                  permissionStatus === "granted"
                    ? "已获得浏览器授权"
                    : permissionStatus === "denied"
                      ? "权限被拒绝，请在浏览器设置中开启"
                      : permissionStatus === "unsupported"
                        ? "当前环境不支持桌面通知"
                        : "需要先请求浏览器通知权限"
                }
                checked={settings.desktopNotifications}
                onChange={(v) => {
                  if (v && permissionStatus !== "granted") {
                    void requestDesktopPermission();
                  } else {
                    updateField("desktopNotifications", v);
                  }
                }}
              />
              <SettingRow
                icon={BellRing}
                iconClass="bg-campaign/10 text-campaign"
                title="飞书通知"
                description="通过飞书机器人推送消息"
                checked={settings.feishuNotifications}
                onChange={(v) => updateField("feishuNotifications", v)}
              />
            </div>
            {permissionStatus !== "granted" && permissionStatus !== "unsupported" && (
              <div className="border-t border-border/40 px-4 py-2.5">
                <button
                  onClick={requestDesktopPermission}
                  className="btn-glass flex h-7 items-center gap-1.5 px-2.5 text-[11px]"
                >
                  <Monitor className="h-3 w-3" />
                  {permissionStatus === "denied" ? "重新请求桌面通知权限" : "请求桌面通知权限"}
                </button>
              </div>
            )}
          </section>

          {/* 免打扰时段 */}
          <section className="glass-card overflow-hidden">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">免打扰时段</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                在此时段内不发送任何通知
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>从</span>
              </div>
              <input
                type="time"
                value={settings.quietHoursStart}
                onChange={(e) => updateField("quietHoursStart", e.target.value)}
                className="rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="text-sm text-muted-foreground">到</span>
              <input
                type="time"
                value={settings.quietHoursEnd}
                onChange={(e) => updateField("quietHoursEnd", e.target.value)}
                className="rounded-lg border border-border/60 bg-background/40 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </section>

          {/* 测试 + 保存 */}
          <section className="glass-card flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {permissionStatus === "granted" ? (
                <CheckCircle2 className="h-4 w-4 text-task" />
              ) : permissionStatus === "denied" ? (
                <XCircle className="h-4 w-4 text-graveyard" />
              ) : (
                <Bell className="h-4 w-4 text-muted-foreground" />
              )}
              <span>
                {permissionStatus === "granted"
                  ? "桌面通知权限已开启"
                  : permissionStatus === "denied"
                    ? "桌面通知权限被拒绝"
                    : permissionStatus === "unsupported"
                      ? "当前环境不支持桌面通知"
                      : "桌面通知权限未开启"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={testing}
                className="btn-glass flex h-8 items-center gap-1.5 px-3 text-xs"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                发送测试通知
              </button>
              <button
                onClick={() => saveMutation.mutate(settings)}
                disabled={saveMutation.isPending}
                className="btn-primary-glass flex h-8 items-center gap-1.5 px-3 text-xs disabled:opacity-50"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                保存设置
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

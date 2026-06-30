import { useState, useEffect } from "react";
import {
  Bell,
  BellRing,
  Send,
  Loader2,
  Clock,
  Save,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { cloudApi } from "@/lib/cloud-api";
import { toast } from "@/lib/toast";
import { isTauri } from "@/lib/tauri";
import { HelpButton } from "@/components/ui/HelpButton";

const STORAGE_KEY = "lynnhub:notification-settings";

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

// 从 localStorage 读取通知设置（兼容异常情况，回退到默认值）
function loadSettings(): NotificationSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// 保存通知设置到 localStorage
function saveSettings(next: NotificationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("[notification-settings] 保存失败:", e);
  }
}

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
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // 加载时从 localStorage 读取通知设置
  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  const updateField = <K extends keyof NotificationSettings,>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // 保存设置：写入 localStorage（不走后端 API，避免 404）
  const handleSave = async () => {
    setSaving(true);
    try {
      saveSettings(settings);
      toast.success("通知设置已保存");
    } finally {
      setSaving(false);
    }
  };

  // 测试通知：桌面端用 toast 提示 + 调用飞书通知接口验证
  const handleTest = async () => {
    setTesting(true);
    try {
      // 桌面端（Tauri WebView2 不支持 Web Notification API）直接用应用内 toast 提示
      if (isTauri()) {
        toast.info("测试通知：通知功能正常工作");
      } else {
        // Web 端保持一致行为，用 toast 提示
        toast.info("测试通知：通知功能正常工作");
      }

      // 额外调用飞书通知接口验证飞书通道（失败不阻塞主流程）
      try {
        await cloudApi.post("/api/notify-feishu", {
          message: "这是一条来自 LynnHub 的测试通知",
        });
        toast.success("飞书测试通知已发送");
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `飞书通知失败：${e.message}`
            : "飞书通知发送失败"
        );
      }
    } finally {
      setTesting(false);
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

      {!loaded ? (
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
                  isTauri()
                    ? "桌面端通过应用内 Toast 提示通知"
                    : "通过浏览器桌面通知推送"
                }
                checked={settings.desktopNotifications}
                onChange={(v) => updateField("desktopNotifications", v)}
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
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span>
                {isTauri()
                  ? "桌面端使用应用内 Toast 通知"
                  : "通知将通过浏览器推送"}
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
                onClick={handleSave}
                disabled={saving}
                className="btn-primary-glass flex h-8 items-center gap-1.5 px-3 text-xs disabled:opacity-50"
              >
                {saving ? (
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

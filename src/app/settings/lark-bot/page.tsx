"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  Link as LinkIcon,
  KeyRound,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { PageHeader, Card, Button } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";

// 旧版 localStorage 键（仅用于一次性迁移到数据库）
const LEGACY_WEBHOOK_URL_KEY = "lark-bot-webhook-url";
const LEGACY_WEBHOOK_TOKEN_KEY = "lark-bot-webhook-token";

type ConnectionState = "idle" | "testing" | "connected" | "failed";

type TestResult = {
  success: boolean;
  status?: number;
  durationMs?: number;
  response?: unknown;
  error?: string;
};

export default function LarkBotSettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookToken, setWebhookToken] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // 从数据库加载已保存的配置，并执行一次性 localStorage 迁移
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. 检测 localStorage 是否有旧配置（首次迁移）
        const legacyUrl = localStorage.getItem(LEGACY_WEBHOOK_URL_KEY);
        const legacyToken = localStorage.getItem(LEGACY_WEBHOOK_TOKEN_KEY);
        if (legacyUrl || legacyToken) {
          // 将旧配置 PUT 到数据库
          const migrateRes = await fetch("/api/ai/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              larkWebhookUrl: (legacyUrl || "").trim() || null,
              larkWebhookToken: (legacyToken || "").trim() || null,
            }),
          });
          if (migrateRes.ok && !cancelled) {
            setWebhookUrl((legacyUrl || "").trim());
            setWebhookToken((legacyToken || "").trim());
            toast("已迁移旧配置到数据库", "success");
          }
          // 无论迁移成功与否，都清除旧 key，避免反复迁移
          localStorage.removeItem(LEGACY_WEBHOOK_URL_KEY);
          localStorage.removeItem(LEGACY_WEBHOOK_TOKEN_KEY);
          if (cancelled) return;
          setLoading(false);
          return;
        }

        // 2. 无旧配置：从数据库读取
        const res = await fetch("/api/ai/settings", { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          const settings = data.settings || {};
          if (!cancelled) {
            setWebhookUrl(settings.larkWebhookUrl || "");
            setWebhookToken(settings.larkWebhookToken || "");
          }
        }
      } catch {
        // 加载失败不阻塞用户编辑
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 保存 Webhook URL 到数据库
  const handleSaveUrl = async () => {
    if (!webhookUrl.trim()) {
      toast("Webhook URL 不能为空", "error");
      return;
    }
    setSavingUrl(true);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ larkWebhookUrl: webhookUrl.trim() }),
      });
      if (res.ok) {
        toast("Webhook URL 已保存", "success");
        setConnectionState("idle");
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error || "保存失败", "error");
      }
    } catch {
      toast("保存失败", "error");
    } finally {
      setSavingUrl(false);
    }
  };

  // 保存 Webhook Token 到数据库
  const handleSaveToken = async () => {
    setSavingToken(true);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ larkWebhookToken: webhookToken.trim() || null }),
      });
      if (res.ok) {
        toast("Webhook Token 已保存", "success");
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error || "保存失败", "error");
      }
    } catch {
      toast("保存失败", "error");
    } finally {
      setSavingToken(false);
    }
  };

  // 发送测试消息（传入当前输入框的值，无需先保存）
  const handleTest = async () => {
    if (!webhookUrl.trim()) {
      toast("请先填写 Webhook URL", "error");
      return;
    }
    setTesting(true);
    setConnectionState("testing");
    setTestResult(null);
    try {
      const res = await fetch("/api/lark-bot/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          webhookToken: webhookToken.trim() || undefined,
          message: testMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionState("connected");
        setTestResult(data);
        toast("测试消息发送成功", "success");
      } else {
        setConnectionState("failed");
        setTestResult(data);
        toast(data.error || "测试消息发送失败", "error");
      }
    } catch (e) {
      setConnectionState("failed");
      setTestResult({ success: false, error: (e as Error).message });
      toast("网络请求失败", "error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="飞书机器人"
        subtitle="配置飞书自定义机器人 Webhook，向指定群组发送消息通知"
        action={<HelpButton contentKey="settings-lark-bot" />}
      />

      {/* 连接状态 */}
      <Card className="mb-5">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-campaign" />
          <h2 className="text-sm font-semibold">连接状态</h2>
        </div>
        <div className="flex items-center gap-3">
          {connectionState === "idle" && (
            <>
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">
                {webhookUrl ? "已配置，未测试" : "未配置"}
              </span>
            </>
          )}
          {connectionState === "testing" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-campaign" />
              <span className="text-xs text-campaign">测试中...</span>
            </>
          )}
          {connectionState === "connected" && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-task" />
              <span className="text-xs text-task">连接成功</span>
            </>
          )}
          {connectionState === "failed" && (
            <>
              <XCircle className="h-3.5 w-3.5 text-graveyard" />
              <span className="text-xs text-graveyard">连接失败</span>
            </>
          )}
        </div>
        {testResult && (
          <div className="mt-3 rounded-md border border-border/60 bg-muted/20 p-3 text-[11px]">
            <div className="mb-1 font-medium text-foreground">测试结果</div>
            <div className="space-y-1 text-muted-foreground">
              <div>状态码：{testResult.status ?? "-"}</div>
              {testResult.durationMs !== undefined && (
                <div>耗时：{testResult.durationMs}ms</div>
              )}
              {testResult.error && (
                <div className="text-graveyard">错误：{testResult.error}</div>
              )}
              {testResult.response !== undefined && (
                <div className="break-all">
                  响应：{JSON.stringify(testResult.response)}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Webhook URL 配置 */}
      <Card className="mb-5">
        <div className="mb-4 flex items-center gap-2">
          <LinkIcon className="h-4 w-4 text-cognition" />
          <h2 className="text-sm font-semibold">Webhook URL</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          在飞书群聊中添加「自定义机器人」，复制生成的 Webhook 地址填入此处。
          格式通常为：https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-campaign focus:outline-none focus:ring-1 focus:ring-campaign/30"
          />
          <Button
            onClick={handleSaveUrl}
            disabled={loading || savingUrl}
            size="md"
            className="shrink-0"
          >
            {savingUrl ? "保存中..." : "保存"}
          </Button>
        </div>
      </Card>

      {/* Webhook Token 配置 */}
      <Card className="mb-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-northstar" />
          <h2 className="text-sm font-semibold">Webhook Token（签名校验）</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          若在飞书机器人安全设置中启用了「签名校验」，请填入此处配置的 Secret。
          未启用签名校验时可留空。
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="password"
            value={webhookToken}
            onChange={(e) => setWebhookToken(e.target.value)}
            placeholder="签名校验 Secret（可选）"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-northstar focus:outline-none focus:ring-1 focus:ring-northstar/30"
          />
          <Button
            onClick={handleSaveToken}
            disabled={loading || savingToken}
            variant="outline"
            size="md"
            className="shrink-0"
          >
            {savingToken ? "保存中..." : "保存"}
          </Button>
        </div>
      </Card>

      {/* 发送测试消息 */}
      <Card className="mb-5">
        <div className="mb-4 flex items-center gap-2">
          <Send className="h-4 w-4 text-task" />
          <h2 className="text-sm font-semibold">发送测试消息</h2>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          向配置的 Webhook 地址发送一条测试消息，验证连接是否正常。
        </p>
        <div className="mb-3">
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="自定义测试消息内容（留空使用默认内容）"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-task focus:outline-none focus:ring-1 focus:ring-task/30"
          />
        </div>
        <Button
          onClick={handleTest}
          disabled={loading || testing || !webhookUrl.trim()}
          size="md"
        >
          {testing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              发送中...
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              发送测试消息
            </>
          )}
        </Button>
      </Card>

      {/* 配置指引（详细说明见右上角使用说明弹窗） */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">配置指引</h2>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">1. 创建机器人：</span>
            打开飞书群聊 → 群设置 → 群机器人 → 添加机器人 → 选择「自定义机器人」
          </div>
          <div>
            <span className="font-medium text-foreground">2. 复制 Webhook：</span>
            创建完成后复制 Webhook 地址，粘贴到上方配置框并保存
          </div>
          <div>
            <span className="font-medium text-foreground">3. 安全设置：</span>
            可选启用「签名校验」或「自定义关键词」，启用后需在此页面对应配置
          </div>
          <div>
            <span className="font-medium text-foreground">4. 测试连接：</span>
            点击「发送测试消息」验证配置是否正确
          </div>
        </div>
      </Card>
    </div>
  );
}

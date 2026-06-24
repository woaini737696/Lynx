"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bell,
  BellRing,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { PageHeader, Card, Button } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type SubStatus = "checking" | "subscribed" | "unsubscribed" | "unsupported";

export default function PushSettingsPage() {
  const [status, setStatus] = useState<SubStatus>("checking");
  const [vapidReady, setVapidReady] = useState<boolean | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [testing, setTesting] = useState(false);

  // 检查浏览器是否支持推送 + 检查服务端 VAPID 配置 + 查询当前订阅状态
  const checkStatus = useCallback(async () => {
    // 检查浏览器支持
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    try {
      // 检查服务端 VAPID 配置
      const cfgRes = await fetch("/api/push/test");
      const cfgData = await cfgRes.json();
      setVapidReady(cfgData.configured === true);

      // 查询数据库中的订阅状态
      const subRes = await fetch("/api/push/subscribe");
      if (subRes.ok) {
        const subData = await subRes.json();
        setStatus(subData.subscribed ? "subscribed" : "unsubscribed");
      } else {
        setStatus("unsubscribed");
      }
    } catch {
      setStatus("unsubscribed");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // 将 base64url 字符串转为 Uint8Array（订阅时需要 VAPID 公钥）
  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      output[i] = rawData.charCodeAt(i);
    }
    return output;
  }

  // 订阅推送
  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      // 获取 VAPID 公钥
      const cfgRes = await fetch("/api/push/test");
      const cfgData = await cfgRes.json();
      if (!cfgData.configured || !cfgData.publicKey) {
        toast("服务端 VAPID 未配置，请联系管理员", "error");
        setSubscribing(false);
        return;
      }

      // 注册/获取 Service Worker
      const reg = await navigator.serviceWorker.ready;

      // 订阅推送
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfgData.publicKey) as BufferSource,
      });

      const subObj = subscription.toJSON();
      if (!subObj.endpoint || !subObj.keys?.p256dh || !subObj.keys?.auth) {
        throw new Error("订阅数据不完整");
      }

      // 发送到服务端保存
      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subObj.endpoint,
          keys: {
            p256dh: subObj.keys.p256dh,
            auth: subObj.keys.auth,
          },
        }),
      });

      if (saveRes.ok) {
        toast("订阅成功，将可以接收推送通知", "success");
        setStatus("subscribed");
      } else {
        const err = await saveRes.json();
        toast(err.error || "订阅保存失败", "error");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "未知错误";
      toast(`订阅失败: ${msg}`, "error");
    } finally {
      setSubscribing(false);
    }
  };

  // 取消订阅
  const handleUnsubscribe = async () => {
    setSubscribing(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      // 通知服务端删除
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription?.endpoint }),
      });

      toast("已取消订阅", "info");
      setStatus("unsubscribed");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "未知错误";
      toast(`取消订阅失败: ${msg}`, "error");
    } finally {
      setSubscribing(false);
    }
  };

  // 发送测试推送
  const handleTestPush = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(
          `测试通知已发送（成功 ${data.successCount}/${data.total}）`,
          "success"
        );
      } else {
        toast(data.error || `发送失败（${data.failedCount} 个订阅失败）`, "error");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "未知错误";
      toast(`测试推送失败: ${msg}`, "error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="通知设置"
        subtitle="Web Push 推送通知 · 订阅后可接收灵感提醒、任务到期等通知"
      />

      {/* 浏览器支持检查 */}
      {status === "unsupported" && (
        <Card className="mb-5 border-graveyard/30 bg-graveyard/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-graveyard" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                当前浏览器不支持 Web Push 通知
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                请使用 Chrome、Edge、Firefox 等现代浏览器，并确保已启用通知权限。
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* VAPID 配置状态 */}
      {vapidReady === false && status !== "unsupported" && (
        <Card className="mb-5 border-campaign/30 bg-campaign/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-campaign" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                服务端 VAPID 未配置
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                推送通知功能需要配置 VAPID keys。请在 .env 中设置
                VAPID_PUBLIC_KEY、VAPID_PRIVATE_KEY、VAPID_SUBJECT，
                可通过 <code className="rounded bg-muted px-1 py-0.5">npx web-push generate-vapid-keys</code> 生成。
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 订阅状态卡片 */}
      <Card className="mb-5">
        <div className="mb-4 flex items-center gap-2">
          {status === "subscribed" ? (
            <BellRing className="h-4 w-4 text-task" />
          ) : (
            <Bell className="h-4 w-4 text-muted-foreground" />
          )}
          <h2 className="text-sm font-semibold">订阅状态</h2>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
          {status === "checking" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">检查中...</span>
            </>
          ) : status === "subscribed" ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-task" />
              <span className="text-xs font-medium text-task">已订阅推送通知</span>
            </>
          ) : status === "unsupported" ? (
            <>
              <XCircle className="h-4 w-4 text-graveyard" />
              <span className="text-xs text-graveyard">不支持推送通知</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">未订阅</span>
            </>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="mt-4 flex flex-wrap gap-2">
          {status !== "subscribed" ? (
            <Button
              onClick={handleSubscribe}
              disabled={
                subscribing ||
                status === "checking" ||
                status === "unsupported" ||
                vapidReady === false
              }
            >
              {subscribing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 订阅中...
                </>
              ) : (
                <>
                  <BellRing className="h-3.5 w-3.5" /> 订阅推送通知
                </>
              )}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleTestPush} disabled={testing}>
                {testing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 发送中...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" /> 发送测试通知
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={handleUnsubscribe}
                disabled={subscribing}
                className="text-graveyard hover:bg-graveyard/10"
              >
                取消订阅
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* 使用说明 */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-cognition" />
          <h2 className="text-sm font-semibold">使用说明</h2>
        </div>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">1. 订阅</strong>
            ：点击「订阅推送通知」按钮，浏览器会弹出授权提示，允许后即可接收通知。
          </p>
          <p>
            <strong className="text-foreground">2. 测试</strong>
            ：订阅成功后，点击「发送测试通知」验证推送是否正常工作。
          </p>
          <p>
            <strong className="text-foreground">3. 取消</strong>
            ：如不再需要通知，可点击「取消订阅」移除订阅。
          </p>
          <p className="rounded-lg bg-muted/30 px-3 py-2 text-[11px]">
            注意：推送通知需要 HTTPS 环境（localhost 除外）和已注册的 Service Worker。
            如果浏览器不支持或通知权限被拒绝，将无法订阅。
          </p>
        </div>
      </Card>
    </div>
  );
}

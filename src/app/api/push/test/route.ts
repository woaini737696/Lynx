// Web Push 测试推送 API
// POST: 向当前用户的所有订阅发送测试推送通知
// 支持可选 body { title, body }：传入则发送自定义内容（用于巡检通知），不传则发送默认测试消息
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import {
  sendPushNotification,
  isPushConfigured,
  getVapidPublicKey,
  type PushSubscriptionObject,
} from "@/lib/push";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  // 检查 VAPID 是否配置
  if (!isPushConfigured()) {
    return NextResponse.json(
      {
        error:
          "VAPID keys 未配置，请在 .env 中设置 VAPID_PUBLIC_KEY、VAPID_PRIVATE_KEY、VAPID_SUBJECT",
      },
      { status: 500 }
    );
  }

  // 解析可选的自定义标题和正文（用于巡检通知等场景）
  let customTitle: string | undefined;
  let customBody: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.title === "string") customTitle = body.title;
    if (body && typeof body.body === "string") customBody = body.body;
  } catch {
    // 无 body 或解析失败时使用默认测试消息
  }

  try {
    // 获取当前用户的所有订阅
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: auth.user.id },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: "暂无推送订阅，请先在通知设置中订阅" },
        { status: 404 }
      );
    }

    const payload = {
      title: customTitle || "LynnHub 测试通知",
      body: customBody || `这是一条测试推送通知 · ${new Date().toLocaleString("zh-CN")}`,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: customTitle ? "lynnhub-notify" : "lynnhub-test",
      data: {
        url: "/",
      },
    };

    // 并行发送到所有订阅
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const subscription: PushSubscriptionObject = {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        };
        const result = await sendPushNotification(subscription, payload);
        // 如果订阅已失效（410 Gone / 404），从数据库删除
        if (!result.success && result.error?.includes("410")) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
        return { id: sub.id, ...result };
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      success: successCount > 0,
      total: results.length,
      successCount,
      failedCount,
      results,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json(
      { error: `测试推送失败: ${msg}` },
      { status: 500 }
    );
  }
}

// GET: 返回 VAPID 公钥（供前端订阅使用）
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "VAPID 公钥未配置", configured: false },
      { status: 500 }
    );
  }

  return NextResponse.json({ publicKey, configured: true });
}

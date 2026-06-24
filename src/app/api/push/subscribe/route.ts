// Web Push 订阅 API
// POST: 接收 subscription 对象，存入数据库
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import type { PushSubscriptionObject } from "@/lib/push";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = (await request.json()) as PushSubscriptionObject;

    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      return NextResponse.json(
        { error: "订阅数据不完整，需要 endpoint 和 keys（p256dh, auth）" },
        { status: 400 }
      );
    }

    // upsert：同一 endpoint 只保留一条记录，更新 keys 和 userId
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        endpoint: body.endpoint,
        keys: body.keys,
        userId: auth.user.id,
      },
      update: {
        keys: body.keys,
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ success: true, id: sub.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json(
      { error: `订阅保存失败: ${msg}` },
      { status: 500 }
    );
  }
}

// DELETE: 取消订阅
export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = (await request.json()) as { endpoint?: string };
    if (!body?.endpoint) {
      return NextResponse.json(
        { error: "需要提供 endpoint" },
        { status: 400 }
      );
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint },
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json(
      { error: `取消订阅失败: ${msg}` },
      { status: 500 }
    );
  }
}

// GET: 查询当前用户的订阅状态
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const count = await prisma.pushSubscription.count({
      where: { userId: auth.user.id },
    });

    return NextResponse.json({ subscribed: count > 0, count });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json(
      { error: `查询订阅状态失败: ${msg}` },
      { status: 500 }
    );
  }
}

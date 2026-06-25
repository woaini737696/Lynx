import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { runLarkCliService, getCurrentUser, shellQuote } from "@/lib/lark-sync";

const logger = getLogger("hermes-chat-to-user");

// POST /api/hermes/chat-to-user - Hermes 主动向用户发送消息（模式 C：主动沟通）
// body: { message: string, priority?: "normal" | "urgent" }
// 让 Hermes Agent 主动通过飞书机器人向用户发起对话/通知
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误，需为 JSON" },
        { status: 400 }
      );
    }

    const { message, priority = "normal" } = body as {
      message?: unknown;
      priority?: "normal" | "urgent";
    };

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "message 必须为非空字符串" },
        { status: 400 }
      );
    }

    if (priority !== "normal" && priority !== "urgent") {
      return NextResponse.json(
        { error: "priority 必须为 normal | urgent" },
        { status: 400 }
      );
    }

    // 1. 检查 feishuNotify 是否开启
    const aiSettings = await prisma.aISetting.findFirst();
    if (!aiSettings?.feishuNotify) {
      return NextResponse.json(
        { error: "飞书通知未启用，请在 AI 助理设置中开启「飞书通知」" },
        { status: 403 }
      );
    }

    // 2. 获取当前用户 openId
    const me = getCurrentUser();
    if (!me?.openId) {
      return NextResponse.json(
        { error: "无法获取当前用户身份，请检查飞书凭证配置" },
        { status: 500 }
      );
    }

    // 3. 通过飞书机器人发送消息
    const prefix = priority === "urgent" ? "🚨【Hermes 紧急】\n" : "🤖【Hermes 主动沟通】\n";
    const text = prefix + message.trim();
    const res = runLarkCliService(
      "im",
      `+messages-send --user-id ${shellQuote(me.openId)} --text ${shellQuote(text)}`
    );

    const sent = res.ok;

    // 4. 将消息存为 HermesReport（type="chat"，便于后续检索 Hermes 主动沟通历史）
    try {
      await prisma.hermesReport.create({
        data: {
          userId: auth.user.id,
          type: "chat",
          title: priority === "urgent" ? "Hermes 紧急沟通" : "Hermes 主动沟通",
          content: message.trim(),
          rawOutput: text,
          trigger: "manual",
          pushed: sent,
          pushChannel: sent ? "feishu" : null,
          durationMs: 0,
          error: sent ? null : res.error || "飞书发送失败",
        },
      });
    } catch (e) {
      logger.warn({ err: e }, "存储 Hermes 主动沟通记录失败（非阻塞）");
    }

    if (!sent) {
      return NextResponse.json(
        { success: false, sent: false, error: `飞书消息发送失败：${res.error}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      sent: true,
    });
  } catch (e) {
    logger.error({ err: e }, "Hermes 主动沟通失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

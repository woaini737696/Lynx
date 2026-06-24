import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, runLarkCliService } from "@/lib/lark-sync";
import { prisma } from "@/lib/db";

// POST /api/ai/notify-feishu
// 接收 { message, urgent? } 向当前用户发送飞书消息
// AI助理有急事通知用户时调用此接口
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误" },
        { status: 400 }
      );
    }

    const { message, urgent = false } = body as { message?: unknown; urgent?: boolean };
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "message 必须为非空字符串" },
        { status: 400 }
      );
    }

    // 检查是否启用了飞书通知
    const settings = await prisma.aISetting.findFirst();
    if (!settings?.feishuNotify) {
      return NextResponse.json(
        { error: "飞书通知未启用，请在设置中开启" },
        { status: 403 }
      );
    }

    // 获取当前用户 open_id
    const me = getCurrentUser();
    if (!me) {
      return NextResponse.json(
        { error: "无法获取当前用户身份，请检查飞书凭证配置" },
        { status: 500 }
      );
    }

    // 构造消息文本
    const prefix = urgent ? "🚨【紧急通知】\n" : "🔔【AI助理提醒】\n";
    const text = prefix + message.trim();

    // 调用 lark-cli im +messages-send 发送消息
    // 使用 --user-id 发送私信，--as bot 以机器人身份发送
    const shellQuote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
    const res = runLarkCliService(
      "im",
      `+messages-send --user-id ${shellQuote(me.openId)} --text ${shellQuote(text)}`
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `发送飞书消息失败：${res.error}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "通知已发送",
      userId: me.openId,
    });
  } catch (e) {
    console.error("Feishu notify error:", e);
    return NextResponse.json(
      { error: "飞书通知服务错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

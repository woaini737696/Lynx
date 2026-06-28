import { NextRequest, NextResponse } from "next/server";

const lastSendMap = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone || !/^1\d{10}$/.test(phone)) {
      return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
    }

    // 限流：60秒内同一手机号只能请求一次
    const now = Date.now();
    const lastSend = lastSendMap.get(phone);
    if (lastSend && now - lastSend < 60000) {
      const waitSec = Math.ceil((60000 - (now - lastSend)) / 1000);
      return NextResponse.json({ error: `请${waitSec}秒后再试` }, { status: 429 });
    }
    lastSendMap.set(phone, now);

    // 万能验证码（从环境变量读取，默认 888888）
    // 开发环境不实际发送短信，前端会提示输入万能验证码
    const masterCode = process.env.SMS_MASTER_CODE || "888888";

    return NextResponse.json({
      ok: true,
      message: "验证码已发送",
      // 开发环境提示万能码（生产环境移除此字段）
      devHint: process.env.NODE_ENV === "development" ? `开发环境万能码: ${masterCode}` : undefined,
    });
  } catch {
    return NextResponse.json({ error: "请求失败" }, { status: 500 });
  }
}

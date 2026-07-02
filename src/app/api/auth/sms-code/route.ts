import { NextRequest, NextResponse } from "next/server";
import { isMasterCodeEnabled } from "@/lib/auth-config";

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

    // 万能验证码：仅返回是否启用，不泄露验证码本身
    const enabled = await isMasterCodeEnabled();

    return NextResponse.json({
      ok: true,
      message: enabled
        ? "验证码已发送"
        : "验证码登录未启用，请使用手机号+密码登录",
      masterCodeEnabled: enabled,
    });
  } catch {
    return NextResponse.json({ error: "请求失败" }, { status: 500 });
  }
}

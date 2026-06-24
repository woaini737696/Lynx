import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { requireAuth } from "@/lib/auth-utils";

// 生成飞书自定义机器人签名校验
// 算法：sign = base64(hmac_sha256(timestamp + "\n" + secret, ""))
// 飞书文档：https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
function generateSign(timestamp: number, secret: string): string {
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = createHmac("sha256", stringToSign);
  hmac.update("");
  return hmac.digest("base64");
}

// POST /api/lark-bot/test - 向配置的飞书 Webhook 发送测试消息
// body: { webhookUrl, message?, webhookToken? }
// 返回发送结果
export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const body = await req.json();
    const { webhookUrl, message, webhookToken } = body as {
      webhookUrl: string;
      message?: string;
      webhookToken?: string;
    };

    if (!webhookUrl || !webhookUrl.trim()) {
      return NextResponse.json(
        { error: "webhookUrl 不能为空" },
        { status: 400 }
      );
    }

    // 校验 URL 格式（飞书自定义机器人 webhook 通常为 https://open.feishu.cn/open-apis/bot/v2/hook/xxx）
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(webhookUrl.trim());
    } catch {
      return NextResponse.json(
        { error: "webhookUrl 格式不正确" },
        { status: 400 }
      );
    }

    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "webhookUrl 必须是 http(s) 协议" },
        { status: 400 }
      );
    }

    // 发送测试消息（飞书自定义机器人消息格式）
    const text = message || "✅ LynnHub 飞书机器人测试消息：连接成功！";
    const payload: Record<string, unknown> = {
      msg_type: "text",
      content: { text },
    };

    // 如果配置了签名校验 secret，添加 timestamp 和 sign 字段
    const token = (webhookToken || "").trim();
    if (token) {
      const timestamp = Math.floor(Date.now() / 1000);
      payload.timestamp = String(timestamp);
      payload.sign = generateSign(timestamp, token);
    }

    const startTime = Date.now();
    const res = await fetch(parsedUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const durationMs = Date.now() - startTime;

    const responseText = await res.text();
    let responseData: unknown = responseText;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // 非 JSON 响应，保留原始文本
    }

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        status: res.status,
        durationMs,
        response: responseData,
        error: `飞书 Webhook 返回错误状态码：${res.status}`,
      }, { status: 200 });
    }

    // 飞书成功响应通常为 { code: 0, msg: "success" } 或 { StatusCode: 0 }
    const code =
      (responseData as { code?: number; StatusCode?: number })?.code ??
      (responseData as { StatusCode?: number })?.StatusCode;
    if (code !== undefined && code !== 0) {
      const msg = (responseData as { msg?: string })?.msg || "";
      return NextResponse.json({
        success: false,
        status: res.status,
        durationMs,
        response: responseData,
        error: `飞书 Webhook 返回业务错误码：${code}${msg ? `（${msg}）` : ""}`,
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      status: res.status,
      durationMs,
      response: responseData,
    });
  } catch (e) {
    console.error("飞书机器人测试消息发送失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

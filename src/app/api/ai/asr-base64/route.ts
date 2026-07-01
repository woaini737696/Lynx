import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

// 强制使用 Node.js Runtime
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/ai/asr-base64
// 接收 JSON body: { audio: "base64编码的音频数据", mimeType: "audio/wav" }
// 调用小米 MiMo ASR API，返回 { text: "识别结果" }
//
// 这个端点是为了替代 multipart/form-data 方案，避免以下问题：
// 1. Next.js Edge Runtime 的 formData() 解析限制
// 2. multipart 边界问题导致的 400 错误
// 3. 某些代理/CDN 对 multipart 的处理不一致
//
// 安卓客户端在 multipart 失败时自动 fallback 到这个端点

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.audio) {
      return NextResponse.json(
        { error: "请求体需为 JSON，包含 audio 字段（base64 编码）" },
        { status: 400 }
      );
    }

    const base64Audio: string = body.audio;
    const mimeType: string = body.mimeType || "audio/wav";

    // 验证 base64 数据
    if (base64Audio.length < 100) {
      return NextResponse.json(
        { error: "音频数据过短，可能未正确编码" },
        { status: 400 }
      );
    }

    // 读取 MiMo 配置
    const apiKey = process.env.ASR_API_KEY || process.env.MIMO_API_KEY || "";
    const baseUrl =
      process.env.ASR_BASE_URL || process.env.MIMO_BASE_URL || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "MiMo ASR 未配置 API Key" },
        { status: 500 }
      );
    }
    if (!baseUrl) {
      return NextResponse.json(
        { error: "MiMo ASR 未配置 Base URL" },
        { status: 500 }
      );
    }

    const asrModel =
      process.env.ASR_MODEL || process.env.MIMO_ASR_MODEL || "mimo-v2.5-asr";
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    const dataUrl = `data:${mimeType};base64,${base64Audio}`;

    const asrBody: Record<string, unknown> = {
      model: asrModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: dataUrl,
              },
            },
          ],
        },
      ],
      asr_options: {
        language: "zh",
      },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(asrBody),
      });
    } catch (e) {
      return NextResponse.json(
        { error: `调用 MiMo ASR 网络错误：${(e as Error).message}` },
        { status: 502 }
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `MiMo ASR 返回错误 ${res.status}：${errText.slice(0, 500)}`,
        },
        { status: 502 }
      );
    }

    const data = await res.json().catch(() => null);
    if (!data) {
      return NextResponse.json(
        { error: "MiMo ASR 响应解析失败：非 JSON 格式" },
        { status: 502 }
      );
    }

    const message = data?.choices?.[0]?.message;
    let text: string | null = null;

    if (typeof message?.content === "string") {
      text = message.content;
    } else if (Array.isArray(message?.content)) {
      const textPart = message.content.find(
        (p: { type?: string; text?: string }) =>
          p.type === "text" && typeof p.text === "string"
      );
      text = textPart?.text || null;
    }

    if (!text) {
      return NextResponse.json(
        {
          error: "MiMo ASR 响应中未找到识别文本",
          debug: JSON.stringify(data).slice(0, 500),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json(
      { error: "ASR 服务错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

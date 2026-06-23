import { NextRequest, NextResponse } from "next/server";

// POST /api/ai/tts
// 接收 { text, voice?, speed? }，调用小米 MiMo TTS API
// MiMo TTS 使用 /chat/completions 端点（非 OpenAI /audio/speech），
// 模型名 mimo-v2-tts，通过 messages + audio 参数合成语音，
// 返回 base64 编码的 WAV 音频数据。
// 文档：https://platform.xiaomimimo.com/#/docs/usage-guide/speech-synthesis

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误，需为 JSON" },
        { status: 400 }
      );
    }

    const { text, voice } = body as {
      text?: unknown;
      voice?: unknown;
    };

    // 校验 text
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "text 必须为非空字符串" },
        { status: 400 }
      );
    }

    // 读取 MiMo 配置：优先 TTS专用Key，回退 MIMO_API_KEY
    const apiKey = process.env.TTS_API_KEY || process.env.MIMO_API_KEY || "";
    const baseUrl =
      process.env.TTS_BASE_URL || process.env.MIMO_BASE_URL || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "MiMo TTS 未配置 API Key（环境变量 TTS_API_KEY 或 MIMO_API_KEY）" },
        { status: 500 }
      );
    }
    if (!baseUrl) {
      return NextResponse.json(
        { error: "MiMo TTS 未配置 Base URL（环境变量 TTS_BASE_URL 或 MIMO_BASE_URL）" },
        { status: 500 }
      );
    }

    // TTS 模型名：优先 TTS_MODEL / MIMO_TTS_MODEL，回退默认
    const ttsModel =
      process.env.TTS_MODEL || process.env.MIMO_TTS_MODEL || "mimo-v2-tts";
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    // MiMo TTS 请求体格式：
    // - model: mimo-v2-tts
    // - messages: [{ role: "assistant", content: "待合成文本" }]
    // - audio: { format: "wav", voice: "mimo_default" }
    const ttsBody: Record<string, unknown> = {
      model: ttsModel,
      messages: [
        {
          role: "assistant",
          content: text,
        },
      ],
      audio: {
        format: "wav",
        voice: typeof voice === "string" && voice ? voice : "mimo_default",
      },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // MiMo 支持 api-key 或 Authorization: Bearer 两种认证方式
          "api-key": apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(ttsBody),
      });
    } catch (e) {
      return NextResponse.json(
        { error: `调用 MiMo TTS 网络错误：${(e as Error).message}` },
        { status: 502 }
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `MiMo TTS 返回错误 ${res.status}：${errText.slice(0, 500)}`,
        },
        { status: 502 }
      );
    }

    // 解析响应：choices[0].message.audio.data 包含 base64 编码的 WAV 音频
    const data = await res.json().catch(() => null);
    if (!data) {
      return NextResponse.json(
        { error: "MiMo TTS 响应解析失败：非 JSON 格式" },
        { status: 502 }
      );
    }

    const audioData =
      data?.choices?.[0]?.message?.audio?.data ||
      data?.choices?.[0]?.message?.audio?.content;

    if (!audioData) {
      return NextResponse.json(
        {
          error: "MiMo TTS 响应中未找到音频数据",
          debug: JSON.stringify(data).slice(0, 500),
        },
        { status: 502 }
      );
    }

    // 如果是 data URL 格式（data:audio/wav;base64,...），提取 base64 部分
    const base64Match = String(audioData).match(/^data:[^;]+;base64,(.+)$/);
    const base64String = base64Match ? base64Match[1] : String(audioData);

    // base64 → Buffer
    const audioBuffer = Buffer.from(base64String, "base64");

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "TTS 服务错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

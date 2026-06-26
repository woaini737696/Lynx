import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// POST /api/ai/tts
// 接收 { text, voice?, speed? }，调用小米 MiMo TTS API
// MiMo TTS 使用 /chat/completions 端点（非 OpenAI /audio/speech），
// 模型名 MiMo-V2.5-TTS，通过 messages + audio 参数合成语音，
// 返回 WAV 音频数据。

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
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

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "text 必须为非空字符串" },
        { status: 400 }
      );
    }

    const apiKey = process.env.TTS_API_KEY || process.env.MIMO_API_KEY || "";
    const baseUrl = process.env.TTS_BASE_URL || process.env.MIMO_BASE_URL || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "MiMo TTS 未配置 API Key" },
        { status: 500 }
      );
    }
    if (!baseUrl) {
      return NextResponse.json(
        { error: "MiMo TTS 未配置 Base URL" },
        { status: 500 }
      );
    }

    const ttsModel = process.env.TTS_MODEL || "mimo-v2.5-tts";
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    // 确定使用的音色：请求指定 > 复刻音色 > 默认音色
    let selectedVoice = typeof voice === "string" && voice ? voice : null;

    if (!selectedVoice) {
      try {
        const settings = await prisma.aISetting.findFirst();
        if (settings?.clonedVoiceId) {
          selectedVoice = settings.clonedVoiceId;
        } else {
          selectedVoice = settings?.defaultVoice || "mimo_default";
        }
      } catch {
        selectedVoice = "mimo_default";
      }
    }

    // MiMo TTS 请求体
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
        voice: selectedVoice,
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
      // 如果使用复刻音色失败，回退到默认音色重试一次
      if (selectedVoice !== "mimo_default") {
        const fallbackBody = { ...ttsBody };
        (fallbackBody.audio as Record<string, unknown>).voice = "mimo_default";
        try {
          const fallbackRes = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-key": apiKey,
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(fallbackBody),
          });
          if (fallbackRes.ok) {
            res = fallbackRes;
          } else {
            return NextResponse.json(
              { error: `MiMo TTS 返回错误 ${res.status}：${errText.slice(0, 500)}` },
              { status: 502 }
            );
          }
        } catch {
          return NextResponse.json(
            { error: `MiMo TTS 返回错误 ${res.status}：${errText.slice(0, 500)}` },
            { status: 502 }
          );
        }
      } else {
        return NextResponse.json(
          { error: `MiMo TTS 返回错误 ${res.status}：${errText.slice(0, 500)}` },
          { status: 502 }
        );
      }
    }

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

    const base64Match = String(audioData).match(/^data:[^;]+;base64,(.+)$/);
    const base64String = base64Match ? base64Match[1] : String(audioData);
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

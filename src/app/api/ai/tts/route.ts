import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { serverLog } from "@/lib/logger";

// POST /api/ai/tts
// 接收 { text, voice?, speed? }，调用小米 MiMo TTS API
// MiMo TTS 使用 /chat/completions 端点（非 OpenAI /audio/speech），
// 模型名 MiMo-V2.5-TTS，通过 messages + audio 参数合成语音，
// 返回 WAV 音频数据。

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.user?.id;
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
      serverLog.voiceError("tts-config-missing-api-key", { userId });
      return NextResponse.json(
        { error: "MiMo TTS 未配置 API Key" },
        { status: 500 }
      );
    }
    if (!baseUrl) {
      serverLog.voiceError("tts-config-missing-base-url", { userId });
      return NextResponse.json(
        { error: "MiMo TTS 未配置 Base URL" },
        { status: 500 }
      );
    }

    const ttsModel = process.env.TTS_MODEL || "mimo-v2.5-tts";
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    // 确定使用的音色：请求指定 > 复刻音色 > 默认音色
    let selectedVoice = typeof voice === "string" && voice ? voice : null;
    // 标记是否使用了"复刻音色"（如果是 fallback voice_id 则不信任，直接走默认）
    let usedClonedVoice = false;

    if (!selectedVoice) {
      try {
        const settings = await prisma.aISetting.findFirst();
        if (settings?.clonedVoiceId && !settings.clonedVoiceId.startsWith("cloned_")) {
          // P0 修复：跳过 fallback 生成的 cloned_xxxx 无效 ID（voice-clone/route.ts 会写入）
          selectedVoice = settings.clonedVoiceId;
          usedClonedVoice = true;
        } else {
          selectedVoice = settings?.defaultVoice || "mimo_default";
        }
      } catch {
        selectedVoice = "mimo_default";
      }
    }

    // P0 修复：MiMo TTS 使用 /chat/completions 标准接口，role 应为 "user"
    // 之前用 "assistant" 导致 API 调用失败（与 ASR/voice-clone 路由的 "user" 保持一致）
    const ttsBody: Record<string, unknown> = {
      model: ttsModel,
      messages: [
        {
          role: "user",
          content: text,
        },
      ],
      audio: {
        format: "wav",
        voice: selectedVoice,
      },
    };

    serverLog.voice("tts-call", {
      userId,
      voice: selectedVoice,
      model: ttsModel,
      usedClonedVoice,
      textLen: text.length,
    });

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
      serverLog.voiceError("tts-network-error", { userId, voice: selectedVoice }, e);
      return NextResponse.json(
        { error: `调用 MiMo TTS 网络错误：${(e as Error).message}` },
        { status: 502 }
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      serverLog.voiceWarn("tts-api-error", {
        userId,
        voice: selectedVoice,
        status: res.status,
        errPreview: errText.slice(0, 200),
      });
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
            serverLog.voice("tts-fallback-success", { userId, originalVoice: selectedVoice });
            res = fallbackRes;
          } else {
            const fbErr = await fallbackRes.text().catch(() => "");
            serverLog.voiceError("tts-fallback-failed", {
              userId,
              originalVoice: selectedVoice,
              status: fallbackRes.status,
              errPreview: fbErr.slice(0, 200),
            });
            return NextResponse.json(
              { error: `MiMo TTS 返回错误 ${res.status}：${errText.slice(0, 500)}` },
              { status: 502 }
            );
          }
        } catch (e) {
          serverLog.voiceError("tts-fallback-network-error", { userId }, e);
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
      serverLog.voiceError("tts-response-parse-failed", { userId, voice: selectedVoice });
      return NextResponse.json(
        { error: "MiMo TTS 响应解析失败：非 JSON 格式" },
        { status: 502 }
      );
    }

    const audioData =
      data?.choices?.[0]?.message?.audio?.data ||
      data?.choices?.[0]?.message?.audio?.content;

    if (!audioData) {
      serverLog.voiceError("tts-no-audio-data", {
        userId,
        voice: selectedVoice,
        responseKeys: Object.keys(data || {}).slice(0, 10),
        responsePreview: JSON.stringify(data).slice(0, 300),
      });
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

    serverLog.voice("tts-success", {
      userId,
      voice: selectedVoice,
      audioBytes: audioBuffer.byteLength,
    });

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    serverLog.voiceError("tts-unexpected-error", { userId }, e);
    return NextResponse.json(
      { error: "TTS 服务错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

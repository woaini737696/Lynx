import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// POST /api/ai/tts/stream
// 流式 TTS：通过 Server-Sent Events (SSE) 逐句返回音频 URL，降低首包延迟。
// 客户端可在第一句合成完成后立即开始播放，无需等待整段文本合成完毕。
//
// 请求体：{ text, voice? }
// 响应：text/event-stream
//   data: {"type":"sentence","index":0,"text":"...","url":"/api/ai/tts/blob?..."}
//   data: {"type":"done"}
//   data: {"type":"error","message":"..."}

/** 将文本按句子切分（用于流式 TTS） */
function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[。！？；\n.!?;])\s*/).filter(s => s.trim());
  const merged: string[] = [];
  for (const part of parts) {
    if (merged.length > 0 && part.trim().length < 5) {
      merged[merged.length - 1] += part;
    } else {
      merged.push(part);
    }
  }
  return merged.length > 0 ? merged : [text];
}

/** 调用 MiMo TTS 合成单个句子的音频，返回 base64 WAV 数据 */
async function synthesizeSentence(
  sentence: string,
  selectedVoice: string,
  ttsModel: string,
  url: string,
  apiKey: string
): Promise<Buffer | null> {
  const ttsBody: Record<string, unknown> = {
    model: ttsModel,
    messages: [{ role: "assistant", content: sentence }],
    audio: { format: "wav", voice: selectedVoice },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(ttsBody),
    });

    if (!res.ok) {
      // 复刻音色失败时回退默认音色
      if (selectedVoice !== "mimo_default") {
        const fallbackBody = { ...ttsBody };
        (fallbackBody.audio as Record<string, unknown>).voice = "mimo_default";
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
          const data = await fallbackRes.json().catch(() => null);
          const audioData =
            data?.choices?.[0]?.message?.audio?.data ||
            data?.choices?.[0]?.message?.audio?.content;
          if (audioData) {
            const base64Match = String(audioData).match(/^data:[^;]+;base64,(.+)$/);
            const base64String = base64Match ? base64Match[1] : String(audioData);
            return Buffer.from(base64String, "base64");
          }
        }
      }
      return null;
    }

    const data = await res.json().catch(() => null);
    const audioData =
      data?.choices?.[0]?.message?.audio?.data ||
      data?.choices?.[0]?.message?.audio?.content;

    if (!audioData) return null;

    const base64Match = String(audioData).match(/^data:[^;]+;base64,(.+)$/);
    const base64String = base64Match ? base64Match[1] : String(audioData);
    return Buffer.from(base64String, "base64");
  } catch {
    return null;
  }
}

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

    const { text, voice } = body as { text?: unknown; voice?: unknown };

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "text 必须为非空字符串" },
        { status: 400 }
      );
    }

    const apiKey = process.env.TTS_API_KEY || process.env.MIMO_API_KEY || "";
    const baseUrl = process.env.TTS_BASE_URL || process.env.MIMO_BASE_URL || "";
    if (!apiKey || !baseUrl) {
      return NextResponse.json(
        { error: "MiMo TTS 未配置 API Key 或 Base URL" },
        { status: 500 }
      );
    }

    const ttsModel = process.env.TTS_MODEL || "mimo-v2.5-tts";
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    // 确定使用的音色
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

    const sentences = splitSentences(text);

    // 创建 SSE 流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // 并行合成前 2 句（降低首包延迟），后续顺序合成
        const firstBatchCount = Math.min(2, sentences.length);
        const firstBatchPromises: Promise<Buffer | null>[] = [];
        for (let i = 0; i < firstBatchCount; i++) {
          firstBatchPromises.push(synthesizeSentence(sentences[i], selectedVoice, ttsModel, url, apiKey));
        }
        const firstBatchResults = await Promise.all(firstBatchPromises);

        // 立即推送前 2 句（首包延迟最低）
        for (let i = 0; i < firstBatchResults.length; i++) {
          const audioBuffer = firstBatchResults[i];
          if (audioBuffer) {
            // 将音频转为 base64 data URL 内联返回（避免额外的 blob 存储）
            const base64 = audioBuffer.toString("base64");
            send({
              type: "sentence",
              index: i,
              text: sentences[i],
              audioBase64: base64,
              format: "wav",
            });
          } else {
            send({ type: "error", index: i, message: `第 ${i + 1} 句合成失败` });
          }
        }

        // 后续句子顺序合成并推送
        for (let i = firstBatchCount; i < sentences.length; i++) {
          const audioBuffer = await synthesizeSentence(sentences[i], selectedVoice, ttsModel, url, apiKey);
          if (audioBuffer) {
            const base64 = audioBuffer.toString("base64");
            send({
              type: "sentence",
              index: i,
              text: sentences[i],
              audioBase64: base64,
              format: "wav",
            });
          } else {
            send({ type: "error", index: i, message: `第 ${i + 1} 句合成失败` });
          }
        }

        send({ type: "done" });
        controller.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "TTS 流式服务错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

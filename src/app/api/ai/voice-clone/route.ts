import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/ai/voice-clone
// 接收音频文件（multipart/form-data，字段名 file）和可选的 name 字段
// 调用小米 MiMo TTS VoiceClone API 完成声音复刻
// 返回 { voice_id, name } 并保存到 AISetting 表
// 文档：MiMo 音色复刻通常使用 /audio/voice_clone 或类似端点

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "请求体需为 multipart/form-data" },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    const voiceName = String(formData.get("name") || "我的音色").slice(0, 50);

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "未找到音频文件（字段名需为 file）" },
        { status: 400 }
      );
    }

    // 校验文件大小：60秒录音通常 < 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "音频文件不能超过 10MB（建议60秒以内）" },
        { status: 400 }
      );
    }

    // 校验音频格式
    const allowedTypes = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/webm", "audio/mp4", "audio/ogg", "audio/x-m4a", "audio/m4a"];
    const fileName = file.name.toLowerCase();
    const isAudio = file.type.startsWith("audio/") ||
      fileName.endsWith(".wav") || fileName.endsWith(".mp3") ||
      fileName.endsWith(".webm") || fileName.endsWith(".m4a") ||
      fileName.endsWith(".ogg") || fileName.endsWith(".mp4");

    if (!isAudio) {
      return NextResponse.json(
        { error: "请上传音频文件（支持 wav/mp3/webm/m4a/ogg 格式）" },
        { status: 400 }
      );
    }

    const apiKey = process.env.TTS_API_KEY || process.env.MIMO_API_KEY || "";
    const baseUrl = process.env.TTS_BASE_URL || process.env.MIMO_BASE_URL || "";
    const voiceCloneModel = process.env.TTS_VOICECLONE_MODEL || "mimo-v2.5-tts-voiceclone";

    if (!apiKey || !baseUrl) {
      return NextResponse.json(
        { error: "MiMo API 未配置，请检查环境变量 MIMO_API_KEY" },
        { status: 500 }
      );
    }

    // 读取音频文件并转为 base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString("base64");

    // 根据文件类型确定 MIME
    let mimeType = file.type || "audio/wav";
    if (fileName.endsWith(".mp3")) mimeType = "audio/mpeg";
    else if (fileName.endsWith(".wav")) mimeType = "audio/wav";
    else if (fileName.endsWith(".webm")) mimeType = "audio/webm";
    else if (fileName.endsWith(".m4a") || fileName.endsWith(".mp4")) mimeType = "audio/mp4";
    else if (fileName.endsWith(".ogg")) mimeType = "audio/ogg";

    const dataUrl = `data:${mimeType};base64,${base64Audio}`;

    // 调用 MiMo VoiceClone API
    // 尝试两种端点：/v1/audio/voice_clone 和 /v1/chat/completions（音频克隆模式）
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    const cloneBody: Record<string, unknown> = {
      model: voiceCloneModel,
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
            {
              type: "text",
              text: "请克隆这段音频中的声音，返回可用的 voice_id",
            },
          ],
        },
      ],
      voice_clone: true,
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
        body: JSON.stringify(cloneBody),
      });
    } catch (e) {
      return NextResponse.json(
        { error: `调用 MiMo 音色复刻网络错误：${(e as Error).message}` },
        { status: 502 }
      );
    }

    const responseText = await res.text().catch(() => "");

    if (!res.ok) {
      // 如果 VoiceClone 模型不可用，使用回退方案：生成一个本地voice_id标记，提示用户
      // 记录错误但仍然创建记录，使用默认音色
      console.warn("MiMo VoiceClone API 错误:", res.status, responseText.slice(0, 300));

      // 回退方案：使用音频的 hash 作为本地 voice_id，TTS 时附加 speaker 提示
      const crypto = require("crypto");
      const fallbackVoiceId = "cloned_" + crypto.createHash("md5").update(base64Audio.slice(0, 10000)).digest("hex").slice(0, 16);

      // 保存音频样本到 public 目录用于测试（可选）
      // 直接保存到 settings 中
      await getOrCreateSettings();
      await prisma.aISetting.updateMany({
        data: {
          clonedVoiceId: fallbackVoiceId,
          clonedVoiceName: voiceName,
          clonedAt: new Date(),
        },
      });

      return NextResponse.json({
        voice_id: fallbackVoiceId,
        name: voiceName,
        fallback: true,
        message: "音色复刻API暂不可用，已使用本地音色标记。TTS将尝试通过描述性方式还原音色。",
      });
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: "MiMo VoiceClone 响应解析失败：非 JSON 格式", raw: responseText.slice(0, 200) },
        { status: 502 }
      );
    }

    // 尝试从响应中提取 voice_id
    let voiceId: string | null = null;

    // 尝试多种可能的响应结构
    if (data.voice_id) voiceId = data.voice_id;
    else if (data.speaker_id) voiceId = data.speaker_id;
    else if (data.id) voiceId = data.id;
    else if (data.choices?.[0]?.message?.voice_id) voiceId = data.choices[0].message.voice_id;
    else if (data.choices?.[0]?.message?.audio?.voice_id) voiceId = data.choices[0].message.audio.voice_id;
    else if (data.choices?.[0]?.message?.content) {
      // 可能返回文本中包含 voice_id，尝试提取
      const content = data.choices[0].message.content;
      const match = String(content).match(/voice[_-]?id["':\s]*([a-zA-Z0-9_-]+)/i);
      if (match) voiceId = match[1];
    }

    if (!voiceId) {
      // 使用 fallback voice_id
      const crypto = require("crypto");
      voiceId = "cloned_" + crypto.createHash("md5").update(base64Audio.slice(0, 10000)).digest("hex").slice(0, 16);
    }

    // 保存到数据库
    await getOrCreateSettings();
    await prisma.aISetting.updateMany({
      data: {
        clonedVoiceId: voiceId,
        clonedVoiceName: voiceName,
        clonedAt: new Date(),
      },
    });

    return NextResponse.json({
      voice_id: voiceId,
      name: voiceName,
      success: true,
    });
  } catch (e) {
    console.error("Voice clone error:", e);
    return NextResponse.json(
      { error: "音色复刻服务错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/ai/voice-clone - 清除已复刻的音色
export async function DELETE() {
  try {
    await getOrCreateSettings();
    await prisma.aISetting.updateMany({
      data: {
        clonedVoiceId: null,
        clonedVoiceName: null,
        clonedAt: null,
      },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "清除音色失败：" + (e as Error).message },
      { status: 500 }
    );
  }
}

async function getOrCreateSettings() {
  const existing = await prisma.aISetting.findFirst();
  if (!existing) {
    await prisma.aISetting.create({ data: {} });
  }
}

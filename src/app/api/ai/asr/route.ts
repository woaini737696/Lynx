import { NextRequest, NextResponse } from "next/server";

// POST /api/ai/asr
// 接收音频文件（multipart/form-data，字段名 file）
// 调用小米 MiMo ASR API（/chat/completions 端点，非 OpenAI /audio/transcriptions）
// 模型名 mimo-v2.5-asr，通过 messages + input_audio 参数识别语音，
// 返回 { text: "识别结果" }。
// 文档：https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/Speech-Recognition

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
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "未找到音频文件（字段名需为 file）" },
        { status: 400 }
      );
    }

    // 读取 MiMo 配置：优先 ASR 专用 Key，回退 MIMO_API_KEY
    const apiKey = process.env.ASR_API_KEY || process.env.MIMO_API_KEY || "";
    const baseUrl =
      process.env.ASR_BASE_URL || process.env.MIMO_BASE_URL || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "MiMo ASR 未配置 API Key（环境变量 ASR_API_KEY 或 MIMO_API_KEY）" },
        { status: 500 }
      );
    }
    if (!baseUrl) {
      return NextResponse.json(
        { error: "MiMo ASR 未配置 Base URL（环境变量 ASR_BASE_URL 或 MIMO_BASE_URL）" },
        { status: 500 }
      );
    }

    // ASR 模型名：优先 ASR_MODEL / MIMO_ASR_MODEL，回退默认
    const asrModel =
      process.env.ASR_MODEL || process.env.MIMO_ASR_MODEL || "mimo-v2.5-asr";
    const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

    // 读取音频文件并转为 base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString("base64");

    // 根据文件名推断 MIME 类型
    const fileName = file.name || "audio.webm";
    let mimeType = "audio/wav";
    if (fileName.endsWith(".mp3")) {
      mimeType = "audio/mpeg";
    } else if (fileName.endsWith(".wav")) {
      mimeType = "audio/wav";
    } else if (fileName.endsWith(".webm")) {
      // 浏览器 MediaRecorder 默认 webm/opus
      // MiMo ASR 可能不支持 webm，先尝试用原始 webm MIME，失败后回退 wav
      mimeType = "audio/webm";
    } else if (fileName.endsWith(".m4a")) {
      mimeType = "audio/mp4";
    } else if (fileName.endsWith(".ogg")) {
      mimeType = "audio/ogg";
    }

    const dataUrl = `data:${mimeType};base64,${base64Audio}`;

    // MiMo ASR 请求体格式：
    // - model: mimo-v2.5-asr
    // - messages: [{ role: "user", content: [{ type: "input_audio", input_audio: { data: "data:audio/wav;base64,..." } }] }]
    // - asr_options: { language: "zh" }
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

    const callAsr = async (body: Record<string, unknown>) => {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    };

    let res: Response;
    try {
      res = await callAsr(asrBody);
      // 如果 webm 格式失败，尝试用 wav MIME 重试
      if (!res.ok && mimeType === "audio/webm") {
        const errText = await res.text().catch(() => "");
        const wavDataUrl = `data:audio/wav;base64,${base64Audio}`;
        const wavBody = { ...asrBody };
        (wavBody.messages as any[])[0].content[0].input_audio.data = wavDataUrl;
        res = await callAsr(wavBody);
      }
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

    // 解析响应：choices[0].message.content 包含识别文本
    const data = await res.json().catch(() => null);
    if (!data) {
      return NextResponse.json(
        { error: "MiMo ASR 响应解析失败：非 JSON 格式" },
        { status: 502 }
      );
    }

    // 提取识别文本：content 可能是字符串或数组
    const message = data?.choices?.[0]?.message;
    let text: string | null = null;

    if (typeof message?.content === "string") {
      text = message.content;
    } else if (Array.isArray(message?.content)) {
      // 数组形式：取第一个 text 类型的内容
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

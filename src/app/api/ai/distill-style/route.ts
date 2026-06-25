import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chat } from "@/lib/ai-provider";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("distill-style-api");

// POST /api/ai/distill-style - 从聊天记录蒸馏真人聊天风格
// body: { chatRecords: string, preview?: boolean }
// - preview=true 时仅返回蒸馏结果，不保存到数据库
// - 默认保存到 AISetting.distilledStyle
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const chatRecords = body?.chatRecords;
    const preview = body?.preview === true;

    if (!chatRecords || typeof chatRecords !== "string" || chatRecords.trim().length < 10) {
      return NextResponse.json(
        { error: "聊天记录内容过短，至少需要 10 个字符" },
        { status: 400 }
      );
    }

    if (chatRecords.length > 20000) {
      return NextResponse.json(
        { error: "聊天记录过长，最多 20000 字符" },
        { status: 400 }
      );
    }

    const DISTILL_PROMPT = `你是一个聊天风格分析专家。请分析以下聊天记录，提取说话者的聊天风格特征。

要求：
1. 分析语气、用词习惯、句式特点、表情符号使用、回复节奏等
2. 总结出 5-10 条具体的风格特征
3. 用"应该..."的句式描述，方便 AI 助理模仿
4. 输出纯文本，不要 JSON、不要代码块

聊天记录：
---
${chatRecords}
---

请输出风格特征描述：`;

    const aiResp = await chat(
      [{ role: "user", content: DISTILL_PROMPT }],
      {
        system: "你是聊天风格分析专家，擅长从聊天记录中提取说话者的风格特征。",
        reasoningMode: "fast",
        temperature: 0.3,
      }
    );

    const distilledStyle = aiResp.content.trim();

    if (!distilledStyle) {
      return NextResponse.json(
        { error: "风格蒸馏失败，AI 未返回有效结果" },
        { status: 500 }
      );
    }

    // 预览模式：不保存，仅返回结果
    if (preview) {
      return NextResponse.json({
        success: true,
        distilledStyle,
        preview: true,
      });
    }

    // 保存到 AISetting
    let settings = await prisma.aISetting.findFirst();
    if (!settings) {
      settings = await prisma.aISetting.create({
        data: { distilledStyle },
      });
    } else {
      settings = await prisma.aISetting.update({
        where: { id: settings.id },
        data: { distilledStyle },
      });
    }

    logger.info({ userId: auth.user.id, length: distilledStyle.length }, "聊天风格蒸馏完成");

    return NextResponse.json({
      success: true,
      distilledStyle,
    });
  } catch (e) {
    logger.error({ err: e }, "聊天风格蒸馏失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/ai/distill-style/preview - 预览蒸馏效果
// body: { distilledStyle: string, testMessage: string }
// 用蒸馏后的风格回复 testMessage，让用户确认效果
export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const distilledStyle = body?.distilledStyle;
    const testMessage = body?.testMessage || "你好，介绍一下你自己";

    if (!distilledStyle || typeof distilledStyle !== "string") {
      return NextResponse.json(
        { error: "缺少 distilledStyle 参数" },
        { status: 400 }
      );
    }

    const PREVIEW_PROMPT = `你是一个聊天风格模仿专家。请严格按照以下风格特征，回复用户的消息。

## 风格特征要求
${distilledStyle}

## 用户消息
${testMessage}

请用上述风格回复（仅输出回复内容，不要解释）：`;

    const aiResp = await chat(
      [{ role: "user", content: PREVIEW_PROMPT }],
      {
        reasoningMode: "fast",
        temperature: 0.7,
      }
    );

    return NextResponse.json({
      success: true,
      reply: aiResp.content.trim(),
    });
  } catch (e) {
    logger.error({ err: e }, "风格预览失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

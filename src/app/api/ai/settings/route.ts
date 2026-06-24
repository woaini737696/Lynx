import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/ai/settings - 获取AI助理设置
export async function GET() {
  try {
    let settings = await prisma.aISetting.findFirst();
    if (!settings) {
      settings = await prisma.aISetting.create({ data: {} });
    }
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json(
      { error: "获取设置失败：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// PUT /api/ai/settings - 更新AI助理设置
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误" },
        { status: 400 }
      );
    }

    const allowedFields = [
      "assistantName",
      "defaultVoice",
      "autoSpeak",
      "voiceMode",
      "feishuNotify",
    ] as const;

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // 校验 assistantName
    if (updateData.assistantName !== undefined) {
      if (typeof updateData.assistantName !== "string" || !updateData.assistantName.trim()) {
        return NextResponse.json(
          { error: "助理名称不能为空" },
          { status: 400 }
        );
      }
      updateData.assistantName = updateData.assistantName.trim().slice(0, 20);
    }

    // 布尔字段校验
    for (const boolField of ["autoSpeak", "voiceMode", "feishuNotify"] as const) {
      if (updateData[boolField] !== undefined) {
        updateData[boolField] = Boolean(updateData[boolField]);
      }
    }

    let settings = await prisma.aISetting.findFirst();
    if (!settings) {
      settings = await prisma.aISetting.create({ data: updateData });
    } else {
      settings = await prisma.aISetting.update({
        where: { id: settings.id },
        data: updateData,
      });
    }

    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json(
      { error: "更新设置失败：" + (e as Error).message },
      { status: 500 }
    );
  }
}

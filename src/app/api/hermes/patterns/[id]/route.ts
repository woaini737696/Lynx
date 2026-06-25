import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-patterns-api");

// PATCH /api/hermes/patterns/[id]
// 更新模式：可切换 autoExecute、更新 matchKeywords
// Body: { autoExecute?: boolean, matchKeywords?: string[], patternKey?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const { id } = params;
    if (!id || !id.trim()) {
      return NextResponse.json(
        { error: "id 不能为空" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误，需为 JSON" },
        { status: 400 }
      );
    }

    const { autoExecute, matchKeywords, patternKey } = body as {
      autoExecute?: boolean;
      matchKeywords?: string[];
      patternKey?: string;
    };

    // 确保模式属于当前用户
    const existing = await prisma.taskPattern.findFirst({
      where: { id, userId: auth.user.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "任务模式不存在或无权访问" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (typeof autoExecute === "boolean") {
      updateData.autoExecute = autoExecute;
    }
    if (Array.isArray(matchKeywords)) {
      updateData.matchKeywords = matchKeywords.filter(
        (k) => typeof k === "string" && k.trim().length > 0
      ) as never;
    }
    if (typeof patternKey === "string" && patternKey.trim()) {
      updateData.patternKey = patternKey.trim().slice(0, 200);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "未提供可更新的字段（autoExecute / matchKeywords / patternKey）" },
        { status: 400 }
      );
    }

    const updated = await prisma.taskPattern.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, pattern: updated });
  } catch (e) {
    logger.error({ err: e }, "更新任务模式失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/hermes/patterns/[id] - 删除指定任务模式
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const { id } = params;
    if (!id || !id.trim()) {
      return NextResponse.json(
        { error: "id 不能为空" },
        { status: 400 }
      );
    }

    // 确保模式属于当前用户
    const existing = await prisma.taskPattern.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "任务模式不存在或无权访问" },
        { status: 404 }
      );
    }

    await prisma.taskPattern.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "删除任务模式失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

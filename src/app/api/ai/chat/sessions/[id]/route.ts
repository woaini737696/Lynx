import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// GET /api/ai/chat/sessions/[id] - 获取单个会话及其所有消息
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const session = await prisma.chatSession.findUnique({
      where: { id: params.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: `未找到会话：${params.id}` },
        { status: 404 }
      );
    }

    // 验证归属权（admin 可访问所有）
    if (user.role !== "admin" && session.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        provider: session.provider,
        model: session.model,
        pinned: session.pinned,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messages: session.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          images: m.images,
          provider: m.provider,
          model: m.model,
          tokens: m.tokens,
          durationMs: m.durationMs,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  } catch (e) {
    console.error("获取对话会话失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// PUT /api/ai/chat/sessions/[id] - 更新会话（标题、置顶等）
// body: { title?, pinned?, provider?, model? }
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    // 验证归属权
    const existing = await prisma.chatSession.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: `未找到会话：${params.id}` },
        { status: 404 }
      );
    }
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await req.json();
    const { title, pinned, provider, model } = body as {
      title?: string;
      pinned?: boolean;
      provider?: string;
      model?: string;
    };

    const updated = await prisma.chatSession.update({
      where: { id: params.id },
      data: {
        ...(typeof title === "string" ? { title } : {}),
        ...(typeof pinned === "boolean" ? { pinned } : {}),
        ...(typeof provider === "string" ? { provider } : {}),
        ...(typeof model === "string" ? { model } : {}),
      },
    });

    return NextResponse.json({ session: updated });
  } catch (e) {
    console.error("更新对话会话失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// DELETE /api/ai/chat/sessions/[id] - 删除会话（级联删除消息）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    // 验证归属权
    const existing = await prisma.chatSession.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: `未找到会话：${params.id}` },
        { status: 404 }
      );
    }
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    await prisma.chatSession.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("删除对话会话失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

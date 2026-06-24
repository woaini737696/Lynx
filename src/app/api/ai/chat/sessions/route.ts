import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/ai/chat/sessions - 获取对话会话列表
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 30), 100);

    const sessions = await prisma.chatSession.findMany({
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: limit,
      include: {
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        provider: s.provider,
        model: s.model,
        pinned: s.pinned,
        messageCount: s._count.messages,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("获取对话会话列表失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST /api/ai/chat/sessions - 创建新对话会话
// body: { title?, provider?, model? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, provider, model } = body as {
      title?: string;
      provider?: string;
      model?: string;
    };

    const session = await prisma.chatSession.create({
      data: {
        title: title || "新对话",
        provider: provider || "deepseek",
        model: model || null,
      },
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    console.error("创建对话会话失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

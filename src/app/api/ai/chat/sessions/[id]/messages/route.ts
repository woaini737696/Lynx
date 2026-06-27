import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// POST /api/ai/chat/sessions/[id]/messages - 向会话追加消息
// body: { role, content, images?, provider?, model?, tokens?, durationMs? }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    // 验证会话存在且归属权
    const session = await prisma.chatSession.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });
    if (!session) {
      return NextResponse.json(
        { error: `未找到会话：${params.id}` },
        { status: 404 }
      );
    }
    if (user.role !== "admin" && session.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await req.json();
    const { role, content, images, provider, model, tokens, durationMs } = body as {
      role: string;
      content: string;
      images?: string[];
      provider?: string;
      model?: string;
      tokens?: number;
      durationMs?: number;
    };

    if (!role || !content) {
      return NextResponse.json(
        { error: "role 和 content 不能为空" },
        { status: 400 }
      );
    }

    // 幂等检查：若会话最新一条消息与本次写入完全相同（role + content），
    // 直接返回该消息，避免服务端自动持久化与前端 POST 重复写入
    // （服务端 /api/ai/chat 流式 done 事件已自动持久化 assistant 消息）
    const latest = await prisma.chatMessage.findFirst({
      where: { sessionId: params.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, role: true, content: true },
    });
    if (latest && latest.role === role && latest.content === content) {
      return NextResponse.json({ message: latest, idempotent: true }, { status: 201 });
    }

    const message = await prisma.chatMessage.create({
      data: {
        sessionId: params.id,
        role,
        content,
        images: images && images.length > 0 ? images : Prisma.JsonNull,
        provider: provider || null,
        model: model || null,
        tokens: tokens || null,
        durationMs: durationMs || null,
      },
    });

    // 更新会话的 updatedAt（触发排序刷新）
    await prisma.chatSession.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    });

    // 若是第一条用户消息且会话标题仍为默认，自动生成标题
    if (role === "user") {
      const sessionData = await prisma.chatSession.findUnique({
        where: { id: params.id },
        select: { title: true, messages: { select: { role: true }, take: 2 } },
      });
      if (
        sessionData &&
        sessionData.title === "新对话" &&
        sessionData.messages.filter((m) => m.role === "user").length === 1
      ) {
        const newTitle = content.slice(0, 40) + (content.length > 40 ? "..." : "");
        await prisma.chatSession.update({
          where: { id: params.id },
          data: { title: newTitle },
        });
      }
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (e) {
    console.error("追加消息失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

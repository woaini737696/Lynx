import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeMemoryForIdea } from "@/lib/memory-sync";

// 闪电输入 - 创建灵感
export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    const idea = await prisma.idea.create({
      data: {
        content: content.trim(),
        source: "lightning",
        status: "inbox",
        tags: [],
      },
    });

    // 异步写入 Memory（不阻塞响应）
    writeMemoryForIdea(idea.id, idea.content).catch(() => {});

    return NextResponse.json({ id: idea.id, success: true });
  } catch (e) {
    console.error("闪电输入失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 获取 Inbox 灵感列表
export async function GET() {
  try {
    const ideas = await prisma.idea.findMany({
      where: { status: "inbox" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ ideas });
  } catch (e) {
    console.error("获取 Inbox 失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

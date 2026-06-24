import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeMemoryForIdea } from "@/lib/memory-sync";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("ideas-api");

// 闪电输入 - 创建灵感
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

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
        userId: user.id,
      },
    });

    // 异步写入 Memory（不阻塞响应）
    writeMemoryForIdea(idea.id, idea.content).catch(() => {});

    return NextResponse.json({ id: idea.id, success: true });
  } catch (e) {
    logger.error({ err: e }, "闪电输入失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 获取 Inbox 灵感列表
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const ideas = await prisma.idea.findMany({
      where: { status: "inbox", ...buildUserFilter(user) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ ideas });
  } catch (e) {
    logger.error({ err: e }, "获取 Inbox 失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// 获取灵感墓地
export async function GET() {
  try {
    const items = await prisma.graveyard.findMany({
      include: { idea: true },
      orderBy: { abandonedAt: "desc" },
    });
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        ideaId: item.originalIdeaId,
        content: item.idea?.content || "",
        reason: item.reason,
        reviveCondition: item.reviveCondition,
        revivedAt: item.revivedAt,
        createdAt: item.idea?.createdAt || item.abandonedAt,
        abandonedAt: item.abandonedAt,
      })),
    });
  } catch (e) {
    console.error("获取墓地失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 复活灵感
export async function PATCH(req: NextRequest) {
  try {
    const { graveyardId } = await req.json();
    const item = await prisma.graveyard.update({
      where: { id: graveyardId },
      data: { revivedAt: new Date() },
    });
    // 灵感回到 inbox
    await prisma.idea.update({
      where: { id: item.originalIdeaId },
      data: { status: "inbox" },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("复活失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

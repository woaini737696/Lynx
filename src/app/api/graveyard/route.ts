import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";

// 获取灵感墓地（通过 Idea 关联过滤用户数据）
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    // 非 admin 只能看自己灵感的墓地记录，admin 看所有
    const ideaFilter = buildUserFilter(user);
    const whereClause =
      user.role === "admin" ? {} : { idea: ideaFilter };

    const items = await prisma.graveyard.findMany({
      where: whereClause,
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
    const { user, error } = await requireAuth();
    if (error) return error;

    const { graveyardId } = await req.json();

    // 验证墓地记录归属权（通过 Idea 关联）
    const graveyard = await prisma.graveyard.findUnique({
      where: { id: graveyardId },
      include: { idea: { select: { userId: true } } },
    });
    if (!graveyard) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (user.role !== "admin" && graveyard.idea?.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("graveyard-api");

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
    logger.error({ err: e }, "获取墓地失败");
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
    logger.error({ err: e }, "复活失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 彻底删除墓地记录 + 关联灵感（先删 Graveyard，再删 Idea）
export async function DELETE(req: NextRequest) {
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

    const originalIdeaId = graveyard.originalIdeaId;

    // 先删 Graveyard 记录（解除外键约束）
    await prisma.graveyard.delete({ where: { id: graveyardId } });
    // 再删关联的 Idea 记录
    await prisma.idea.delete({ where: { id: originalIdeaId } });

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "删除墓地失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 编辑墓地记录的放弃原因和复活条件
export async function PUT(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { graveyardId, reason, reviveCondition } = await req.json();

    if (!graveyardId) {
      return NextResponse.json({ error: "缺少 graveyardId" }, { status: 400 });
    }
    if (reason === undefined && reviveCondition === undefined) {
      return NextResponse.json(
        { error: "缺少需要更新的字段" },
        { status: 400 }
      );
    }

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

    // 仅更新提供的字段
    const data: { reason?: string; reviveCondition?: string } = {};
    if (reason !== undefined) data.reason = reason;
    if (reviveCondition !== undefined) data.reviveCondition = reviveCondition;

    await prisma.graveyard.update({
      where: { id: graveyardId },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "编辑墓地失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

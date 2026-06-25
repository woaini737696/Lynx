import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// GET /api/hermes/reports - 获取 Hermes 主动汇报历史
// Query: ?page=1&pageSize=10&type=daily|weekly|patrol
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.max(1, Math.min(50, parseInt(searchParams.get("pageSize") || "10", 10) || 10));

    const where: { userId: string; type?: string } = { userId: auth.user.id };
    if (type && type !== "all") {
      where.type = type;
    }

    const [total, reports] = await Promise.all([
      prisma.hermesReport.count({ where }),
      prisma.hermesReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          trigger: true,
          pushed: true,
          pushChannel: true,
          durationMs: true,
          error: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      reports,
      total,
      page,
      pageSize,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/hermes/reports - 清空所有汇报历史
export async function DELETE() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const result = await prisma.hermesReport.deleteMany({
      where: { userId: auth.user.id },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

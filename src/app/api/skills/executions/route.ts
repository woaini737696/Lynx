import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("skills-executions-api");

// GET /api/skills/executions?skillId=xxx&limit=50 - 获取技能执行历史
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const skillId = searchParams.get("skillId");
    const source = searchParams.get("source");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

    const where: {
      userId: string;
      skillId?: string;
      source?: string;
    } = {
      userId: auth.user.id,
    };
    if (skillId) where.skillId = skillId;
    if (source) where.source = source;

    const executions = await prisma.skillExecution.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        skillId: true,
        skillName: true,
        source: true,
        trigger: true,
        parameters: true,
        result: true,
        success: true,
        durationMs: true,
        error: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ executions });
  } catch (e) {
    logger.error({ err: e }, "获取技能执行历史失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

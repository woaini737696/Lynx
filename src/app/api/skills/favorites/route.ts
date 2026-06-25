import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("skills-favorites-api");

// GET /api/skills/favorites - 获取用户收藏的技能列表
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const favorites = await prisma.skillFavorite.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ favorites });
  } catch (e) {
    logger.error({ err: e }, "获取技能收藏列表失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/skills/favorites - 添加收藏
// body: { skillId, source?, skillName?, category? }
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { skillId, source, skillName, category } = body as {
      skillId?: string;
      source?: string;
      skillName?: string;
      category?: string;
    };

    if (!skillId) {
      return NextResponse.json(
        { error: "skillId 不能为空" },
        { status: 400 }
      );
    }

    // 如果未提供 skillName，尝试从 Skill 表查询
    let name = skillName || "";
    let cat = category || "general";
    if (source !== "hermes" && !name) {
      const skill = await prisma.skill.findUnique({
        where: { id: skillId },
        select: { name: true, category: true },
      });
      if (skill) {
        name = skill.name;
        cat = skill.category;
      }
    }

    const favorite = await prisma.skillFavorite.upsert({
      where: {
        userId_skillId: {
          userId: auth.user.id,
          skillId,
        },
      },
      create: {
        userId: auth.user.id,
        skillId,
        source: source || "local",
        skillName: name || "未命名技能",
        category: cat,
      },
      update: {
        skillName: name || undefined,
        category: cat !== "general" ? cat : undefined,
      },
    });

    return NextResponse.json({ favorite }, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "添加技能收藏失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/skills/favorites?skillId=xxx - 取消收藏
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const skillId = searchParams.get("skillId");

    if (!skillId) {
      return NextResponse.json(
        { error: "skillId 参数不能为空" },
        { status: 400 }
      );
    }

    await prisma.skillFavorite.deleteMany({
      where: {
        userId: auth.user.id,
        skillId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "取消技能收藏失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

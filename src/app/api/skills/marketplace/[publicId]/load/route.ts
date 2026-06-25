import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// POST /api/skills/marketplace/[publicId]/load - 从广场加载技能到自己账号
// 需要 requireAuth()
// 1. 按 publicId 查询公共技能
// 2. 去重：检查用户是否已有同名技能，有则返回提示
// 3. 创建新 Skill（userId: user.id, source: "marketplace"）
// 4. 增加原技能的 downloadCount
// 5. 返回新创建的 Skill
export async function POST(
  _req: NextRequest,
  { params }: { params: { publicId: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;
    const user = auth.user;

    const { publicId } = params;

    if (!publicId) {
      return NextResponse.json(
        { error: "publicId 不能为空" },
        { status: 400 }
      );
    }

    // 查询源公共技能
    const source = await prisma.skill.findFirst({
      where: { isPublic: true, publicId },
    });
    if (!source) {
      return NextResponse.json(
        { error: "技能不存在或未发布到广场" },
        { status: 404 }
      );
    }

    // 去重：当前用户是否已有同名技能
    const existing = await prisma.skill.findFirst({
      where: { name: source.name, userId: user.id },
    });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "你已经拥有同名技能，无法重复加载",
          existingId: existing.id,
        },
        { status: 409 }
      );
    }

    // 创建副本到当前用户账号
    const created = await prisma.skill.create({
      data: {
        name: source.name,
        description: source.description,
        category: source.category,
        content: source.content,
        parameters: source.parameters as Prisma.InputJsonValue,
        promptTemplate: source.promptTemplate,
        tags: source.tags as Prisma.InputJsonValue,
        source: "marketplace",
        userId: user.id,
      },
    });

    // 增加原技能的下载次数（异步失败不影响加载结果）
    await prisma.skill
      .update({
        where: { id: source.id },
        data: { downloadCount: { increment: 1 } },
      })
      .catch((e) => {
        console.error("更新广场技能下载次数失败:", e);
      });

    return NextResponse.json({
      success: true,
      skill: created,
    });
  } catch (e) {
    console.error("从广场加载技能失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

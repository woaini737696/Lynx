import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/skills/marketplace/[publicId] - 获取广场技能详情（公开，无需鉴权）
export async function GET(
  _req: NextRequest,
  { params }: { params: { publicId: string } }
) {
  try {
    const { publicId } = params;

    if (!publicId) {
      return NextResponse.json(
        { error: "publicId 不能为空" },
        { status: 400 }
      );
    }

    const skill = await prisma.skill.findFirst({
      where: { isPublic: true, publicId },
      include: {
        user: {
          select: { username: true, displayName: true },
        },
      },
    });

    if (!skill) {
      return NextResponse.json(
        { error: "技能不存在或未发布到广场" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      skill: {
        id: skill.id,
        publicId: skill.publicId,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        content: skill.content,
        parameters: skill.parameters,
        promptTemplate: skill.promptTemplate,
        tags: skill.tags,
        source: skill.source,
        downloadCount: skill.downloadCount,
        ratingAvg: skill.ratingAvg,
        publishedAt: skill.publishedAt,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
        author: {
          username: skill.user?.username ?? "",
          displayName: skill.user?.displayName ?? "",
        },
      },
    });
  } catch (e) {
    console.error("获取广场技能详情失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// GET /api/skills/marketplace - 浏览公共广场技能列表（公开，无需鉴权）
// Query: ?category=xxx&page=1&pageSize=10&search=xxx&sort=newest|popular|rating
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search")?.trim();
    const sort = searchParams.get("sort") || "newest";

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.max(
      1,
      Math.min(100, parseInt(searchParams.get("pageSize") || "10", 10) || 10)
    );

    // 构建查询条件：仅返回已发布到广场的技能
    const where: Prisma.SkillWhereInput = { isPublic: true };
    if (category && category !== "all") {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { tags: { array_contains: search } },
      ];
    }

    // 排序
    let orderBy: Prisma.SkillOrderByWithRelationInput[] = [];
    if (sort === "popular") {
      orderBy = [{ downloadCount: "desc" }, { publishedAt: "desc" }];
    } else if (sort === "rating") {
      orderBy = [{ ratingAvg: "desc" }, { publishedAt: "desc" }];
    } else {
      // newest
      orderBy = [{ publishedAt: "desc" }];
    }

    const [total, skills] = await Promise.all([
      prisma.skill.count({ where }),
      prisma.skill.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          publicId: true,
          name: true,
          description: true,
          category: true,
          tags: true,
          downloadCount: true,
          ratingAvg: true,
          publishedAt: true,
          user: {
            select: { username: true, displayName: true },
          },
        },
      }),
    ]);

    const result = skills.map((s) => ({
      id: s.id,
      publicId: s.publicId,
      name: s.name,
      description: s.description,
      category: s.category,
      // 防御：tags 是 Prisma Json 字段，可能为 null/对象/字符串等非数组值
      tags: Array.isArray(s.tags) ? s.tags : [],
      downloadCount: s.downloadCount,
      ratingAvg: s.ratingAvg,
      publishedAt: s.publishedAt,
      author: {
        username: s.user?.username ?? "",
        displayName: s.user?.displayName ?? "",
      },
    }));

    return NextResponse.json({
      skills: result,
      total,
      page,
      pageSize,
    });
  } catch (e) {
    console.error("获取广场技能列表失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

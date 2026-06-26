import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";

// 12 岗位分类 key（新增）
// pm | designer | frontend | backend | data | operations | marketing | hr | finance | project | creator | founder
// 保留分类：hermes（按 source 过滤）、custom
// 旧分类（向后兼容，仍可查询/显示）：general | report | review | knowledge | meeting | product

// GET /api/skills?category=xxx - 列表（支持分类筛选）
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    // hermes 分类：按 source 过滤（保留原逻辑）
    // 其他分类（含 12 岗位新 key 与旧 key）：直接按 category 字段过滤，向后兼容
    const where = {
      ...(category === "hermes"
        ? { source: { in: ["hermes-learned", "hermes-imported"] } }
        : category && category !== "all"
          ? { category }
          : {}),
      ...buildUserFilter(user),
    };

    const skills = await prisma.skill.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    });

    return NextResponse.json({ skills });
  } catch (e) {
    console.error("获取 Skill 列表失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST /api/skills - 创建 Skill
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await req.json();
    const {
      name,
      description,
      category = "custom",
      content = "",
      parameters = [],
      promptTemplate = "",
      source = "manual",
      tags = [],
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name 不能为空" }, { status: 400 });
    }
    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "description 不能为空" },
        { status: 400 }
      );
    }

    const skill = await prisma.skill.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        category,
        content,
        parameters: parameters as unknown as Prisma.InputJsonValue,
        promptTemplate,
        source,
        tags,
        userId: user.id,
      },
    });

    return NextResponse.json({ skill, success: true });
  } catch (e) {
    console.error("创建 Skill 失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

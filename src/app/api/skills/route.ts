import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";

// GET /api/skills?category=xxx - 列表（支持分类筛选）
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const where = {
      ...(category && category !== "all" ? { category } : {}),
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
      category = "general",
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

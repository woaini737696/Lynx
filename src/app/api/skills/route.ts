import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("skills-api");

// 合法的 Skill 分类（12 岗位新 key + 旧 key + 保留分类）
const VALID_SKILL_CATEGORIES = new Set([
  // 旧分类
  "general",
  "finance",
  "report",
  "review",
  "knowledge",
  "meeting",
  "product",
  "custom",
  // 12 岗位新 key
  "pm",
  "designer",
  "frontend",
  "backend",
  "data",
  "operations",
  "marketing",
  "hr",
  "project",
  "creator",
  "founder",
]);

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
      take: 100,
    });

    return NextResponse.json({ skills });
  } catch (e) {
    logger.error({ err: e }, "获取 Skill 列表失败");
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

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name 不能为空" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return NextResponse.json(
        { error: "description 不能为空" },
        { status: 400 }
      );
    }
    // 校验 category 枚举
    if (typeof category !== "string" || !VALID_SKILL_CATEGORIES.has(category)) {
      return NextResponse.json(
        { error: "category 不合法" },
        { status: 400 }
      );
    }
    // 校验 parameters 为数组（如果提供）
    if (parameters !== undefined && parameters !== null && !Array.isArray(parameters)) {
      return NextResponse.json(
        { error: "parameters 必须为数组" },
        { status: 400 }
      );
    }
    // 校验 tags 为数组（如果提供）
    if (tags !== undefined && tags !== null && !Array.isArray(tags)) {
      return NextResponse.json(
        { error: "tags 必须为数组" },
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

    return NextResponse.json({ skill, success: true }, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "创建 Skill 失败");
    return NextResponse.json(
      { error: "服务器错误" },
      { status: 500 }
    );
  }
}

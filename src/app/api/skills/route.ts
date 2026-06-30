import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  decodeCursor,
  buildCursorWhereDesc,
  nextCursorFrom,
} from "@/lib/api-response";

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

// GET /api/skills?category=xxx&cursor=xxx&limit=20 - 列表（支持分类筛选 + 游标分页）
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const cursorParam = searchParams.get("cursor");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);
    const cursor = decodeCursor(cursorParam);

    // hermes 分类：按 source 过滤（保留原逻辑）
    // 其他分类（含 12 岗位新 key 与旧 key）：直接按 category 字段过滤，向后兼容
    const where = {
      ...(category === "hermes"
        ? { source: { in: ["hermes-learned", "hermes-imported"] } }
        : category && category !== "all"
          ? { category }
          : {}),
      ...buildUserFilter(user),
      ...buildCursorWhereDesc(cursor, "updatedAt"),
    };

    // take limit+1 以判断是否有更多数据
    const [skills, total] = await Promise.all([
      prisma.skill.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
      prisma.skill.count({ where }),
    ]);

    const hasMore = skills.length > limit;
    const rawData = hasMore ? skills.slice(0, limit) : skills;
    // 防御：tags/parameters 是 Prisma Json 字段，可能为 null/对象/字符串等非数组值
    const data = rawData.map((s) => ({
      ...s,
      tags: Array.isArray(s.tags) ? s.tags : [],
      parameters: Array.isArray(s.parameters) ? s.parameters : [],
    }));
    const nextCursor = hasMore
      ? nextCursorFrom(data as unknown as Record<string, unknown>[], "updatedAt")
      : null;

    return paginatedResponse(data, total, hasMore, nextCursor);
  } catch (e) {
    logger.error({ err: e }, "获取 Skill 列表失败");
    return errorResponse(500, "服务器错误");
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
      return errorResponse(400, "name 不能为空");
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return errorResponse(400, "description 不能为空");
    }
    // 校验 category 枚举
    if (typeof category !== "string" || !VALID_SKILL_CATEGORIES.has(category)) {
      return errorResponse(400, "category 不合法");
    }
    // 校验 parameters 为数组（如果提供）
    if (parameters !== undefined && parameters !== null && !Array.isArray(parameters)) {
      return errorResponse(400, "parameters 必须为数组");
    }
    // 校验 tags 为数组（如果提供）
    if (tags !== undefined && tags !== null && !Array.isArray(tags)) {
      return errorResponse(400, "tags 必须为数组");
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

    return successResponse(skill, 201);
  } catch (e) {
    logger.error({ err: e }, "创建 Skill 失败");
    return errorResponse(500, "服务器错误");
  }
}

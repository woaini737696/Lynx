import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeMemoryForIdea } from "@/lib/memory-sync";
import { requireAuth, requirePermission, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { validateString, validateEnum } from "@/lib/validate";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
  decodeCursor,
  buildCursorWhereDesc,
  nextCursorFrom,
} from "@/lib/api-response";

const logger = getLogger("ideas-api");

// 灵感来源与状态枚举（与 Prisma schema 注释保持一致）
const IDEA_SOURCES = ["lightning", "conversation"] as const;
const IDEA_STATUSES = ["inbox", "board", "graveyard"] as const;

/** 单个附件的合法结构 */
interface AttachmentItem {
  type: "image" | "file";
  name: string;
  url: string;
  size?: number;
}

/**
 * 校验 attachments 字段
 * 合法：数组且每项包含 type(image|file)、name(非空字符串)、url(非空字符串)
 * 非法时返回 null
 */
function validateAttachments(value: unknown): AttachmentItem[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return [];
  // 限制最多 20 个附件
  if (value.length > 20) return null;

  const result: AttachmentItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    const type = obj.type;
    const name = obj.name;
    const url = obj.url;
    if (type !== "image" && type !== "file") return null;
    if (typeof name !== "string" || name.trim().length === 0) return null;
    if (typeof url !== "string" || url.trim().length === 0) return null;
    // url 必须以 /uploads/ 开头（防止外部 URL 注入）
    if (!url.startsWith("/uploads/")) return null;
    result.push({
      type,
      name: name.trim().slice(0, 200),
      url: url.trim(),
      size: typeof obj.size === "number" ? obj.size : undefined,
    });
  }
  return result;
}

// 闪电输入 - 创建灵感
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission("idea:create");
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    // 输入校验：content max 5000，source/status 枚举
    const content = validateString(body?.content, 5000);
    if (!content) {
      return errorResponse(400, "内容不能为空");
    }
    const source = validateEnum(body?.source, IDEA_SOURCES);
    const status = validateEnum(body?.status, IDEA_STATUSES);

    // 校验 attachments（可选字段，传入时必须是合法数组）
    let attachments: AttachmentItem[] = [];
    if (body?.attachments !== undefined && body?.attachments !== null) {
      const validated = validateAttachments(body.attachments);
      if (validated === null) {
        return errorResponse(400, "attachments 格式非法（需为数组，每项含 type/name/url）");
      }
      attachments = validated;
    }

    const idea = await prisma.idea.create({
      data: {
        content,
        source,
        status,
        tags: [],
        attachments: attachments as unknown as Prisma.InputJsonValue,
        userId: user.id,
      },
    });

    // 异步写入 Memory（不阻塞响应）
    writeMemoryForIdea(idea.id, idea.content).catch((e) => {
      logger.error({ err: e, ideaId: idea.id }, "writeMemory 异步失败");
    });

    return successResponse({ id: idea.id }, 201);
  } catch (e) {
    logger.error({ err: e }, "闪电输入失败");
    return errorResponse(500, "服务器错误");
  }
}

// 获取 Inbox 灵感列表（支持游标分页）
// GET /api/ideas?cursor=xxx&limit=20
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const cursorParam = searchParams.get("cursor");
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);
    const cursor = decodeCursor(cursorParam);

    const where = {
      status: "inbox",
      ...buildUserFilter(user),
      ...buildCursorWhereDesc(cursor, "createdAt"),
    };

    const [ideas, total] = await Promise.all([
      prisma.idea.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
      prisma.idea.count({ where }),
    ]);

    const hasMore = ideas.length > limit;
    const data = hasMore ? ideas.slice(0, limit) : ideas;
    const nextCursor = hasMore
      ? nextCursorFrom(data as unknown as Record<string, unknown>[], "createdAt")
      : null;

    return paginatedResponse(data, total, hasMore, nextCursor);
  } catch (e) {
    logger.error({ err: e }, "获取 Inbox 失败");
    return errorResponse(500, "服务器错误");
  }
}

// 批量删除灵感（真删除，从数据库移除）
// body: { ids: string[] }
export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = await requirePermission("idea:delete");
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(400, "ids 参数必须为非空数组");
    }
    if (ids.length > 100) {
      return errorResponse(400, "单次最多删除 100 条");
    }

    // 只能删除自己的灵感
    const result = await prisma.idea.deleteMany({
      where: {
        id: { in: ids },
        ...buildUserFilter(user),
      },
    });

    logger.info({ deleted: result.count, userId: user.id }, "批量删除灵感");

    return successResponse({ deleted: result.count });
  } catch (e) {
    logger.error({ err: e }, "批量删除灵感失败");
    return errorResponse(500, "服务器错误");
  }
}

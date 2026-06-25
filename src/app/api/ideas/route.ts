import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeMemoryForIdea } from "@/lib/memory-sync";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { validateString, validateEnum } from "@/lib/validate";

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
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    // 输入校验：content max 5000，source/status 枚举
    const content = validateString(body?.content, 5000);
    if (!content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }
    const source = validateEnum(body?.source, IDEA_SOURCES);
    const status = validateEnum(body?.status, IDEA_STATUSES);

    // 校验 attachments（可选字段，传入时必须是合法数组）
    let attachments: AttachmentItem[] = [];
    if (body?.attachments !== undefined && body?.attachments !== null) {
      const validated = validateAttachments(body.attachments);
      if (validated === null) {
        return NextResponse.json(
          { error: "attachments 格式非法（需为数组，每项含 type/name/url）" },
          { status: 400 }
        );
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
    writeMemoryForIdea(idea.id, idea.content).catch(() => {});

    return NextResponse.json({ id: idea.id, success: true });
  } catch (e) {
    logger.error({ err: e }, "闪电输入失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 获取 Inbox 灵感列表
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const ideas = await prisma.idea.findMany({
      where: { status: "inbox", ...buildUserFilter(user) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ ideas });
  } catch (e) {
    logger.error({ err: e }, "获取 Inbox 失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 批量删除灵感（真删除，从数据库移除）
// body: { ids: string[] }
export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids 参数必须为非空数组" }, { status: 400 });
    }
    if (ids.length > 100) {
      return NextResponse.json({ error: "单次最多删除 100 条" }, { status: 400 });
    }

    // 只能删除自己的灵感
    const result = await prisma.idea.deleteMany({
      where: {
        id: { in: ids },
        ...buildUserFilter(user),
      },
    });

    logger.info({ deleted: result.count, userId: user.id }, "批量删除灵感");

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (e) {
    logger.error({ err: e }, "批量删除灵感失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

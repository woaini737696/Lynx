// 邀请码管理：批量生成 / 列表查询 / 禁用
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("invite-codes-api");

/** 生成 8 位邀请码（大写字母+数字，去除易混淆字符） */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去除 I/O/0/1
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** 生成唯一邀请码（重试避免碰撞） */
async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateCode();
    const exists = await prisma.inviteCode.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("生成唯一邀请码失败");
}

/** GET /api/admin/invite-codes - 列表查询（分页+筛选）
 * Query: status=unused|used|disabled, q=关键词, page=1, pageSize=20
 */
export async function GET(req: NextRequest) {
  const { error, user } = await requireAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const q = searchParams.get("q")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    const where: Record<string, unknown> = {};
    if (status !== "all") where.status = status;
    if (q) {
      where.OR = [
        { code: { contains: q } },
        { remark: { contains: q } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.inviteCode.count({ where }),
      prisma.inviteCode.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // 统计概览
    const [unusedCount, usedCount, disabledCount] = await Promise.all([
      prisma.inviteCode.count({ where: { status: "unused" } }),
      prisma.inviteCode.count({ where: { status: "used" } }),
      prisma.inviteCode.count({ where: { status: "disabled" } }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      stats: { unused: unusedCount, used: usedCount, disabled: disabledCount },
    });
  } catch (e) {
    logger.error({ err: e }, "查询邀请码失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/** POST /api/admin/invite-codes - 批量生成邀请码
 * Body: { count: number, remark?: string, expiresAt?: string }
 */
export async function POST(req: NextRequest) {
  const { error, user } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const count = Math.min(100, Math.max(1, Number(body.count) || 1));
    const remark = body.remark?.trim() || null;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    if (expiresAt && isNaN(expiresAt.getTime())) {
      return NextResponse.json({ error: "过期时间格式错误" }, { status: 400 });
    }

    const codes = await prisma.$transaction(async (tx) => {
      const created: string[] = [];
      for (let i = 0; i < count; i++) {
        const code = await generateUniqueCode();
        await tx.inviteCode.create({
          data: {
            code,
            status: "unused",
            createdBy: user!.id,
            expiresAt,
            remark,
          },
        });
        created.push(code);
      }
      return created;
    });

    logger.info({ userId: user!.id, count: codes.length }, "批量生成邀请码");

    return NextResponse.json({
      success: true,
      codes,
      count: codes.length,
    });
  } catch (e) {
    logger.error({ err: e }, "生成邀请码失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/** PATCH /api/admin/invite-codes - 禁用邀请码
 * Body: { id: string, action: "disable" | "enable" }
 */
export async function PATCH(req: NextRequest) {
  const { error, user } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const { id, action } = body as { id?: string; action?: string };

    if (!id || !action) {
      return NextResponse.json({ error: "缺少 id 或 action" }, { status: 400 });
    }

    const target = await prisma.inviteCode.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "邀请码不存在" }, { status: 404 });
    }
    if (target.status === "used") {
      return NextResponse.json({ error: "已使用的邀请码不可变更" }, { status: 400 });
    }

    const newStatus = action === "disable" ? "disabled" : "unused";
    await prisma.inviteCode.update({
      where: { id },
      data: { status: newStatus },
    });

    logger.info({ userId: user!.id, inviteId: id, action }, "邀请码状态变更");

    return NextResponse.json({ success: true, status: newStatus });
  } catch (e) {
    logger.error({ err: e }, "更新邀请码失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

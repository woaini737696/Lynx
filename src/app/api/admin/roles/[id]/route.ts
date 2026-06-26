import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("roles-api");

// DELETE /api/admin/roles/[id] - 删除角色（仅 admin）
// 约束：系统内置角色（isSystem=true）不可删除，返回 403
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { id } = params;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    }

    // 系统内置角色不可删除
    if (existing.isSystem) {
      return NextResponse.json(
        { error: "系统内置角色不可删除" },
        { status: 403 }
      );
    }

    // 检查是否有用户仍在使用该角色
    const userCount = await prisma.user.count({
      where: { role: existing.name },
    });
    if (userCount > 0) {
      return NextResponse.json(
        { error: `仍有 ${userCount} 个用户使用该角色，请先调整用户角色后再删除` },
        { status: 400 }
      );
    }

    await prisma.role.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "删除角色失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

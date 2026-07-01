// C 端用户管理 - 单个用户操作 API
// 操作对象：source=self_register 的用户
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin, clearPermissionCache } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("c-users-detail-api");

// GET /api/c-users/[id] - 获取 C 端用户详情 + 最近登录历史（默认 30 条）
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const logLimit = Math.min(
      Math.max(parseInt(searchParams.get("logLimit") || "30", 10), 1),
      100
    );

    const [user, loginLogs] = await Promise.all([
      prisma.user.findFirst({
        where: { id, source: "self_register" },
        select: {
          id: true,
          username: true,
          phone: true,
          email: true,
          displayName: true,
          role: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          registerIp: true,
          source: true,
          avatarUrl: true,
          profession: true,
          permissionVersion: true,
        },
      }),
      prisma.loginLog.findMany({
        where: { userId: id },
        orderBy: { loginAt: "desc" },
        take: logLimit,
        select: { id: true, ip: true, userAgent: true, loginAt: true },
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        { error: "C 端用户不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user, loginLogs });
  } catch (e) {
    logger.error({ err: e }, "获取 C 端用户详情失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// PATCH /api/c-users/[id] - 更新 C 端用户
// 可改字段：displayName / role / active / password（重置密码）
// 注意：手机号是登录凭据，不在此处修改（需走管理员专门流程）
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { displayName, role, active, password, resetPassword } = body as {
      displayName?: string;
      role?: string;
      active?: boolean;
      password?: string;
      resetPassword?: boolean;
    };

    const existing = await prisma.user.findFirst({
      where: { id, source: "self_register" },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "C 端用户不存在" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    let needClearCache = false;
    let newPassword: string | null = null;

    if (displayName !== undefined) {
      data.displayName = String(displayName).trim() || existing.displayName;
    }

    if (role !== undefined) {
      if (typeof role !== "string" || !role.trim()) {
        return NextResponse.json({ error: "角色无效" }, { status: 400 });
      }
      const roleRecord = await prisma.role.findUnique({
        where: { name: role },
      });
      if (!roleRecord) {
        return NextResponse.json(
          { error: "角色无效，请选择有效的角色" },
          { status: 400 }
        );
      }
      data.role = role;
      data.permissionVersion = { increment: 1 };
      needClearCache = true;
    }

    if (active !== undefined) {
      data.active = !!active;
      data.permissionVersion = { increment: 1 };
      needClearCache = true;
    }

    // 重置密码：resetPassword=true 时自动生成随机密码返回给 admin
    if (resetPassword === true) {
      newPassword = Math.random().toString(36).slice(2, 10) + "A1!";
      data.passwordHash = await bcrypt.hash(newPassword, 10);
    } else if (password !== undefined && password) {
      // 显式设置密码
      if (password.length < 6) {
        return NextResponse.json(
          { error: "密码至少 6 位" },
          { status: 400 }
        );
      }
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: data as never,
      select: {
        id: true,
        username: true,
        phone: true,
        email: true,
        displayName: true,
        role: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
        source: true,
      },
    });

    if (needClearCache) {
      clearPermissionCache(id);
    }

    logger.info(
      { targetId: id, adminId: auth.user.id, action: "update" },
      "C 端用户信息已更新"
    );

    return NextResponse.json({
      user,
      success: true,
      // 仅在 resetPassword=true 时返回新密码（一次性返回，数据库不存明文）
      ...(newPassword ? { newPassword } : {}),
    });
  } catch (e) {
    logger.error({ err: e }, "更新 C 端用户失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/c-users/[id] - 注销/删除 C 端用户
// 约束：不能删自己（即使 admin 也是 self_register 来源也不能自删）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { id } = params;

    if (auth.user.id === id) {
      return NextResponse.json(
        { error: "不能删除当前登录的账户" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { id, source: "self_register" },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "C 端用户不存在" },
        { status: 404 }
      );
    }

    // 关联数据通过 onDelete: Cascade 级联删除（LoginLog 等）
    // 其他业务数据（Idea/Task/Memory 等）通过 schema 中的关系级联处理
    await prisma.user.delete({ where: { id } });

    logger.info(
      { targetId: id, adminId: auth.user.id, phone: existing.phone },
      "C 端用户已删除"
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "删除 C 端用户失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

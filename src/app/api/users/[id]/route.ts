import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin, clearPermissionCache } from "@/lib/auth-utils";

// GET /api/users/[id] - 获取单个用户详情（仅 admin）
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { id } = params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (e) {
    console.error("获取用户详情失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// PATCH /api/users/[id] - 更新用户（仅 admin）
// 可改字段：email / displayName / role / active / password
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { id } = params;
    const body = await req.json();
    const { email, displayName, role, active, password } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (email !== undefined) {
      const trimmedEmail = email?.trim() || null;
      // 检查邮箱是否被其他用户占用
      if (trimmedEmail) {
        const conflict = await prisma.user.findUnique({
          where: { email: trimmedEmail },
        });
        if (conflict && conflict.id !== id) {
          return NextResponse.json(
            { error: "邮箱已被其他用户使用" },
            { status: 400 }
          );
        }
      }
      data.email = trimmedEmail;
    }

    if (displayName !== undefined) {
      data.displayName = displayName?.trim() || "";
    }

    if (role !== undefined) {
      // 动态校验 role：查 Role 表是否存在该 name（不再硬编码 admin/editor/viewer）
      if (typeof role !== "string" || !role.trim()) {
        return NextResponse.json(
          { error: "角色无效" },
          { status: 400 }
        );
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
      // 角色变更时递增 permissionVersion，使多实例部署中所有实例的权限缓存自动失效
      data.permissionVersion = { increment: 1 };
    }

    if (active !== undefined) {
      data.active = !!active;
      // 账号激活/禁用状态变更时也要递增 permissionVersion，确保权限缓存失效
      data.permissionVersion = { increment: 1 };
    }

    if (password !== undefined && password) {
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
        email: true,
        displayName: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    // 角色/激活状态变更时清除该用户的权限缓存
    if (role !== undefined || active !== undefined) {
      clearPermissionCache(id);
    }

    return NextResponse.json({ user, success: true });
  } catch (e) {
    console.error("更新用户失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - 删除用户（仅 admin）
// 约束：不能删自己，不能删最后一个 admin
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { id } = params;

    // 不能删自己
    if (auth.user.id === id) {
      return NextResponse.json(
        { error: "不能删除当前登录的账户" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 如果要删除的是 admin，检查是否是最后一个 admin
    if (existing.role === "admin") {
      const adminCount = await prisma.user.count({
        where: { role: "admin", active: true },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "不能删除最后一个管理员" },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("删除用户失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

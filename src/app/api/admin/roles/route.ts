import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, clearPermissionCache } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import {
  DEFAULT_ROLES,
  PERMISSION_CATALOG,
  isValidPermissionKey,
  isValidProfessionKey,
} from "@/lib/permissions";

const logger = getLogger("roles-api");

// 角色 name → 用户数映射
async function countUsersByRole(): Promise<Record<string, number>> {
  const rows = await prisma.user.groupBy({
    by: ["role"],
    _count: { _all: true },
  });
  const map: Record<string, number> = {};
  for (const r of rows) {
    map[r.role] = r._count._all;
  }
  return map;
}

// 从数据库读取角色，若表为空则写入默认角色
async function getOrCreateRoles() {
  let roles = await prisma.role.findMany({
    orderBy: [{ createdAt: "asc" }],
  });

  // 首次访问：表为空，写入默认角色
  if (roles.length === 0) {
    await prisma.role.createMany({
      data: DEFAULT_ROLES.map((r) => ({
        name: r.name,
        displayName: r.displayName,
        description: r.description,
        permissions: r.permissions,
        isSystem: r.isSystem,
        profession: r.profession || null,
      })),
    });
    roles = await prisma.role.findMany({
      orderBy: [{ createdAt: "asc" }],
    });
  } else {
    // 升级兼容：已有系统角色但缺 profession 字段时回填默认值
    for (const def of DEFAULT_ROLES) {
      const existing = roles.find((r) => r.name === def.name);
      if (existing && (existing as { profession?: string | null }).profession == null && def.profession) {
        await prisma.role.update({
          where: { name: def.name },
          data: { profession: def.profession },
        });
        (existing as { profession?: string | null }).profession = def.profession;
      }
    }
  }

  return roles;
}

// GET /api/admin/roles - 返回所有角色及其权限配置
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const roles = await getOrCreateRoles();
    const userCounts = await countUsersByRole();

    const result = roles.map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      permissions: r.permissions as string[],
      isSystem: r.isSystem,
      userCount: userCounts[r.name] || 0,
      profession: (r as { profession?: string | null }).profession || null,
    }));

    return NextResponse.json({
      roles: result,
      permissions: PERMISSION_CATALOG,
    });
  } catch (e) {
    logger.error({ err: e }, "获取角色列表失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// PUT /api/admin/roles - 更新角色权限/描述（仅 admin）
// body: { name: string, description?: string, permissions?: string[] }
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const body = await req.json().catch(() => ({}));
    const { name, description, permissions, profession } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "角色 name 不能为空" }, { status: 400 });
    }

    // 查找角色
    const existing = await prisma.role.findUnique({ where: { name } });
    if (!existing) {
      return NextResponse.json({ error: "角色不存在" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    // 更新描述
    if (description !== undefined) {
      if (typeof description !== "string") {
        return NextResponse.json({ error: "description 必须为字符串" }, { status: 400 });
      }
      data.description = description.trim();
    }

    // 更新权限
    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return NextResponse.json({ error: "permissions 必须为数组" }, { status: 400 });
      }
      // 校验每个权限 key
      const invalid = permissions.filter(
        (k: unknown) => typeof k !== "string" || !isValidPermissionKey(k as string)
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `存在非法权限 key: ${invalid.join(", ")}` },
          { status: 400 }
        );
      }
      // 去重
      data.permissions = Array.from(new Set(permissions as string[]));
    }

    // 更新 profession（null = 解绑，空字符串也视为 null）
    if (profession !== undefined) {
      if (profession !== null && typeof profession !== "string") {
        return NextResponse.json({ error: "profession 必须为字符串或 null" }, { status: 400 });
      }
      const profValue = (profession as string | null) || null;
      if (profValue && !isValidProfessionKey(profValue)) {
        return NextResponse.json(
          { error: `无效的职业 key: ${profValue}` },
          { status: 400 }
        );
      }
      data.profession = profValue;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 });
    }

    const updated = await prisma.role.update({
      where: { name },
      data: data as never,
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        permissions: true,
        profession: true,
        isSystem: true,
        updatedAt: true,
      },
    });

    // 角色权限/属性变更，清除全部权限缓存（影响该角色下所有用户）
    clearPermissionCache();

    return NextResponse.json({ role: updated, success: true });
  } catch (e) {
    logger.error({ err: e }, "更新角色失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/admin/roles - 创建新角色（仅 admin）
// body: { name, displayName, description, permissions, profession }
// 约束：name 唯一且不可与系统内置角色（admin/editor/viewer）冲突；profession 必选；isSystem 固定为 false
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const body = await req.json().catch(() => ({}));
    const { name, displayName, description, permissions, profession } = body;

    // 校验 name
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "角色 name 不能为空" }, { status: 400 });
    }
    const trimmedName = name.trim();
    // name 不可与系统内置角色冲突
    const systemRoleNames = DEFAULT_ROLES.map((r) => r.name);
    if (systemRoleNames.includes(trimmedName)) {
      return NextResponse.json(
        { error: `角色 name 不可与系统内置角色（${systemRoleNames.join("/")}）冲突` },
        { status: 400 }
      );
    }

    // 校验 displayName
    if (typeof displayName !== "string" || !displayName.trim()) {
      return NextResponse.json({ error: "displayName 不能为空" }, { status: 400 });
    }
    const trimmedDisplayName = displayName.trim();

    // 校验 description（可选，兜底为空字符串）
    const trimmedDescription =
      typeof description === "string" ? description.trim() : "";

    // 校验 permissions
    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: "permissions 必须为数组" }, { status: 400 });
    }
    const invalidPerms = permissions.filter(
      (k: unknown) => typeof k !== "string" || !isValidPermissionKey(k as string)
    );
    if (invalidPerms.length > 0) {
      return NextResponse.json(
        { error: `存在非法权限 key: ${invalidPerms.join(", ")}` },
        { status: 400 }
      );
    }
    const uniquePermissions = Array.from(new Set(permissions as string[]));

    // 校验 profession（必选，必须是 12 岗位之一）
    if (typeof profession !== "string" || !profession.trim()) {
      return NextResponse.json(
        { error: "profession 必选，请选择职业" },
        { status: 400 }
      );
    }
    const trimmedProfession = profession.trim();
    if (!isValidProfessionKey(trimmedProfession)) {
      return NextResponse.json(
        { error: `无效的职业 key: ${trimmedProfession}` },
        { status: 400 }
      );
    }

    // 检查 name 是否已存在
    const existing = await prisma.role.findUnique({
      where: { name: trimmedName },
    });
    if (existing) {
      return NextResponse.json({ error: "角色 name 已存在" }, { status: 400 });
    }

    // 创建角色（isSystem 固定为 false）
    const created = await prisma.role.create({
      data: {
        name: trimmedName,
        displayName: trimmedDisplayName,
        description: trimmedDescription,
        permissions: uniquePermissions,
        profession: trimmedProfession,
        isSystem: false,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        permissions: true,
        profession: true,
        isSystem: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ role: created, success: true });
  } catch (e) {
    logger.error({ err: e }, "创建角色失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/roles?name=xxx - 删除角色（仅 admin）
// 约束：系统内置角色（isSystem=true）不可删除；通过 name 查询参数删除
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({ error: "缺少 name 参数" }, { status: 400 });
    }

    const existing = await prisma.role.findUnique({ where: { name } });
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

    await prisma.role.delete({ where: { name } });

    // 角色删除后清除全部权限缓存（保险起见，避免遗留缓存）
    clearPermissionCache();

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "删除角色失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

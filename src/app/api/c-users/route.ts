// C 端用户管理 API（参考 Kimi/豆包）
// 仅管理 source=self_register 的自注册用户
// 鉴权：requireAdmin（c-user:manage 权限同步到 catalog，但 API 层沿用 requireAdmin 与 /api/users 一致）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("c-users-api");

// GET /api/c-users - 列出所有 C 端自注册用户（仅 admin，跨职业空间全量视图）
// 查询参数：
//   q          - 搜索关键词（手机号 / 显示名 / 用户名）
//   status     - 状态筛选：active | disabled | all（默认 all）
//   role       - 角色筛选：viewer | editor | admin | all（默认 all）
//   profession - 职业空间筛选（职业 key，如 pm / designer；all 或空表示全部）
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const status = searchParams.get("status") || "all"; // active | disabled | all
    const roleFilter = searchParams.get("role") || "all";
    const professionFilter = searchParams.get("profession") || "all";

    // 构造 where 条件（admin 不受职业空间隔离，可查看全部 C 端用户）
    const where: Record<string, unknown> = { source: "self_register" };

    if (status === "active") {
      where.active = true;
    } else if (status === "disabled") {
      where.active = false;
    }

    if (roleFilter !== "all") {
      where.role = roleFilter;
    }

    if (professionFilter !== "all") {
      // 职业空间筛选：User.profession 优先，未设置时回退到 Role.profession
      const roles = await prisma.role.findMany({
        where: { profession: professionFilter },
        select: { name: true },
      });
      const roleNames = roles.map((r) => r.name);
      where.OR = [
        { profession: professionFilter },
        ...(roleNames.length > 0 ? [{ role: { in: roleNames } }] : []),
      ];
    }

    if (q) {
      const qCond = {
        OR: [
          { phone: { contains: q } },
          { displayName: { contains: q } },
          { username: { contains: q } },
        ],
      };
      where.AND = where.AND ? [...(where.AND as unknown[]), qCond] : [qCond];
    }

    const [users, total, roles] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
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
        },
      }),
      prisma.user.count({ where }),
      prisma.role.findMany({
        select: { name: true, profession: true },
      }),
    ]);

    // 角色 name → profession 映射（用于 User.profession 为空时回退）
    const roleProfessionMap = new Map<string, string | null>();
    for (const r of roles) {
      roleProfessionMap.set(r.name, r.profession);
    }

    // 附加 profession 字段（User.profession 优先，回退到 Role.profession）
    const result = users.map((u) => ({
      ...u,
      profession: u.profession || roleProfessionMap.get(u.role) || null,
    }));

    return NextResponse.json({ users: result, total });
  } catch (e) {
    logger.error({ err: e }, "获取 C 端用户列表失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 注意：创建 C 端用户走公开注册流程 /api/auth/register，此处不提供 POST 创建
// PATCH 操作（启用/禁用、重置密码、角色提升）在 /api/c-users/[id]/route.ts

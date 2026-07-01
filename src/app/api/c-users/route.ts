// C 端用户管理 API（参考 Kimi/豆包）
// 仅管理 source=self_register 的自注册用户
// 鉴权：requireAdmin（c-user:manage 权限同步到 catalog，但 API 层沿用 requireAdmin 与 /api/users 一致）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("c-users-api");

// GET /api/c-users - 列出所有 C 端自注册用户（仅 admin）
// 查询参数：
//   q       - 搜索关键词（手机号 / 显示名 / 用户名）
//   status  - 状态筛选：active | disabled | all（默认 all）
//   role    - 角色筛选：viewer | editor | admin | all（默认 all）
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const status = searchParams.get("status") || "all"; // active | disabled | all
    const roleFilter = searchParams.get("role") || "all";

    // 构造 where 条件
    const where: Record<string, unknown> = { source: "self_register" };

    if (status === "active") {
      where.active = true;
    } else if (status === "disabled") {
      where.active = false;
    }

    if (roleFilter !== "all") {
      where.role = roleFilter;
    }

    if (q) {
      where.OR = [
        { phone: { contains: q } },
        { displayName: { contains: q } },
        { username: { contains: q } },
      ];
    }

    const [users, total] = await Promise.all([
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
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ users, total });
  } catch (e) {
    logger.error({ err: e }, "获取 C 端用户列表失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 注意：创建 C 端用户走公开注册流程 /api/auth/register，此处不提供 POST 创建
// PATCH 操作（启用/禁用、重置密码、角色提升）在 /api/c-users/[id]/route.ts

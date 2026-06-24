// 鉴权工具函数：供所有 API 使用
import { auth } from "@/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";

export interface AuthUser {
  id: string;
  username: string;
  role: string; // admin | editor | viewer
}

/**
 * 获取当前登录用户（双通道鉴权）
 * 1. 优先检查 Authorization: Bearer <token>（App 端 JWT）
 * 2. 无 Bearer 时回退到 NextAuth session（Web 端）
 * 未登录返回 null
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  // 通道 1：App 端 Bearer Token
  const headerList = headers();
  const authHeader = headerList.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    if (!payload?.id) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, role: true, active: true },
    });

    if (!user || !user.active) return null;

    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  }

  // 通道 2：Web 端 NextAuth session
  const session = await auth();
  if (!session?.user) return null;

  const userId = (session.user as { id?: string }).id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, active: true },
  });

  if (!user || !user.active) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

/**
 * 要求登录，否则返回 401
 * 返回 { user, error }：user 为 null 时 error 为错误响应
 */
export async function requireAuth(): Promise<{
  user: AuthUser;
  error?: never;
} | {
  user: null;
  error: Response;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: "未登录" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  return { user };
}

/**
 * 要求 admin 角色，否则返回 403
 */
export async function requireAdmin(): Promise<{
  user: AuthUser;
  error?: never;
} | {
  user: null;
  error: Response;
}> {
  const result = await requireAuth();
  if (result.user === null) return result;

  if (result.user.role !== "admin") {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: "权限不足，需要管理员角色" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ),
    };
  }
  return result;
}

/**
 * 构建数据查询的 where 条件（admin 全局视图，普通用户只能看自己的数据）
 * 返回 Prisma where 条件对象
 */
export function buildUserFilter(user: AuthUser): { userId?: string } {
  if (user.role === "admin") {
    // admin 可以看所有数据（包括无 userId 的）
    return {};
  }
  // 非 admin 只能看自己的数据
  return { userId: user.id };
}

/**
 * 构建数据创建时的 userId 字段
 */
export function buildUserCreateData(user: AuthUser): { userId: string } {
  return { userId: user.id };
}

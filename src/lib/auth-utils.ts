// 鉴权工具函数：供所有 API 使用
import { auth } from "@/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";
import { unauthorized, forbidden } from "@/lib/api-response";

export interface AuthUser {
  id: string;
  username: string;
  role: string; // admin | editor | viewer
  // 权限缓存版本号：用于多实例部署时的缓存键，角色变更时递增以失效旧缓存
  permissionVersion: number;
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
      select: { id: true, username: true, role: true, active: true, permissionVersion: true },
    });

    if (!user || !user.active) return null;

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      permissionVersion: user.permissionVersion,
    };
  }

  // 通道 2：Web 端 NextAuth session
  const session = await auth();
  if (!session?.user) return null;

  const userId = (session.user as { id?: string }).id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, active: true, permissionVersion: true },
  });

  if (!user || !user.active) return null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    permissionVersion: user.permissionVersion,
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
      error: unauthorized("未登录"),
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
      error: forbidden("权限不足，需要管理员角色"),
    };
  }
  return result;
}

// ============ 权限缓存（5 分钟，避免每次查 DB）============
interface PermissionCacheEntry {
  permissions: string[];
  expiresAt: number;
}
const permissionCache = new Map<string, PermissionCacheEntry>();
const PERMISSION_CACHE_TTL = 5 * 60 * 1000; // 5 分钟

/**
 * 获取用户权限列表（带缓存）
 * admin 直通返回 ["*"] 表示全部权限
 * 缓存键使用 userId:permissionVersion，角色变更时递增 permissionVersion 即可使所有实例缓存失效
 */
async function getUserPermissions(
  userId: string,
  role: string,
  permissionVersion: number
): Promise<string[]> {
  if (role === "admin") return ["*"]; // admin 拥有全部权限

  // 查缓存：键包含 permissionVersion，版本号变更后自动 miss
  const cacheKey = `${userId}:${permissionVersion}`;
  const cached = permissionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  // 查 DB
  try {
    const roleRow = await prisma.role.findUnique({
      where: { name: role },
      select: { permissions: true },
    });
    const perms = Array.isArray(roleRow?.permissions) ? (roleRow!.permissions as string[]) : [];
    permissionCache.set(cacheKey, { permissions: perms, expiresAt: Date.now() + PERMISSION_CACHE_TTL });
    return perms;
  } catch {
    return [];
  }
}

/**
 * 清除用户权限缓存（角色变更时调用）
 */
export function clearPermissionCache(userId?: string): void {
  if (userId) {
    permissionCache.delete(userId);
  } else {
    permissionCache.clear();
  }
}

/**
 * 要求具有指定权限，否则返回 403
 * admin 直通；其他角色检查 Role.permissions 是否包含 permKey
 */
export async function requirePermission(permKey: string): Promise<{
  user: AuthUser;
  error?: never;
} | {
  user: null;
  error: Response;
}> {
  const result = await requireAuth();
  if (result.user === null) return result;

  const perms = await getUserPermissions(
    result.user.id,
    result.user.role,
    result.user.permissionVersion
  );
  const hasPerm = perms.includes("*") || perms.includes(permKey);
  if (!hasPerm) {
    return {
      user: null,
      error: forbidden(`权限不足，需要权限：${permKey}`),
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

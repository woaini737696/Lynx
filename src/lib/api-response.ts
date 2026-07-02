import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth, type AuthUser } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

// 统一 API 响应格式封装
// 所有响应使用 { success: boolean, ... } 结构，错误使用 { success: false, error: { code, message } }

/** 成功响应 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

/** 错误响应 */
export function errorResponse(code: number, message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status: code }
  );
}

/** 401 未认证响应 */
export function unauthorized(message = "未登录或登录已过期"): NextResponse {
  return errorResponse(401, message);
}

/** 403 无权限响应 */
export function forbidden(message = "无权限执行此操作"): NextResponse {
  return errorResponse(403, message);
}

/** 400 参数错误响应 */
export function badRequest(message = "请求参数错误"): NextResponse {
  return errorResponse(400, message);
}

/** 404 资源不存在响应 */
export function notFound(message = "资源不存在"): NextResponse {
  return errorResponse(404, message);
}

/** 分页响应 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  hasMore: boolean,
  cursor: string | null
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    total,
    hasMore,
    cursor,
  });
}

// ============ 游标分页工具 ============

export interface CursorPayload {
  [key: string]: string | number;
}

/** 将游标 payload 编码为不透明字符串 */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/** 解码游标字符串，失败返回 null */
export function decodeCursor(cursor: string | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString()) as CursorPayload;
  } catch {
    return null;
  }
}

/**
 * 构建单字段降序 + id 降序的游标 where 条件
 * 适用场景：orderBy [{ field: "desc" }, { id: "desc" }]，游标 { [field], id }
 *
 * @param cursor 游标 payload
 * @param field 排序字段名（如 "createdAt"、"updatedAt"）
 * @returns Prisma where 子句（OR 条件），未提供 cursor 时返回空对象
 */
export function buildCursorWhereDesc(
  cursor: CursorPayload | null,
  field: string
): Prisma.Sql | Record<string, unknown> {
  if (!cursor || !cursor[field] || !cursor.id) return {};
  const cursorField = cursor[field] as string;
  const cursorId = cursor.id as string;
  // field < cursorField OR (field == cursorField AND id < cursorId)
  return {
    OR: [
      { [field]: { lt: cursorField } },
      { [field]: cursorField, id: { lt: cursorId } },
    ],
  };
}

/**
 * 从结果列表构建下一页游标
 * @param items 当前页结果（已按排序字段+id降序排列）
 * @param sortField 排序字段名
 * @returns 下一页游标字符串，无更多数据时返回 null
 */
export function nextCursorFrom<T extends Record<string, unknown>>(
  items: T[],
  sortField: string
): string | null {
  if (items.length === 0) return null;
  const last = items[items.length - 1];
  const fieldVal = last[sortField];
  const idVal = last["id"];
  if (fieldVal === undefined || idVal === undefined) return null;
  // Date 转为 ISO 字符串
  const fieldStr = fieldVal instanceof Date ? fieldVal.toISOString() : String(fieldVal);
  return encodeCursor({ [sortField]: fieldStr, id: String(idVal) });
}

// ============ withApi 高阶函数 ============

/** withApi handler 的上下文 */
export interface ApiContext {
  req: NextRequest;
  user: AuthUser;
  logger: ReturnType<typeof getLogger>;
}

/** withApi handler 返回值：data 会被包装为 { success: true, data } */
export type ApiHandler<T = unknown> = (ctx: ApiContext) => Promise<T>;

/**
 * 统一 API 路由高阶函数。
 *
 * 自动处理：
 * 1. 认证（requireAuth，失败返回 401）
 * 2. 错误捕获（try/catch，Prisma 已知错误映射为 400，其余为 500）
 * 3. 结构化日志（自动记录错误）
 * 4. 响应格式统一（成功返回 { success: true, data }，失败返回 { success: false, error }）
 *
 * 用法：
 *   export const POST = withApi(async ({ req, user }) => {
 *     const body = await req.json();
 *     return { ok: true };
 *   });
 *
 *   // 不需要认证的路由：
 *   export const GET = withApi.public(async ({ req }) => {
 *     return { items: [] };
 *   });
 */
export function withApi<T = unknown>(
  handler: ApiHandler<T>,
  options?: { logName?: string }
) {
  return async (req: NextRequest): Promise<NextResponse | Response> => {
    const logger = getLogger(options?.logName ?? "api");
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;

    try {
      const data = await handler({ req, user: auth.user, logger });
      return successResponse(data);
    } catch (e) {
      return handleApiError(e, logger);
    }
  };
}

/** 不需要认证的路由版本 */
withApi.public = function <T = unknown>(
  handler: ApiHandler<T>,
  options?: { logName?: string }
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const logger = getLogger(options?.logName ?? "api");
    // 公开路由使用空用户上下文
    const emptyUser = { id: "", username: "", role: "guest" } as AuthUser;
    try {
      const data = await handler({ req, user: emptyUser, logger });
      return successResponse(data);
    } catch (e) {
      return handleApiError(e, logger);
    }
  };
};

/** 统一错误处理：Prisma 已知错误 → 400，其余 → 500 */
function handleApiError(e: unknown, logger: ReturnType<typeof getLogger>): NextResponse {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const messages = new Map<string, string>([
      ["P2002", "记录已存在"],
      ["P2025", "记录不存在"],
      ["P2003", "记录不存在"],
    ]);
    const msg = messages.get(e.code) || `数据库错误: ${e.code}`;
    logger.warn({ err: e, code: e.code }, msg);
    return errorResponse(400, msg);
  }
  if (e instanceof Prisma.PrismaClientValidationError) {
    logger.warn({ err: e }, "参数校验失败");
    return badRequest("请求参数校验失败");
  }
  logger.error({ err: e }, "未预期错误");
  return errorResponse(500, "服务器内部错误");
}

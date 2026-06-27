import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

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

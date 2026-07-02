// 游标分页工具 - 纯 TypeScript
// 从 src/lib/api-response.ts 抽离，去除 Buffer 依赖（改用 btoa/atob）

/** 游标 payload */
export interface CursorPayload {
  [key: string]: string | number;
}

/** 将游标 payload 编码为不透明字符串（平台无关，不依赖 Buffer） */
export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  // btoa 在 Web/RN/Tauri 中均可用
  if (typeof btoa !== "undefined") {
    return btoa(unescape(encodeURIComponent(json)));
  }
  // Node.js fallback（无 btoa 时）
  return Buffer.from(json).toString("base64url");
}

/** 解码游标字符串，失败返回 null */
export function decodeCursor(cursor: string | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    let json: string;
    if (typeof atob !== "undefined") {
      json = decodeURIComponent(escape(atob(cursor)));
    } else {
      json = Buffer.from(cursor, "base64url").toString();
    }
    return JSON.parse(json) as CursorPayload;
  } catch {
    return null;
  }
}

/**
 * 构建单字段降序 + id 降序的游标 where 条件
 * 适用场景：orderBy [{ field: "desc" }, { id: "desc" }]，游标 { [field], id }
 */
export function buildCursorWhereDesc(
  cursor: CursorPayload | null,
  field: string
): Record<string, unknown> {
  if (!cursor || !cursor[field] || !cursor.id) return {};
  const cursorField = cursor[field] as string;
  const cursorId = cursor.id as string;
  return {
    OR: [
      { [field]: { lt: cursorField } },
      { [field]: cursorField, id: { lt: cursorId } },
    ],
  };
}

/**
 * 从结果列表构建下一页游标
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
  const fieldStr = fieldVal instanceof Date ? fieldVal.toISOString() : String(fieldVal);
  return encodeCursor({ [sortField]: fieldStr, id: String(idVal) });
}

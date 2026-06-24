// 输入校验工具：供所有 API 路由复用
// 设计原则：
// 1. 严格类型校验，避免 any
// 2. 字符串 trim + 截断，避免存储超长内容
// 3. 数值范围校验
// 4. 枚举值校验，避免非法值落库

/**
 * 校验字符串：trim 后截断到 maxLen
 * 非字符串输入会被转为字符串再处理
 * null/undefined 返回空字符串
 */
export function validateString(value: unknown, maxLen: number): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (typeof value === "string") {
    str = value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    str = String(value);
  } else {
    // 对象/数组等：JSON 序列化
    try {
      str = JSON.stringify(value);
    } catch {
      str = "";
    }
  }
  const trimmed = str.trim();
  if (trimmed.length > maxLen) {
    return trimmed.slice(0, maxLen);
  }
  return trimmed;
}

/**
 * 校验整数：必须在 [min, max] 范围内
 * 非法值返回 min
 */
export function validateInt(value: unknown, min: number, max: number): number {
  let n: number;
  if (typeof value === "number" && Number.isFinite(value)) {
    n = Math.trunc(value);
  } else if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return min;
    n = parsed;
  } else {
    return min;
  }
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * 校验枚举值：必须存在于 allowed 列表中，否则返回 allowed[0]
 */
export function validateEnum<T extends string>(value: unknown, allowed: readonly T[]): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return allowed[0];
}

/**
 * 校验字符串非空（trim 后）
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

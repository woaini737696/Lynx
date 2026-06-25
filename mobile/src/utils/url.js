import { getBaseUrl } from "@/api/request.js";

/**
 * 将后端返回的相对/绝对媒体 URL 解析为可直接显示的完整 URL
 * - 已是 http 开头的直接返回
 * - 否则拼接 getBaseUrl()
 * - H5 模式下 getBaseUrl() 为空，依赖 Vite proxy 代理 /uploads
 */
export function resolveMediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) {
    return url;
  }
  const base = getBaseUrl() || "";
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${base}${normalized}`;
}

/**
 * 从 assignees 对象数组中提取可读的负责人名字符串
 */
export function formatAssignees(assignees) {
  if (!Array.isArray(assignees) || assignees.length === 0) return "";
  return assignees
    .map((a) => {
      if (typeof a === "string") return a;
      return a?.name || a?.open_id || a?.id || a?.user_id || "";
    })
    .filter(Boolean)
    .join(", ");
}

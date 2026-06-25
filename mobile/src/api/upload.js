import { getBaseUrl, getToken } from "./request.js";

/**
 * 通用文件上传
 * 后端契约：POST /api/upload multipart/form-data，字段 file
 * 支持图片（jpg/png/gif/webp）和文档（pdf/txt/md/doc/docx）
 * 限制：10MB · 20 次/分钟 · 需登录
 * 返回 { url, name, size, type }
 */
export async function uploadFile(file, fileName) {
  const formData = new FormData();
  formData.append("file", file, fileName || file.name || `file-${Date.now()}`);

  const res = await fetch(`${getBaseUrl()}/api/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `上传失败 (${res.status})`);
  }

  return await res.json();
}

/**
 * 通过临时路径上传图片（H5 模式下 uni.chooseImage 返回 blob URL）
 * @param {string} tempPath - uni.chooseImage 返回的临时路径
 * @returns {Promise<{url, name, size, type}>}
 */
export async function uploadImageFromPath(tempPath) {
  const blob = await fetch(tempPath).then((r) => r.blob());
  return uploadFile(blob, `image-${Date.now()}.jpg`);
}

/**
 * AI 助理头像上传
 * 后端契约：POST /api/ai/avatar-upload multipart/form-data，字段 file
 * 返回 { url, success }
 */
export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("file", file, file.name || `avatar-${Date.now()}.jpg`);

  const res = await fetch(`${getBaseUrl()}/api/ai/avatar-upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `头像上传失败 (${res.status})`);
  }

  return await res.json();
}

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireAuth } from "@/lib/auth-utils";
import { rateLimit, getClientKey } from "@/lib/rate-limit";
import { getLogger } from "@/lib/logger";

const logger = getLogger("upload-api");

// 允许的文件类型
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const ALLOWED_IMAGE_EXT = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_FILE_EXT = [".pdf", ".txt", ".md", ".doc", ".docx"];

// 文件大小上限：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 上传目录（public/uploads/）
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/** 生成随机字符串（用于文件名防冲突） */
function randomString(len = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/** 判断文件类型是否为允许的图片 */
function isAllowedImage(file: File): boolean {
  const ext = path.extname(file.name).toLowerCase();
  return (
    ALLOWED_IMAGE_TYPES.includes(file.type) || ALLOWED_IMAGE_EXT.includes(ext)
  );
}

/** 判断文件类型是否为允许的文档 */
function isAllowedFile(file: File): boolean {
  const ext = path.extname(file.name).toLowerCase();
  return (
    ALLOWED_FILE_TYPES.includes(file.type) || ALLOWED_FILE_EXT.includes(ext)
  );
}

/**
 * POST /api/upload
 * 接收 multipart/form-data，字段名 file
 * 支持图片（jpg/png/gif/webp）和文档（pdf/txt/md/doc/docx）
 * 保存到 public/uploads/ 目录，返回 { url, name, size, type }
 * 限制：10MB · 20 次/分钟 · 需登录
 */
export async function POST(req: NextRequest) {
  try {
    // ============ Rate Limiting：20 次/分钟 ============
    const ip = getClientKey(req);
    const rl = rateLimit(`upload:${ip}`, 20, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "上传请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "20",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(rl.resetAt / 1000)),
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // ============ 鉴权 ============
    const { error } = await requireAuth();
    if (error) return error;

    // ============ 解析 multipart/form-data ============
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "请求体需为 multipart/form-data" },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "未找到文件（字段名需为 file）" },
        { status: 400 }
      );
    }

    // ============ 校验文件大小 ============
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "文件不能超过 10MB" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "文件为空" },
        { status: 400 }
      );
    }

    // ============ 校验文件类型 ============
    const isImage = isAllowedImage(file);
    const isFile = isAllowedFile(file);
    if (!isImage && !isFile) {
      return NextResponse.json(
        {
          error:
            "不支持的文件类型（图片支持 jpg/png/gif/webp，文档支持 pdf/txt/md/doc/docx）",
        },
        { status: 400 }
      );
    }

    // ============ 文件名安全校验：禁止路径遍历字符 ============
    const originalName = file.name;
    if (
      originalName.includes("/") ||
      originalName.includes("\\") ||
      originalName.includes("..") ||
      originalName.startsWith(".") ||
      originalName.includes("\0")
    ) {
      return NextResponse.json(
        { error: "文件名包含非法字符" },
        { status: 400 }
      );
    }

    // ============ 生成文件名：时间戳-随机串-原始名 ============
    const ext = path.extname(originalName).toLowerCase();
    const baseName = path.basename(originalName, ext).slice(0, 50);
    const safeName = `${Date.now()}-${randomString()}-${baseName}${ext}`;

    // ============ 确保上传目录存在 ============
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    } catch (e) {
      logger.error({ err: e }, "创建上传目录失败");
      return NextResponse.json(
        { error: "服务器存储目录创建失败" },
        { status: 500 }
      );
    }

    // ============ 写入文件 ============
    const filePath = path.join(UPLOAD_DIR, safeName);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filePath, buffer);
    } catch (e) {
      logger.error({ err: e }, "写入上传文件失败");
      return NextResponse.json(
        { error: "文件保存失败" },
        { status: 500 }
      );
    }

    // 返回可访问的 URL（相对路径，前端可直接拼接使用）
    const url = `/uploads/${safeName}`;
    const type = isImage ? "image" : "file";

    logger.info({ name: file.name, size: file.size, type, url }, "文件上传成功");

    return NextResponse.json({
      url,
      name: file.name,
      size: file.size,
      type,
    });
  } catch (e) {
    logger.error({ err: e }, "上传失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

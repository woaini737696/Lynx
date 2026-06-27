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

// ============ 文件头魔数签名（用于校验文件实际内容） ============
const MAGIC_NUMBERS: Record<string, number[]> = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  gif: [0x47, 0x49, 0x46, 0x38], // GIF8
  webp_riff: [0x52, 0x49, 0x46, 0x46], // RIFF
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  zip: [0x50, 0x4b, 0x03, 0x04], // PK.. (docx 等 OOXML 格式)
  ole2: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // DOC 等旧 Office 格式
};

/** 检查 buffer 是否以指定魔数开头 */
function checkMagicNumber(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < signature.length + offset) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * 校验文件实际内容（魔数）与扩展名是否匹配
 * @param buffer 文件内容 Buffer
 * @param ext 文件扩展名（含点，小写）
 * @returns 校验通过返回 true，否则返回 false
 */
function validateFileContent(buffer: Buffer, ext: string): boolean {
  const lowerExt = ext.toLowerCase();
  switch (lowerExt) {
    case ".jpg":
    case ".jpeg":
      return checkMagicNumber(buffer, MAGIC_NUMBERS.jpeg);
    case ".png":
      return checkMagicNumber(buffer, MAGIC_NUMBERS.png);
    case ".gif":
      return checkMagicNumber(buffer, MAGIC_NUMBERS.gif);
    case ".webp":
      // WebP: RIFF at offset 0, WEBP at offset 8
      return (
        checkMagicNumber(buffer, MAGIC_NUMBERS.webp_riff) &&
        buffer.length >= 12 &&
        buffer[8] === 0x57 && // W
        buffer[9] === 0x45 && // E
        buffer[10] === 0x42 && // B
        buffer[11] === 0x50 // P
      );
    case ".pdf":
      return checkMagicNumber(buffer, MAGIC_NUMBERS.pdf);
    case ".docx":
      // OOXML 格式（docx/xlsx/pptx）本质是 ZIP
      return checkMagicNumber(buffer, MAGIC_NUMBERS.zip);
    case ".doc":
      return checkMagicNumber(buffer, MAGIC_NUMBERS.ole2);
    case ".txt":
    case ".md":
      // 文本文件：前 1KB 不含 null 字节（二进制文件的典型特征）
      {
        const checkLen = Math.min(buffer.length, 1024);
        for (let i = 0; i < checkLen; i++) {
          if (buffer[i] === 0) return false;
        }
        return true;
      }
    default:
      return false;
  }
}

/**
 * 校验图片实际尺寸（可选，当 sharp 可用时执行）
 * sharp 是 Next.js 生产环境的可选依赖，开发环境可能未安装
 */
async function validateImageDimensions(buffer: Buffer, ext: string): Promise<boolean> {
  try {
    // 动态导入 sharp，未安装时跳过尺寸校验（魔数校验已在前面完成）
    // @ts-expect-error - sharp 是可选依赖，可能未安装
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(buffer).metadata();
    // 校验图片有合理的宽高（非 0、非负）
    if (metadata.width && metadata.height) {
      return metadata.width > 0 && metadata.height > 0;
    }
    return true; // 无法获取尺寸时放行（魔数校验已通过）
  } catch {
    // sharp 不可用或解析失败，跳过尺寸校验
    // 魔数校验已在前一步完成，此处仅是额外校验
    return true;
  }
}

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

    // ============ 写入文件（含内容校验） ============
    const filePath = path.join(UPLOAD_DIR, safeName);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 校验文件实际内容（魔数），防止伪装扩展名的恶意文件
      if (!validateFileContent(buffer, ext)) {
        return NextResponse.json(
          { error: "文件内容与扩展名不匹配（魔数校验失败）" },
          { status: 400 }
        );
      }

      // 图片文件额外校验实际尺寸（sharp 可用时执行）
      if (isImage) {
        const dimValid = await validateImageDimensions(buffer, ext);
        if (!dimValid) {
          return NextResponse.json(
            { error: "图片文件损坏或尺寸无效" },
            { status: 400 }
          );
        }
      }

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

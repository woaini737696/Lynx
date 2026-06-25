import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("avatar-upload");

// POST /api/ai/avatar-upload - 上传 AI 助理头像
// 接收 multipart/form-data，字段名 "file"
// 保存到 public/avatars/<userId>-<timestamp>.<ext>
// 返回 { url: "/avatars/xxx.png" }
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "请选择头像文件" },
        { status: 400 }
      );
    }

    // 文件类型校验
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `不支持的文件类型：${file.type}，仅支持 PNG/JPEG/GIF/WebP/SVG` },
        { status: 400 }
      );
    }

    // 文件大小校验（最大 2MB）
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "头像文件过大，最大 2MB" },
        { status: 400 }
      );
    }

    // 扩展名映射
    const extMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
    };
    const ext = extMap[file.type] || "png";

    // 确保目录存在
    const avatarsDir = path.join(process.cwd(), "public", "avatars");
    await fs.mkdir(avatarsDir, { recursive: true });

    // 生成文件名：userId-timestamp.ext
    const filename = `${auth.user.id}-${Date.now()}.${ext}`;
    const filepath = path.join(avatarsDir, filename);

    // 写入文件
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filepath, buffer);

    const url = `/avatars/${filename}`;
    logger.info({ userId: auth.user.id, filename, size: file.size }, "头像上传成功");

    return NextResponse.json({ url });
  } catch (e) {
    logger.error({ err: e }, "头像上传失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

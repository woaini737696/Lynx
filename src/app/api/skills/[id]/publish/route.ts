import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// 生成 base62 风格的公共 ID（a-zA-Z0-9，长度 12）
function generatePublicId(): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(12);
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

// 生成唯一的 publicId（带冲突重试）
async function generateUniquePublicId(maxAttempts = 10): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = generatePublicId();
    const exists = await prisma.skill.findUnique({
      where: { publicId: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // 极端情况下兜底：使用更长的随机串
  return generatePublicId() + generatePublicId();
}

// POST /api/skills/[id]/publish - 发布技能到公共广场
// 需要 requireAuth() + 归属校验
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;

    const { id } = params;

    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      return NextResponse.json(
        { error: "技能不存在" },
        { status: 404 }
      );
    }

    // 归属校验：admin 或本人
    if (skill.userId !== auth.user.id && auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "无权操作" },
        { status: 403 }
      );
    }

    // 已发布则直接返回现有 publicId
    if (skill.isPublic && skill.publicId) {
      return NextResponse.json({
        success: true,
        publicId: skill.publicId,
        message: "技能已发布",
      });
    }

    // 复用已有 publicId（下架后重新发布），否则生成新的
    let publicId = skill.publicId;
    if (!publicId) {
      publicId = await generateUniquePublicId();
    }

    await prisma.skill.update({
      where: { id },
      data: {
        isPublic: true,
        publicId,
        publishedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      publicId,
    });
  } catch (e) {
    console.error("发布技能到广场失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/skills/[id]/publish - 从广场下架
// 需要 requireAuth() + 归属校验
// 设置 isPublic: false，保留 publicId（重新发布时复用）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;

    const { id } = params;

    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      return NextResponse.json(
        { error: "技能不存在" },
        { status: 404 }
      );
    }

    // 归属校验：admin 或本人
    if (skill.userId !== auth.user.id && auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "无权操作" },
        { status: 403 }
      );
    }

    await prisma.skill.update({
      where: { id },
      data: {
        isPublic: false,
        // 保留 publicId，便于重新发布时复用
      },
    });

    return NextResponse.json({
      success: true,
      message: "已从广场下架",
    });
  } catch (e) {
    console.error("从广场下架技能失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

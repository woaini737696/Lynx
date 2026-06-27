import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { validateString } from "@/lib/validate";

const logger = getLogger("user-profile-api");

// GET /api/user/profile - 获取当前登录用户的个人资料
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        profession: true,
        avatarUrl: true,
        role: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (e) {
    logger.error({ err: e }, "获取用户资料失败");
    const isDev = process.env.NODE_ENV !== "production";
    const errorMsg = isDev
      ? "服务器错误：" + (e as Error).message
      : "服务器错误";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// PUT /api/user/profile - 更新当前登录用户的个人资料
// 仅允许更新 displayName / profession / avatarUrl，不允许改 username/role/passwordHash
export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));

    const displayName = validateString(body?.displayName, 100);
    const profession = validateString(body?.profession, 100);
    const avatarUrl = validateString(body?.avatarUrl, 500);

    const updated = await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        displayName,
        profession: profession || null,
        avatarUrl: avatarUrl || null,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        profession: true,
        avatarUrl: true,
        role: true,
        email: true,
      },
    });

    return NextResponse.json({ user: updated, success: true });
  } catch (e) {
    logger.error({ err: e }, "更新用户资料失败");
    const isDev = process.env.NODE_ENV !== "production";
    const errorMsg = isDev
      ? "服务器错误：" + (e as Error).message
      : "服务器错误";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

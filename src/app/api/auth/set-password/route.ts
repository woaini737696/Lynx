// 设置密码端点：首次登录或后续设置密码
// 用于自注册用户（未设密码）首次设置密码，或已登录用户修改密码
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { rateLimit, getClientKey } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth-utils";

const logger = getLogger("auth-set-password");

export async function POST(req: NextRequest) {
  try {
    // 速率限制：每用户 10 次/小时
    const ip = getClientKey(req);
    const ipLimit = rateLimit(`set-password:ip:${ip}`, 10, 60 * 60 * 1000);
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: "操作过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    // 获取当前登录用户
    const { user: authUser, error } = await requireAuth();
    if (!authUser) {
      return NextResponse.json({ error: error || "未登录" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { password } = body as { password?: string };

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "密码至少 6 位" },
        { status: 400 }
      );
    }
    if (password.length > 64) {
      return NextResponse.json(
        { error: "密码最多 64 位" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        passwordHash,
        passwordSetByUser: true,
      },
    });

    logger.info({ userId: authUser.id }, "用户设置密码成功");
    return NextResponse.json({ ok: true, message: "密码设置成功" });
  } catch (e) {
    logger.error({ err: e }, "设置密码失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

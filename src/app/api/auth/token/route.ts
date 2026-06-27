// App 端 Token 登录端点
// 接收用户名密码，bcrypt 校验（与 NextAuth Credentials Provider 相同逻辑），
// 签发 JWT 返回。App 端用该 token 作为 Authorization: Bearer 凭证。

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/jwt";
import { getLogger } from "@/lib/logger";

const logger = getLogger("auth-token");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = body?.username;
    const password = body?.password;

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const token = await signToken({
      id: user.id,
      username: user.username,
      role: user.role,
      permissionVersion: user.permissionVersion,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
      },
    });
  } catch (e) {
    logger.error({ err: e }, "Token 签发失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

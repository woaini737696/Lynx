// App 端 Token 登录端点
// 支持三种登录模式（与 NextAuth Credentials Provider 对齐）：
//   1. 用户名 + 密码  → { username, password }
//   2. 手机号 + 验证码 → { phone, code }
//   3. 手机号 + 密码   → { phone, password }
// 签发 JWT 返回。App 端用该 token 作为 Authorization: Bearer 凭证。

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/jwt";
import { getLogger } from "@/lib/logger";

const logger = getLogger("auth-token");

function isValidPhone(p: unknown): p is string {
  return typeof p === "string" && /^1[3-9]\d{9}$/.test(p);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    let user: Awaited<ReturnType<typeof prisma.user.findFirst>> = null;

    // 模式 2：手机号 + 验证码
    if (body?.phone && body?.code) {
      const phone = String(body.phone);
      const code = String(body.code);
      if (!isValidPhone(phone)) {
        return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
      }
      const masterCode = process.env.SMS_MASTER_CODE || "888888";
      if (code !== masterCode) {
        return NextResponse.json({ error: "验证码错误" }, { status: 401 });
      }
      // 查找用户，不存在则自动注册（与 NextAuth authorize 逻辑一致）
      user = await prisma.user.findFirst({ where: { phone } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            username: `phone_${phone}`,
            passwordHash: "",
            phone,
            displayName: phone,
            role: "viewer",
          },
        });
      }
      if (!user.active) {
        return NextResponse.json({ error: "账号已禁用" }, { status: 401 });
      }
    }
    // 模式 3：手机号 + 密码
    else if (body?.phone && body?.password) {
      const phone = String(body.phone);
      const password = String(body.password);
      if (!isValidPhone(phone)) {
        return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
      }
      user = await prisma.user.findFirst({ where: { phone } });
      if (!user || !user.active) {
        return NextResponse.json({ error: "手机号或密码错误" }, { status: 401 });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "手机号或密码错误" }, { status: 401 });
      }
    }
    // 模式 1：用户名 + 密码
    else {
      const username = body?.username;
      const password = body?.password;
      if (!username || !password) {
        return NextResponse.json(
          { error: "用户名和密码不能为空" },
          { status: 400 }
        );
      }
      user = await prisma.user.findUnique({
        where: { username: String(username) },
      });
      if (!user || !user.active) {
        return NextResponse.json(
          { error: "用户名或密码错误" },
          { status: 401 }
        );
      }
      const valid = await bcrypt.compare(String(password), user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "用户名或密码错误" },
          { status: 401 }
        );
      }
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

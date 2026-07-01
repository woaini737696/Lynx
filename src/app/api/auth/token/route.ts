// App 端 Token 登录端点
// 支持的登录模式：
//   1. 手机号 + 验证码 → { phone, code }  （需管理员在设置页启用万能验证码）
//   2. 手机号 + 密码   → { phone, password }  （主推，所有账号必须绑定手机号）
// 签发 JWT 返回。App 端用该 token 作为 Authorization: Bearer 凭证。

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/jwt";
import { getEffectiveMasterCode } from "@/lib/auth-config";
import { getLogger } from "@/lib/logger";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

const logger = getLogger("auth-token");

function isValidPhone(p: unknown): p is string {
  return typeof p === "string" && /^1[3-9]\d{9}$/.test(p);
}

export async function POST(req: NextRequest) {
  try {
    // 速率限制：IP 维度 10 次/分钟，防暴力破解
    const ip = getClientKey(req);
    const ipLimit = rateLimit(`token-login:ip:${ip}`, 10, 60 * 1000);
    if (!ipLimit.success) {
      const waitSec = Math.ceil((ipLimit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: `登录尝试过于频繁，请${waitSec}秒后再试` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));

    let user: Awaited<ReturnType<typeof prisma.user.findFirst>> = null;

    // 模式 1：手机号 + 验证码（依赖管理员在设置页启用的万能验证码）
    if (body?.phone && body?.code) {
      const phone = String(body.phone);
      const code = String(body.code);
      if (!isValidPhone(phone)) {
        return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
      }
      const masterCode = await getEffectiveMasterCode();
      if (!masterCode) {
        return NextResponse.json(
          { error: "验证码登录未启用，请使用手机号+密码登录" },
          { status: 503 }
        );
      }
      if (code !== masterCode) {
        return NextResponse.json({ error: "验证码错误" }, { status: 401 });
      }
      // 查找用户，不存在则返回提示（不再自动注册，必须通过注册流程+邀请码）
      user = await prisma.user.findFirst({ where: { phone } });
      if (!user) {
        return NextResponse.json(
          { error: "该手机号未注册，请先注册" },
          { status: 404 }
        );
      }
      if (!user.active) {
        return NextResponse.json({ error: "账号已禁用" }, { status: 401 });
      }
    }
    // 模式 2：手机号 + 密码（主推登录方式）
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
    else {
      return NextResponse.json(
        { error: "请提供手机号+密码 或 手机号+验证码" },
        { status: 400 }
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

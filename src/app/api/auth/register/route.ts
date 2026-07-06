// 用户注册端点：手机号 + 验证码 + 邀请码
// 所有账号必须绑定手机号，注册后可用手机号+密码登录
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getEffectiveMasterCode } from "@/lib/auth-config";
import { signToken } from "@/lib/jwt";
import { getLogger } from "@/lib/logger";
import { rateLimit, getClientKey } from "@/lib/rate-limit";

const logger = getLogger("auth-register");

function isValidPhone(p: unknown): p is string {
  return typeof p === "string" && /^1[3-9]\d{9}$/.test(p);
}

export async function POST(req: NextRequest) {
  try {
    // 速率限制：IP 维度 5 次/小时，防刷注册
    const ip = getClientKey(req);
    const ipLimit = rateLimit(`register:ip:${ip}`, 5, 60 * 60 * 1000);
    if (!ipLimit.success) {
      const waitMin = Math.ceil((ipLimit.resetAt - Date.now()) / 60000);
      return NextResponse.json(
        { error: `注册请求过于频繁，请${waitMin}分钟后再试` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { phone, code, inviteCode, password, displayName } = body as {
      phone?: string;
      code?: string;
      inviteCode?: string;
      password?: string;
      displayName?: string;
    };

    // 基础校验
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
    }
    // 手机号维度速率限制：同一手机号 3 次/天
    const phoneLimit = rateLimit(`register:phone:${phone}`, 3, 24 * 60 * 60 * 1000);
    if (!phoneLimit.success) {
      return NextResponse.json(
        { error: "该手机号今日注册尝试次数过多，请明天再试" },
        { status: 429 }
      );
    }
    if (!code || !inviteCode) {
      return NextResponse.json(
        { error: "手机号、验证码、邀请码均为必填" },
        { status: 400 }
      );
    }
    // password 可选：未提供时自动生成随机密码（用户可用验证码登录）
    const hasUserPassword = password && password.length >= 6;
    const finalPassword = hasUserPassword
      ? password
      : Math.random().toString(36).slice(2, 10) + "A1!";

    // 校验验证码（依赖管理员启用的万能验证码）
    const masterCode = await getEffectiveMasterCode();
    if (!masterCode) {
      return NextResponse.json(
        { error: "验证码登录未启用，请联系管理员开启" },
        { status: 503 }
      );
    }
    if (code !== masterCode) {
      return NextResponse.json({ error: "验证码错误" }, { status: 401 });
    }

    // 校验手机号是否已注册
    const existing = await prisma.user.findFirst({ where: { phone } });
    if (existing) {
      return NextResponse.json(
        { error: "该手机号已注册，请直接登录" },
        { status: 409 }
      );
    }

    // 校验邀请码
    const invite = await prisma.inviteCode.findUnique({
      where: { code: String(inviteCode).trim().toUpperCase() },
    });
    if (!invite) {
      return NextResponse.json({ error: "邀请码无效" }, { status: 400 });
    }
    if (invite.status !== "unused") {
      return NextResponse.json({ error: "邀请码已被使用或已失效" }, { status: 400 });
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "邀请码已过期" }, { status: 400 });
    }

    // 创建用户 + 标记邀请码已使用（事务）
    const username = `phone_${phone}`;
    const passwordHash = await bcrypt.hash(finalPassword, 10);
    const registerIp = getClientKey(req);
    const userAgent = req.headers.get("user-agent") || null;
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username,
          passwordHash,
          phone,
          displayName: displayName?.trim() || phone,
          role: "viewer",
          source: "self_register", // C 端用户：自注册
          registerIp,
          lastLoginAt: new Date(), // 注册即首次登录
          passwordSetByUser: hasUserPassword ? true : false, // 未传密码时标记为 false，首次登录弹窗设置
        },
      });
      // 写入首次登录日志
      await tx.loginLog.create({
        data: { userId: u.id, ip: registerIp, userAgent },
      });
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: {
          status: "used",
          usedBy: u.id,
          usedAt: new Date(),
        },
      });
      return u;
    });

    logger.info({ userId: user.id, phone, inviteCodeId: invite.id }, "用户注册成功");

    // 签发 token，注册即登录
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
      message: "注册成功",
    });
  } catch (e) {
    logger.error({ err: e }, "注册失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

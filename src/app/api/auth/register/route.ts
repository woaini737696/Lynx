// 用户注册端点：手机号 + 验证码 + 邀请码
// 所有账号必须绑定手机号，注册后可用手机号+密码登录
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getEffectiveMasterCode } from "@/lib/auth-config";
import { signToken } from "@/lib/jwt";
import { getLogger } from "@/lib/logger";

const logger = getLogger("auth-register");

function isValidPhone(p: unknown): p is string {
  return typeof p === "string" && /^1[3-9]\d{9}$/.test(p);
}

export async function POST(req: NextRequest) {
  try {
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
    if (!code || !inviteCode || !password) {
      return NextResponse.json(
        { error: "手机号、验证码、邀请码、密码均为必填" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }

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
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          username,
          passwordHash,
          phone,
          displayName: displayName?.trim() || phone,
          role: "viewer",
        },
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

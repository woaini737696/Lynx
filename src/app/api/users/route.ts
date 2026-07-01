import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { validateString } from "@/lib/validate";

const logger = getLogger("users-api");

// GET /api/users - 列出所有用户（仅 admin）
// 返回字段中包含 profession（通过 join Role 表获取）
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    // 并行查询用户列表与角色表（用于 join 出 profession）
    const [users, roles] = await Promise.all([
      prisma.user.findMany({
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          username: true,
          phone: true,
          email: true,
          displayName: true,
          role: true,
          active: true,
          createdAt: true,
        },
      }),
      prisma.role.findMany({
        select: { name: true, profession: true },
      }),
    ]);

    // 角色 name → profession 映射
    const roleProfessionMap = new Map<string, string | null>();
    for (const r of roles) {
      roleProfessionMap.set(r.name, r.profession);
    }

    // 附加 profession 字段（来自所绑定角色的 profession）
    const result = users.map((u) => ({
      ...u,
      profession: roleProfessionMap.get(u.role) || null,
    }));

    return NextResponse.json({ users: result });
  } catch (e) {
    logger.error({ err: e }, "获取用户列表失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST /api/users - 创建新用户（仅 admin）
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const body = await req.json().catch(() => ({}));

    // 输入校验：username 可选（不填自动生成 phone_${phone}），password 可选（C 端用户可免密，不填自动生成）
    const username = validateString(body?.username, 64);

    // 密码校验：可选，长度 6-128；未提供或不足 6 位时自动生成随机密码（C 端用户可免密）
    const rawPassword = body?.password;
    let password: string;
    if (typeof rawPassword === "string" && rawPassword.length >= 6) {
      if (rawPassword.length > 128) {
        return NextResponse.json(
          { error: "密码长度不能超过 128 位" },
          { status: 400 }
        );
      }
      password = rawPassword;
    } else {
      // 自动生成随机密码（与 /api/auth/register 一致，C 端用户可凭手机号+验证码登录）
      password = Math.random().toString(36).slice(2, 10) + "A1!";
    }

    const email = validateString(body?.email, 255);
    const displayName = validateString(body?.displayName, 100);

    // 手机号校验（支持手机号登录，必填）
    const phone = validateString(body?.phone, 20);
    if (!phone) {
      return NextResponse.json({ error: "手机号不能为空" }, { status: 400 });
    }
    // 中国手机号格式校验：1 开头 + 第二位 3-9 + 共 11 位
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ error: "手机号格式不正确（需为 11 位中国手机号）" }, { status: 400 });
    }

    // 校验 role：动态查 Role 表是否存在该 name（不再硬编码 admin/editor/viewer）
    const role =
      typeof body?.role === "string" ? body.role.trim() : "";
    if (!role) {
      return NextResponse.json({ error: "角色不能为空" }, { status: 400 });
    }
    const roleRecord = await prisma.role.findUnique({
      where: { name: role },
    });
    if (!roleRecord) {
      return NextResponse.json(
        { error: "角色无效，请选择有效的角色" },
        { status: 400 }
      );
    }

    // 检查用户名是否已存在（仅在显式指定 username 时检查）
    if (username) {
      const existing = await prisma.user.findUnique({
        where: { username },
      });
      if (existing) {
        return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
      }
    }

    // 检查手机号是否已存在
    const existingPhone = await prisma.user.findUnique({
      where: { phone },
    });
    if (existingPhone) {
      return NextResponse.json({ error: "手机号已被使用" }, { status: 400 });
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (existingEmail) {
        return NextResponse.json({ error: "邮箱已被使用" }, { status: 400 });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // username 自动生成（如果未显式指定）：phone_${phone}
    const finalUsername = username || `phone_${phone}`;

    const user = await prisma.user.create({
      data: {
        username: finalUsername,
        passwordHash,
        phone,
        email: email || null,
        displayName,
        role,
        source: "admin_create", // admin 创建：系统用户（非 C 端自注册）
      },
      select: {
        id: true,
        username: true,
        phone: true,
        email: true,
        displayName: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user, success: true });
  } catch (e) {
    logger.error({ err: e }, "创建用户失败");
    const isDev = process.env.NODE_ENV !== "production";
    const errorMsg = isDev
      ? "服务器错误：" + (e as Error).message
      : "服务器错误";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

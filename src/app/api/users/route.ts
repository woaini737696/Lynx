import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { validateString } from "@/lib/validate";

const logger = getLogger("users-api");

// GET /api/users - 列出所有用户（仅 admin，跨职业空间全量视图）
// 查询参数：
//   q          - 搜索关键词（手机号 / 用户名 / 显示名）
//   profession - 职业空间筛选（职业 key，如 pm / designer；all 或空表示全部）
// 返回字段中包含 profession：优先取 User.profession，回退到所绑定角色的 Role.profession
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase() || "";
    const professionFilter = searchParams.get("profession") || "all";

    // 构造 where 条件（admin 不受职业空间隔离，可查看全部用户）
    const where: Record<string, unknown> = {};
    if (professionFilter !== "all") {
      // 职业空间筛选：User.profession 优先，未设置时回退到 Role.profession
      const roles = await prisma.role.findMany({
        where: { profession: professionFilter },
        select: { name: true },
      });
      const roleNames = roles.map((r) => r.name);
      where.OR = [
        { profession: professionFilter },
        ...(roleNames.length > 0 ? [{ role: { in: roleNames } }] : []),
      ];
    }
    if (q) {
      const qCond = {
        OR: [
          { phone: { contains: q } },
          { displayName: { contains: q } },
          { username: { contains: q } },
        ],
      };
      where.AND = where.AND ? [...(where.AND as unknown[]), qCond] : [qCond];
    }

    // 并行查询用户列表与角色表（用于回退出 profession）
    const [users, roles] = await Promise.all([
      prisma.user.findMany({
        where,
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
          profession: true,
        },
      }),
      prisma.role.findMany({
        select: { name: true, profession: true },
      }),
    ]);

    // 角色 name → profession 映射（用于 User.profession 为空时回退）
    const roleProfessionMap = new Map<string, string | null>();
    for (const r of roles) {
      roleProfessionMap.set(r.name, r.profession);
    }

    // 附加 profession 字段（User.profession 优先，回退到 Role.profession）
    const result = users.map((u) => ({
      ...u,
      profession: u.profession || roleProfessionMap.get(u.role) || null,
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

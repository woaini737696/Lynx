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

    // 输入校验：username max 64，password min 6 max 128，role 动态查 Role 表
    const username = validateString(body?.username, 64);
    if (!username) {
      return NextResponse.json({ error: "用户名不能为空" }, { status: 400 });
    }

    // 密码校验：必须为字符串，长度 6-128（不截断，超长直接拒绝）
    const rawPassword = body?.password;
    if (typeof rawPassword !== "string" || rawPassword.length < 6) {
      return NextResponse.json(
        { error: "密码不能为空且至少 6 位" },
        { status: 400 }
      );
    }
    if (rawPassword.length > 128) {
      return NextResponse.json(
        { error: "密码长度不能超过 128 位" },
        { status: 400 }
      );
    }
    const password = rawPassword;

    const email = validateString(body?.email, 255);
    const displayName = validateString(body?.displayName, 100);

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

    // 检查用户名是否已存在
    const existing = await prisma.user.findUnique({
      where: { username },
    });
    if (existing) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
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

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        email: email || null,
        displayName,
        role,
      },
      select: {
        id: true,
        username: true,
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
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

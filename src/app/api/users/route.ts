import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("users-api");

// GET /api/users - 列出所有用户（仅 admin）
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.user === null) return auth.error;

    const users = await prisma.user.findMany({
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
    });

    return NextResponse.json({ users });
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

    const body = await req.json();
    const { username, password, email, displayName, role } = body;

    // 参数校验
    if (!username || !username.trim()) {
      return NextResponse.json({ error: "用户名不能为空" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "密码不能为空且至少 6 位" },
        { status: 400 }
      );
    }

    // 检查用户名是否已存在
    const existing = await prisma.user.findUnique({
      where: { username: username.trim() },
    });
    if (existing) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (email && email.trim()) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: email.trim() },
      });
      if (existingEmail) {
        return NextResponse.json({ error: "邮箱已被使用" }, { status: 400 });
      }
    }

    // 校验角色
    const validRoles = ["admin", "editor", "viewer"];
    const finalRole = role && validRoles.includes(role) ? role : "viewer";

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        passwordHash,
        email: email?.trim() || null,
        displayName: displayName?.trim() || "",
        role: finalRole,
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

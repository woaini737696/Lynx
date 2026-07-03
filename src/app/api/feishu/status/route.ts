// GET /api/feishu/status
// 检查当前用户是否已绑定飞书账号
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  const token = await prisma.feishuToken.findUnique({
    where: { userId: auth.user.id },
    select: { openId: true, name: true, expiresAt: true },
  });

  if (!token) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    name: token.name,
    openId: token.openId,
    expiresAt: token.expiresAt.toISOString(),
  });
}

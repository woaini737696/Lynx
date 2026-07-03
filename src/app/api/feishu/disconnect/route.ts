// POST /api/feishu/disconnect
// 断开当前用户的飞书连接（删除 FeishuToken 记录）
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

export async function POST() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    await prisma.feishuToken.deleteMany({ where: { userId: auth.user.id } });
  } catch {
    // 删除失败也返回成功（记录可能已不存在）
  }

  return NextResponse.json({ success: true });
}

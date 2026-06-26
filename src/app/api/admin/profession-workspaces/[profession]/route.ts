/**
 * 职业 AI 工作空间单条管理（admin）
 * DELETE /api/admin/profession-workspaces/[profession]  - 重置为默认（删除自定义配置）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { isValidProfessionKey } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { profession: string } }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });
  }

  const profession = decodeURIComponent(params.profession);
  if (!isValidProfessionKey(profession)) {
    return NextResponse.json({ error: "无效的职业 key" }, { status: 400 });
  }

  await prisma.professionWorkspace.deleteMany({ where: { profession } });
  return NextResponse.json({ success: true });
}

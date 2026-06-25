import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// GET /api/ai/distill/templates/[id]/versions
// 返回指定模板的版本历史列表（按版本号倒序）
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const versions = await prisma.skillVersion.findMany({
      where: { skillId: params.id },
      orderBy: { version: "desc" },
    });

    return NextResponse.json({ versions });
  } catch (e) {
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

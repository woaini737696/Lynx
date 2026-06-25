import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// GET /api/skills/[id]/versions/[version] - 获取特定版本详情
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; version: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;

    const { id, version: versionStr } = params;
    const version = parseInt(versionStr, 10);

    if (isNaN(version) || version < 1) {
      return NextResponse.json(
        { error: "version 必须为正整数" },
        { status: 400 }
      );
    }

    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      return NextResponse.json(
        { error: "未找到 Skill" },
        { status: 404 }
      );
    }

    // 归属校验：admin 或本人
    if (skill.userId !== auth.user.id && auth.user.role !== "admin") {
      return NextResponse.json(
        { error: "无权操作" },
        { status: 403 }
      );
    }

    const ver = await prisma.skillVersion.findUnique({
      where: { skillId_version: { skillId: id, version } },
    });
    if (!ver) {
      return NextResponse.json(
        { error: `未找到版本 ${version}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ version: ver });
  } catch (e) {
    console.error("获取版本详情失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

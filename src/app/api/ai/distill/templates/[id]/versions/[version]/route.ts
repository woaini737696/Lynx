import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// POST /api/ai/distill/templates/[id]/versions/[version]
// 回滚到指定版本：将指定版本内容写回 Skill，同时为当前状态创建快照
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; version: string } }
) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const versionNum = parseInt(params.version, 10);
    if (isNaN(versionNum)) {
      return NextResponse.json(
        { error: "无效的版本号" },
        { status: 400 }
      );
    }

    // 查找目标版本
    const targetVersion = await prisma.skillVersion.findUnique({
      where: { skillId_version: { skillId: params.id, version: versionNum } },
    });
    if (!targetVersion) {
      return NextResponse.json(
        { error: "版本不存在" },
        { status: 404 }
      );
    }

    // 查询当前 Skill
    const current = await prisma.skill.findUnique({
      where: { id: params.id },
    });
    if (!current) {
      return NextResponse.json(
        { error: "模板不存在" },
        { status: 404 }
      );
    }

    // 为当前状态创建快照（回滚前备份）
    const latestVersion = await prisma.skillVersion.findFirst({
      where: { skillId: params.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const backupVersionNum = (latestVersion?.version || 0) + 1;
    await prisma.skillVersion.create({
      data: {
        skillId: params.id,
        version: backupVersionNum,
        name: current.name,
        description: current.description,
        category: current.category,
        content: current.content,
        parameters: current.parameters as any,
        promptTemplate: current.promptTemplate,
        tags: current.tags as any,
      },
    });

    // 将目标版本的内容写回 Skill
    const updated = await prisma.skill.update({
      where: { id: params.id },
      data: {
        name: targetVersion.name,
        description: targetVersion.description,
        category: targetVersion.category,
        content: targetVersion.content,
        parameters: targetVersion.parameters as any,
        promptTemplate: targetVersion.promptTemplate,
        tags: targetVersion.tags as any,
      },
    });

    return NextResponse.json({
      skill: updated,
      message: `已回滚到版本 v${versionNum}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

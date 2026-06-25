import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pruneOldVersions } from "@/lib/skill-version-utils";
import { requireAuth } from "@/lib/auth-utils";

// POST /api/skills/[id]/rollback - 回滚到指定版本
// body: { versionId }
// 1. 用 Prisma 查询 SkillVersion 表，找到对应版本
// 2. 将该版本的 content/parameters/promptTemplate/tags/name/description/category 写回 Skill 表
// 3. 同时创建一个新的 SkillVersion 记录（记录回滚操作前的快照）
// 4. 返回 { success: true, versionId, newVersion: N }
// 5. 找不到版本返回 404
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;

    const { id } = params;
    const body = await req.json();
    const { versionId } = body;

    // 参数校验
    if (!versionId) {
      return NextResponse.json(
        { error: "versionId 不能为空" },
        { status: 400 }
      );
    }

    // 校验 Skill 是否存在
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

    // 查询目标版本
    const target = await prisma.skillVersion.findUnique({
      where: { id: versionId },
    });

    // 兼容：如果按 id 没找到，尝试按 (skillId, version) 复合唯一键查找
    let targetVersion = target;
    if (!targetVersion) {
      const versionNum = Number(versionId);
      if (!Number.isNaN(versionNum)) {
        targetVersion = await prisma.skillVersion.findUnique({
          where: { skillId_version: { skillId: id, version: versionNum } },
        });
      }
    }

    if (!targetVersion || targetVersion.skillId !== id) {
      return NextResponse.json(
        { error: `未找到版本 ${versionId}` },
        { status: 404 }
      );
    }

    // 1. 先把当前 Skill 状态保存为新版本快照（回滚前的备份）
    const latestVersion = await prisma.skillVersion.findFirst({
      where: { skillId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const newVersion = (latestVersion?.version || 0) + 1;

    await prisma.skillVersion.create({
      data: {
        skillId: id,
        version: newVersion,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        content: skill.content,
        parameters: skill.parameters as Prisma.InputJsonValue,
        promptTemplate: skill.promptTemplate,
        tags: skill.tags as Prisma.InputJsonValue,
      },
    });

    // 2. 用目标版本数据覆盖当前 Skill
    await prisma.skill.update({
      where: { id },
      data: {
        name: targetVersion.name,
        description: targetVersion.description,
        category: targetVersion.category,
        content: targetVersion.content,
        parameters: targetVersion.parameters as Prisma.InputJsonValue,
        promptTemplate: targetVersion.promptTemplate,
        tags: targetVersion.tags as Prisma.InputJsonValue,
      },
    });

    // 3. 清理超出上限的旧版本
    await pruneOldVersions(id);

    return NextResponse.json({
      success: true,
      versionId,
      newVersion,
    });
  } catch (e) {
    console.error("回滚失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

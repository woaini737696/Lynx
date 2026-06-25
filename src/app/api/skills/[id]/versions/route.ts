import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pruneOldVersions } from "@/lib/skill-version-utils";
import { requireAuth } from "@/lib/auth-utils";

// GET /api/skills/[id]/versions - 返回版本列表（摘要，不含 content 全文）
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;

    const { id } = params;

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

    const versions = await prisma.skillVersion.findMany({
      where: { skillId: id },
      orderBy: { version: "desc" },
      select: {
        id: true,
        skillId: true,
        version: true,
        name: true,
        description: true,
        category: true,
        tags: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      versions,
      current: {
        name: skill.name,
        description: skill.description,
        category: skill.category,
        tags: skill.tags,
        updatedAt: skill.updatedAt,
      },
    });
  } catch (e) {
    console.error("获取版本列表失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// POST /api/skills/[id]/versions - 回滚到指定版本
// body: { version: number }  回滚到指定版本号
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;

    const { id } = params;
    const body = await req.json();
    const { version } = body;

    if (typeof version !== "number" || version < 1) {
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

    const target = await prisma.skillVersion.findUnique({
      where: { skillId_version: { skillId: id, version } },
    });
    if (!target) {
      return NextResponse.json(
        { error: `未找到版本 ${version}` },
        { status: 404 }
      );
    }

    // 1. 先把当前 Skill 状态保存为新版本快照（回滚前的备份）
    const latestVersion = await prisma.skillVersion.findFirst({
      where: { skillId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latestVersion?.version || 0) + 1;

    await prisma.skillVersion.create({
      data: {
        skillId: id,
        version: nextVersion,
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
    const updated = await prisma.skill.update({
      where: { id },
      data: {
        name: target.name,
        description: target.description,
        category: target.category,
        content: target.content,
        parameters: target.parameters as Prisma.InputJsonValue,
        promptTemplate: target.promptTemplate,
        tags: target.tags as Prisma.InputJsonValue,
      },
    });

    // 3. 清理超出上限的旧版本（保留最新 MAX_VERSIONS 个）
    await pruneOldVersions(id);

    return NextResponse.json({
      skill: updated,
      rolledBackTo: version,
      backupVersion: nextVersion,
      success: true,
    });
  } catch (e) {
    console.error("回滚版本失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

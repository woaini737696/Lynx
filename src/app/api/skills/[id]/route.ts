import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  serializeSkillToMarkdown,
  type SkillParameter,
} from "@/lib/skill-parser";
import { pruneOldVersions } from "@/lib/skill-version-utils";
import { requireAuth } from "@/lib/auth-utils";

// GET /api/skills/[id] - 获取单个 Skill
// GET /api/skills/[id]?export=1 - 导出为 Markdown
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const isExport = searchParams.get("export") === "1";

    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      return NextResponse.json(
        { error: "未找到 Skill" },
        { status: 404 }
      );
    }

    // 验证归属权（admin 可访问所有）
    if (user.role !== "admin" && skill.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    if (isExport) {
      const md = serializeSkillToMarkdown({
        name: skill.name,
        description: skill.description,
        category: skill.category,
        tags: (skill.tags as string[]) || [],
        parameters: (skill.parameters as unknown as SkillParameter[]) || [],
        content: skill.content,
        promptTemplate: skill.promptTemplate,
        source: skill.source,
      });
      const safeName = skill.name.replace(/[\\/:*?"<>|]/g, "_");
      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(
            safeName
          )}.md"`,
        },
      });
    }

    return NextResponse.json({ skill });
  } catch (e) {
    console.error("获取 Skill 失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// PATCH /api/skills/[id] - 更新 Skill
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = params;
    const body = await req.json();
    const {
      name,
      description,
      category,
      content,
      parameters,
      promptTemplate,
      tags,
      source,
    } = body;

    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "未找到 Skill" },
        { status: 404 }
      );
    }

    // 验证归属权（admin 可访问所有）
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (category !== undefined) data.category = category;
    if (content !== undefined) data.content = content;
    if (parameters !== undefined) data.parameters = parameters;
    if (promptTemplate !== undefined) data.promptTemplate = promptTemplate;
    if (tags !== undefined) data.tags = tags;
    if (source !== undefined) data.source = source;

    // 在更新前，先把当前状态保存为版本快照
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
        name: existing.name,
        description: existing.description,
        category: existing.category,
        content: existing.content,
        parameters: existing.parameters as Prisma.InputJsonValue,
        promptTemplate: existing.promptTemplate,
        tags: existing.tags as Prisma.InputJsonValue,
      },
    });

    const skill = await prisma.skill.update({
      where: { id },
      data: data as never,
    });

    // 清理超出上限的旧版本
    await pruneOldVersions(id);

    return NextResponse.json({ skill, success: true });
  } catch (e) {
    console.error("更新 Skill 失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/skills/[id] - 删除 Skill
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = params;
    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "未找到 Skill" },
        { status: 404 }
      );
    }

    // 验证归属权（admin 可访问所有）
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    await prisma.skill.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("删除 Skill 失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

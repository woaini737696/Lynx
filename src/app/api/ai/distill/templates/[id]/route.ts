import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

// PATCH /api/ai/distill/templates/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const { id } = params;
    const {
      name,
      description,
      category,
      parameters,
      promptTemplate,
      steps,
    } = await req.json();

    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    }

    // 不允许编辑内置模板（source 为 builtin 的）
    if (existing.source === "builtin") {
      return NextResponse.json(
        { error: "内置模板不可编辑" },
        { status: 400 }
      );
    }

    const content = `# ${name || existing.name}\n\n${
      description || existing.description
    }\n\n## 步骤\n${(steps || [])
      .map((s: string, i: number) => `${i + 1}. ${s}`)
      .join("\n")}\n\n## 提示词模板\n\n${
      promptTemplate || existing.promptTemplate
    }`;

    // 版本管理：更新前先将当前状态快照写入 SkillVersion 表
    const latestVersion = await prisma.skillVersion.findFirst({
      where: { skillId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const newVersionNum = (latestVersion?.version || 0) + 1;
    await prisma.skillVersion.create({
      data: {
        skillId: id,
        version: newVersionNum,
        name: existing.name,
        description: existing.description,
        category: existing.category,
        content: existing.content,
        parameters: existing.parameters as any,
        promptTemplate: existing.promptTemplate,
        tags: existing.tags as any,
      },
    });

    const updated = await prisma.skill.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && {
          description: description.trim(),
        }),
        ...(category !== undefined && { category }),
        ...(parameters !== undefined && { parameters }),
        ...(promptTemplate !== undefined && { promptTemplate }),
        content,
      },
    });

    return NextResponse.json({ skill: updated });
  } catch (e) {
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/ai/distill/templates/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const { id } = params;
    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    }

    // 不允许删除内置模板（source 为 builtin 的）
    if (existing.source === "builtin") {
      return NextResponse.json(
        { error: "内置模板不可删除" },
        { status: 400 }
      );
    }

    await prisma.skill.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

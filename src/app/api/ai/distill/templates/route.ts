import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { DISTILL_TEMPLATES } from "@/lib/distill-templates";

// GET /api/ai/distill/templates
// 返回 { builtins: DistillTemplate[], customs: Skill[] }
export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    // 获取所有自定义技能（source 为 manual 或 distill）
    const customs = await prisma.skill.findMany({
      where: { source: { in: ["manual", "distill"] } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      builtins: DISTILL_TEMPLATES,
      customs: customs.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        content: s.content,
        parameters: s.parameters,
        promptTemplate: s.promptTemplate,
        source: s.source,
        tags: s.tags,
        usageCount: s.usageCount,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/ai/distill/templates
// 创建自定义蒸馏模板
export async function POST(req: NextRequest) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const {
      name,
      description,
      category,
      icon,
      parameters,
      promptTemplate,
      steps,
    } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }
    if (!promptTemplate?.trim()) {
      return NextResponse.json(
        { error: "提示词模板不能为空" },
        { status: 400 }
      );
    }

    // 构建 content（包含步骤）
    const content = `# ${name}\n\n${description || ""}\n\n## 步骤\n${(steps || [])
      .map((s: string, i: number) => `${i + 1}. ${s}`)
      .join("\n")}\n\n## 提示词模板\n\n${promptTemplate}`;

    const skill = await prisma.skill.create({
      data: {
        name: name.trim(),
        description: description?.trim() || "",
        category: category || "knowledge",
        content,
        parameters: (parameters || []) as unknown as Prisma.InputJsonValue,
        promptTemplate,
        source: "distill",
        tags: [],
      },
    });

    return NextResponse.json({ skill });
  } catch (e) {
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

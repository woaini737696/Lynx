import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/skills/export - 批量导出
// body: { skillIds: string[] } 或 { category: string }
// 返回单个 JSON 文件，包含多个 Skill 的完整数据
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { skillIds, category } = body as {
      skillIds?: string[];
      category?: string;
    };

    let where: Record<string, unknown> = {};
    if (Array.isArray(skillIds) && skillIds.length > 0) {
      where = { id: { in: skillIds } };
    } else if (typeof category === "string" && category !== "all") {
      where = { category };
    }

    const skills = await prisma.skill.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
    });

    if (skills.length === 0) {
      return NextResponse.json(
        { error: "没有可导出的 Skill" },
        { status: 400 }
      );
    }

    // 序列化为可导入的 JSON 数组格式
    const exportData = skills.map((s) => ({
      name: s.name,
      description: s.description,
      category: s.category,
      content: s.content,
      parameters: s.parameters,
      promptTemplate: s.promptTemplate,
      tags: s.tags,
      source: s.source,
    }));

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      count: exportData.length,
      skills: exportData,
    };

    const json = JSON.stringify(payload, null, 2);

    // 生成文件名：lynnhub-skills-YYYYMMDD.json
    const now = new Date();
    const dateStr =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, "0") +
      now.getDate().toString().padStart(2, "0");

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="lynnhub-skills-${dateStr}.json"`,
      },
    });
  } catch (e) {
    console.error("批量导出 Skill 失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

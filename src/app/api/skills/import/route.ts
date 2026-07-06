import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseSkillMarkdown } from "@/lib/skill-parser";
import { requireAuth } from "@/lib/auth-utils";

// POST /api/skills/import - 导入 Markdown（单个/批量）或 JSON（批量）
// body:
//   { markdown: string } 单个 Markdown
//   { items: string[] } 批量 Markdown
//   { json: string | object } JSON 批量导入（奇思导出格式）
//   { mode?: "skip" | "overwrite" } 去重模式，默认 skip
// 鉴权：必须登录，创建技能强制 userId = user.id，去重仅匹配本人技能
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;
    const user = auth.user;

    const body = await req.json();
    const mode: "skip" | "overwrite" =
      body.mode === "overwrite" ? "overwrite" : "skip";

    // ============ JSON 批量导入 ============
    if (body.json !== undefined) {
      let payload: unknown = body.json;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return NextResponse.json(
            { error: "JSON 格式无效" },
            { status: 400 }
          );
        }
      }

      const skillsArr = extractSkillsFromJson(payload);
      if (skillsArr.length === 0) {
        return NextResponse.json(
          { error: "JSON 中没有可导入的 Skill" },
          { status: 400 }
        );
      }

      const results: Array<{
        success: boolean;
        name?: string;
        id?: string;
        action?: string;
        error?: string;
      }> = [];

      for (const item of skillsArr) {
        try {
          if (!item.name || !item.name.trim()) {
            results.push({ success: false, error: "缺少 name 字段" });
            continue;
          }

          // 去重仅匹配当前用户的同名技能（admin 同样仅匹配自己，避免误覆盖他人技能）
          const existing = await prisma.skill.findFirst({
            where: { name: item.name, userId: user.id },
          });

          if (existing) {
            if (mode === "skip") {
              results.push({
                success: true,
                name: existing.name,
                id: existing.id,
                action: "skipped",
              });
              continue;
            }
            // overwrite
            const updated = await prisma.skill.update({
              where: { id: existing.id },
              data: {
                description: item.description || existing.description,
                category: item.category || existing.category,
                content: item.content ?? existing.content,
                parameters:
                  item.parameters !== undefined
                    ? (item.parameters as Prisma.InputJsonValue)
                    : (existing.parameters as Prisma.InputJsonValue),
                promptTemplate:
                  item.promptTemplate ?? existing.promptTemplate,
                tags:
                  item.tags !== undefined
                    ? (item.tags as Prisma.InputJsonValue)
                    : (existing.tags as Prisma.InputJsonValue),
                source: "imported",
              },
            });
            results.push({
              success: true,
              name: updated.name,
              id: updated.id,
              action: "overwritten",
            });
          } else {
            const created = await prisma.skill.create({
              data: {
                name: item.name.trim(),
                description: item.description || item.name,
                category: item.category || "general",
                content: item.content || "",
                parameters:
                  item.parameters !== undefined
                    ? (item.parameters as Prisma.InputJsonValue)
                    : ([] as unknown as Prisma.InputJsonValue),
                promptTemplate: item.promptTemplate || "",
                source: "imported",
                userId: user.id,
                tags:
                  item.tags !== undefined
                    ? (item.tags as Prisma.InputJsonValue)
                    : ([] as unknown as Prisma.InputJsonValue),
              },
            });
            results.push({
              success: true,
              name: created.name,
              id: created.id,
              action: "created",
            });
          }
        } catch (e) {
          results.push({
            success: false,
            error: (e as Error).message,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const createdCount = results.filter(
        (r) => r.action === "created"
      ).length;
      const overwrittenCount = results.filter(
        (r) => r.action === "overwritten"
      ).length;
      const skippedCount = results.filter(
        (r) => r.action === "skipped"
      ).length;

      return NextResponse.json({
        success: true,
        imported: successCount,
        failed: results.length - successCount,
        created: createdCount,
        overwritten: overwrittenCount,
        skipped: skippedCount,
        results,
      });
    }

    // ============ Markdown 导入（原有逻辑） ============
    const markdowns: string[] = [];

    if (typeof body.markdown === "string") {
      markdowns.push(body.markdown);
    } else if (Array.isArray(body.items)) {
      for (const item of body.items) {
        if (typeof item === "string") markdowns.push(item);
      }
    } else {
      return NextResponse.json(
        { error: "请提供 markdown、items 或 json 字段" },
        { status: 400 }
      );
    }

    if (markdowns.length === 0) {
      return NextResponse.json(
        { error: "没有可导入的内容" },
        { status: 400 }
      );
    }

    const results: Array<{
      success: boolean;
      name?: string;
      id?: string;
      action?: string;
      error?: string;
    }> = [];

    for (const md of markdowns) {
      try {
        const data = parseSkillMarkdown(md);
        if (!data.name) {
          results.push({
            success: false,
            error: "缺少 name 字段",
          });
          continue;
        }

        const existing = await prisma.skill.findFirst({
          where: { name: data.name, userId: user.id },
        });

        if (existing) {
          if (mode === "skip") {
            results.push({
              success: true,
              name: existing.name,
              id: existing.id,
              action: "skipped",
            });
            continue;
          }
          const updated = await prisma.skill.update({
            where: { id: existing.id },
            data: {
              description: data.description || existing.description,
              category: data.category || existing.category,
              content: data.content,
              parameters: data.parameters as unknown as Prisma.InputJsonValue,
              promptTemplate: data.promptTemplate,
              tags: data.tags as unknown as Prisma.InputJsonValue,
              source: "imported",
            },
          });
          results.push({
            success: true,
            name: updated.name,
            id: updated.id,
            action: "overwritten",
          });
        } else {
          const skill = await prisma.skill.create({
            data: {
              name: data.name,
              description: data.description || data.name,
              category: data.category || "general",
              content: data.content,
              parameters: data.parameters as unknown as Prisma.InputJsonValue,
              promptTemplate: data.promptTemplate,
              source: "imported",
              userId: user.id,
              tags: data.tags,
            },
          });
          results.push({
            success: true,
            name: skill.name,
            id: skill.id,
            action: "created",
          });
        }
      } catch (e) {
        results.push({
          success: false,
          error: (e as Error).message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      success: true,
      imported: successCount,
      failed: results.length - successCount,
      results,
    });
  } catch (e) {
    console.error("导入 Skill 失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// 从 JSON payload 中提取 Skill 数据数组
// 支持两种格式：
//   1. 奇思导出格式: { version, skills: [...] }
//   2. 直接数组: [...]
function extractSkillsFromJson(payload: unknown): Array<{
  name?: string;
  description?: string;
  category?: string;
  content?: string;
  parameters?: unknown;
  promptTemplate?: string;
  tags?: unknown;
  source?: string;
}> {
  if (!payload) return [];

  // 格式 1: { skills: [...] }
  if (
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Array.isArray((payload as Record<string, unknown>).skills)
  ) {
    return (payload as Record<string, unknown[]>).skills as Array<
      Record<string, unknown>
    >;
  }

  // 格式 2: 直接数组
  if (Array.isArray(payload)) {
    return payload as Array<Record<string, unknown>>;
  }

  return [];
}

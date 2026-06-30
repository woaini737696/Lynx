import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { executeTool } from "@/app/api/ai/assistant/tool-executor";

const logger = getLogger("skills-execute-api");

// POST /api/skills/[id]/execute - 执行指定技能
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requirePermission("skill:execute");
  if (error) return error;

  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { input = "", parameters = {} } = body as {
      input?: string;
      parameters?: Record<string, unknown>;
    };

    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      return NextResponse.json({ error: "技能不存在" }, { status: 404 });
    }

    // 构造 prompt：优先使用 promptTemplate，否则用 content + input
    let prompt: string;
    if (skill.promptTemplate) {
      prompt = skill.promptTemplate.replace(/\{\{input\}\}/g, input);
      // 替换其他参数占位符
      for (const [key, value] of Object.entries(parameters)) {
        prompt = prompt.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, "g"),
          String(value)
        );
      }
    } else {
      prompt = `${skill.content || skill.description}\n\n输入：${input}`;
    }

    // 调用 hermesExecute 工具执行
    const result = await executeTool(
      "hermesExecute",
      {
        prompt,
        mode: "auto",
        timeout: 120,
      },
      user
    );

    const success = !result.error;

    // 记录执行历史到 prisma.skillExecution
    await prisma.skillExecution
      .create({
        data: {
          userId: user.id,
          skillId: id,
          skillName: skill.name,
          source: "manual",
          trigger: "api",
          parameters: { input, parameters } as unknown as Prisma.InputJsonValue,
          result: result.output || result.error || "",
          success,
          durationMs: result.durationMs || 0,
          error: result.error || null,
        },
      })
      .catch((e) => logger.warn({ err: e }, "记录执行历史失败"));

    // 更新使用次数
    await prisma.skill
      .update({
        where: { id },
        data: { usageCount: { increment: 1 } },
      })
      .catch(() => {});

    if (result.error) {
      return NextResponse.json(
        { error: result.error, output: "" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      output: result.output || "",
      message: "技能执行完成",
    });
  } catch (e) {
    logger.error({ err: e }, "技能执行失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

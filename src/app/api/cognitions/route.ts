import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ai, defaultModel, COGNITION_EXTRACT_PROMPT } from "@/lib/ai";
import { generateText } from "ai";
import { writeMemoryForCognition } from "@/lib/memory-sync";
import { requireAuth, requirePermission, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { validateString } from "@/lib/validate";

const logger = getLogger("cognitions-api");

// 认知类型与来源枚举（与 Prisma schema 注释保持一致）
const VALID_COGNITION_TYPES = new Set(["method", "experience", "prompt"]);
const VALID_COGNITION_SOURCES = new Set(["conversation", "idea", "manual"]);

// 获取认知库
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const cognitions = await prisma.cognition.findMany({
      where: buildUserFilter(user),
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ cognitions });
  } catch (e) {
    logger.error({ err: e }, "获取认知失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 从内容提取认知（AI）或直接写入单条认知（用户确认入库）
// 当传入 type + content 时为直接写入模式（用于看板完成弹窗的用户确认）
// 当仅传入 content 时为 AI 提取模式
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission("cognition:extract");
    if (error) return error;

    const body = await req.json();
    const {
      source: rawSource = "manual",
      type: rawType,
      ideaId = null,
    } = body as {
      content?: string;
      source?: string;
      type?: string;
      ideaId?: string | null;
    };

    // 校验 source 枚举
    if (!VALID_COGNITION_SOURCES.has(rawSource)) {
      return NextResponse.json(
        { error: "source 必须为 conversation | idea | manual" },
        { status: 400 }
      );
    }
    const source = rawSource;

    // 校验 content（字符串，长度上限 10000）
    const content = validateString(body?.content, 10000);
    if (!content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

    // 校验 type 枚举（可选，提供时必须合法）
    let type: "method" | "experience" | "prompt" | undefined;
    if (rawType !== undefined && rawType !== null && rawType !== "") {
      if (!VALID_COGNITION_TYPES.has(rawType)) {
        return NextResponse.json(
          { error: "type 必须为 method | experience | prompt" },
          { status: 400 }
        );
      }
      type = rawType as "method" | "experience" | "prompt";
    }

    // 直接写入模式：用户在看板完成弹窗中确认入库
    if (type) {
      const c = await prisma.cognition.create({
        data: {
          type,
          content,
          source,
          ideaId,
          tags: [],
          userId: user.id,
        },
      });
      // 异步写入 Memory（不阻塞）
      writeMemoryForCognition(c.id, c.content).catch((e) => {
        logger.error({ err: e, cognitionId: c.id }, "writeMemory 异步失败");
      });
      return NextResponse.json(
        {
          created: [c],
          count: 1,
          success: true,
        },
        { status: 201 }
      );
    }

    // AI 提取模式：从内容中提取多条认知
    let extracted: {
      method: Array<{ content: string }>;
      experience: Array<{ content: string }>;
      prompt: Array<{ content: string }>;
    } = { method: [], experience: [], prompt: [] };

    if (process.env.AI_API_KEY) {
      try {
        const result = await generateText({
          model: ai(defaultModel),
          system: COGNITION_EXTRACT_PROMPT,
          prompt: content,
        });
        extracted = JSON.parse(result.text);
      } catch (e) {
        logger.error({ err: e }, "AI 提取认知失败");
      }
    }

    // 批量入库（使用 createMany 一次性写入，避免 N+1 串行 DB 往返）
    const allItems: Array<{ type: string; content: string }> = [
      ...extracted.method.map((i) => ({ type: "method", content: i.content })),
      ...extracted.experience.map((i) => ({ type: "experience", content: i.content })),
      ...extracted.prompt.map((i) => ({ type: "prompt", content: i.content })),
    ];

    let created: Array<{ id: string; type: string; content: string }> = [];
    if (allItems.length > 0) {
      // 使用事务逐条 create 并收集返回的 id，避免 createMany + findMany 回查在并发请求下取到他人记录
      created = await prisma.$transaction(
        allItems.map((item) =>
          prisma.cognition.create({
            data: {
              type: item.type,
              content: item.content,
              source,
              tags: [],
              userId: user.id,
            },
            select: { id: true, type: true, content: true },
          })
        )
      );
      // 异步批量写入 Memory（不阻塞响应）
      Promise.all(created.map((c) => writeMemoryForCognition(c.id, c.content))).catch((e) => {
        logger.error({ err: e }, "批量 writeMemory 异步失败");
      });
    }

    return NextResponse.json(
      { created, count: created.length, success: true },
      { status: 201 }
    );
  } catch (e) {
    logger.error({ err: e }, "提取认知失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

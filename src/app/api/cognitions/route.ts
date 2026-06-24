import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ai, defaultModel, COGNITION_EXTRACT_PROMPT } from "@/lib/ai";
import { generateText } from "ai";
import { writeMemoryForCognition } from "@/lib/memory-sync";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";

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
    console.error("获取认知失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 从内容提取认知（AI）或直接写入单条认知（用户确认入库）
// 当传入 type + content 时为直接写入模式（用于看板完成弹窗的用户确认）
// 当仅传入 content 时为 AI 提取模式
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await req.json();
    const {
      content,
      source = "manual",
      type,
      ideaId = null,
    } = body as {
      content: string;
      source?: string;
      type?: "method" | "experience" | "prompt";
      ideaId?: string | null;
    };

    if (!content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
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
      writeMemoryForCognition(c.id, c.content).catch(() => {});
      return NextResponse.json({
        created: [c],
        count: 1,
        success: true,
      });
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
        console.error("AI 提取认知失败:", e);
      }
    }

    // 批量入库
    const created = [];
    for (const item of extracted.method) {
      const c = await prisma.cognition.create({
        data: { type: "method", content: item.content, source, tags: [], userId: user.id },
      });
      created.push(c);
      writeMemoryForCognition(c.id, c.content).catch(() => {});
    }
    for (const item of extracted.experience) {
      const c = await prisma.cognition.create({
        data: { type: "experience", content: item.content, source, tags: [], userId: user.id },
      });
      created.push(c);
      writeMemoryForCognition(c.id, c.content).catch(() => {});
    }
    for (const item of extracted.prompt) {
      const c = await prisma.cognition.create({
        data: { type: "prompt", content: item.content, source, tags: [], userId: user.id },
      });
      created.push(c);
      writeMemoryForCognition(c.id, c.content).catch(() => {});
    }

    return NextResponse.json({ created, count: created.length, success: true });
  } catch (e) {
    console.error("提取认知失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

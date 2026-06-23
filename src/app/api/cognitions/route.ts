import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ai, defaultModel, COGNITION_EXTRACT_PROMPT } from "@/lib/ai";
import { generateText } from "ai";
import { writeMemoryForCognition } from "@/lib/memory-sync";

// 获取认知库
export async function GET() {
  try {
    const cognitions = await prisma.cognition.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ cognitions });
  } catch (e) {
    console.error("获取认知失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 从内容提取认知（AI）
export async function POST(req: NextRequest) {
  try {
    const { content, source = "manual" } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "内容不能为空" }, { status: 400 });
    }

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
        data: { type: "method", content: item.content, source, tags: [] },
      });
      created.push(c);
      writeMemoryForCognition(c.id, c.content).catch(() => {});
    }
    for (const item of extracted.experience) {
      const c = await prisma.cognition.create({
        data: { type: "experience", content: item.content, source, tags: [] },
      });
      created.push(c);
      writeMemoryForCognition(c.id, c.content).catch(() => {});
    }
    for (const item of extracted.prompt) {
      const c = await prisma.cognition.create({
        data: { type: "prompt", content: item.content, source, tags: [] },
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

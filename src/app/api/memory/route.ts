import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  embedText,
  float32ToBuffer,
  bufferToFloat32,
  cosineSimilarity,
} from "@/lib/embedding";
import { hasAIEmbedding } from "@/lib/ai";

// 重建记忆图谱：从 Idea/Conversation/Cognition 同步到 Memory 表，生成 embedding，计算相似度连边
export async function POST(req: NextRequest) {
  try {
    const { force } = await req.json().catch(() => ({ force: false }));

    // 1. 收集所有源数据
    const [ideas, conversations, cognitions] = await Promise.all([
      prisma.idea.findMany({ select: { id: true, content: true } }),
      prisma.conversation.findMany({
        select: { id: true, title: true, rawContent: true },
      }),
      prisma.cognition.findMany({ select: { id: true, content: true } }),
    ]);

    type SourceItem = {
      id: string;
      type: "idea" | "conversation" | "cognition";
      content: string;
      ideaId?: string;
      conversationId?: string;
      cognitionId?: string;
    };

    const sources: SourceItem[] = [
      ...ideas.map((i) => ({
        id: i.id,
        type: "idea" as const,
        content: i.content,
        ideaId: i.id,
      })),
      ...conversations.map((c) => ({
        id: c.id,
        type: "conversation" as const,
        content: `${c.title}\n${c.rawContent}`.slice(0, 8000),
        conversationId: c.id,
      })),
      ...cognitions.map((c) => ({
        id: c.id,
        type: "cognition" as const,
        content: c.content,
        cognitionId: c.id,
      })),
    ];

    // 2. 为每个 source 生成或复用 embedding
    const embeddings = new Map<string, Float32Array>();
    let processed = 0;
    let skipped = 0;

    for (const src of sources) {
      // 查是否已有 Memory 记录且非 force 模式
      const existing = await prisma.memory.findFirst({
        where: {
          type: src.type,
          OR: [
            { ideaId: src.ideaId || undefined },
            { conversationId: src.conversationId || undefined },
            { cognitionId: src.cognitionId || undefined },
          ].filter((c) => Object.values(c).some((v) => v)) as any,
        },
        select: { id: true, embedding: true },
      });

      if (existing && existing.embedding && !force) {
        embeddings.set(src.id, bufferToFloat32(existing.embedding));
        skipped++;
        continue;
      }

      // 生成 embedding
      const vec = await embedText(src.content);
      embeddings.set(src.id, vec);

      // upsert Memory 记录
      const data: any = {
        type: src.type,
        content: src.content,
        embedding: float32ToBuffer(vec),
        ideaId: src.ideaId || null,
        conversationId: src.conversationId || null,
        cognitionId: src.cognitionId || null,
      };

      if (existing) {
        await prisma.memory.update({
          where: { id: existing.id },
          data: { embedding: data.embedding, content: data.content },
        });
      } else {
        await prisma.memory.create({ data });
      }
      processed++;
    }

    // 3. 计算相似度连边（>0.8 自动连边，AI 模式；TF-IDF 模式 >0.3）
    const threshold = hasAIEmbedding ? 0.8 : 0.3;
    const allMemories = await prisma.memory.findMany({
      select: { id: true, embedding: true },
    });

    let edgeCount = 0;
    for (let i = 0; i < allMemories.length; i++) {
      const connections: string[] = [];
      const vecI = bufferToFloat32(allMemories[i].embedding!);
      for (let j = 0; j < allMemories.length; j++) {
        if (i === j) continue;
        const vecJ = bufferToFloat32(allMemories[j].embedding!);
        const sim = cosineSimilarity(vecI, vecJ);
        if (sim >= threshold) {
          connections.push(allMemories[j].id);
        }
      }
      if (connections.length > 0) {
        await prisma.memory.update({
          where: { id: allMemories[i].id },
          data: { connections, strength: connections.length },
        });
        edgeCount += connections.length;
      } else {
        await prisma.memory.update({
          where: { id: allMemories[i].id },
          data: { connections: [], strength: 0 },
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: sources.length,
      processed,
      skipped,
      edges: edgeCount,
      mode: hasAIEmbedding ? "ai-embedding" : "tfidf-fallback",
      threshold,
    });
  } catch (e) {
    console.error("重建记忆图谱失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 获取记忆图谱数据（节点 + 边）
export async function GET() {
  try {
    const memories = await prisma.memory.findMany({
      orderBy: { strength: "desc" },
      take: 100,
      include: {
        idea: { select: { content: true, status: true } },
        conversation: { select: { title: true, source: true } },
        cognition: { select: { content: true, type: true } },
      },
    });

    const colorMap: Record<string, string> = {
      idea: "#f6ad55",
      conversation: "#63b3ed",
      cognition: "#a78bfa",
    };

    const nodes = memories.map((m) => {
      let label = m.content.slice(0, 20);
      if (m.idea) label = m.idea.content.slice(0, 20);
      else if (m.conversation) label = m.conversation.title.slice(0, 20);
      else if (m.cognition) label = m.cognition.content.slice(0, 20);

      return {
        id: m.id,
        label,
        type: m.type,
        color: colorMap[m.type] || "#666",
        strength: m.strength,
        connections: m.connections as string[],
        fullContent: m.content.slice(0, 200),
        createdAt: m.createdAt.toISOString(),
      };
    });

    // 构建边（去重）
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edgeSet = new Set<string>();
    const edges: { from: string; to: string }[] = [];
    for (const node of nodes) {
      for (const targetId of node.connections) {
        if (!nodeIds.has(targetId)) continue;
        const key = [node.id, targetId].sort().join("|");
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);
        edges.push({ from: node.id, to: targetId });
      }
    }

    return NextResponse.json({
      nodes,
      edges,
      stats: {
        total: memories.length,
        edges: edges.length,
        isolated: nodes.filter((n) => n.connections.length === 0).length,
        mode: hasAIEmbedding ? "ai-embedding" : "tfidf-fallback",
      },
    });
  } catch (e) {
    console.error("获取记忆图谱失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

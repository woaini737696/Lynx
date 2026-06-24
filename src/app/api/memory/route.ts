import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  embedText,
  float32ToBuffer,
  bufferToFloat32,
  cosineSimilarity,
} from "@/lib/embedding";
import { hasAIEmbedding } from "@/lib/ai";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";

// 重建记忆图谱：从 Idea/Conversation/Cognition 同步到 Memory 表，生成 embedding，计算相似度连边
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { force } = await req.json().catch(() => ({ force: false }));

    // 非 admin 只处理自己的数据，admin 处理所有
    const userFilter = buildUserFilter(user);

    // 1. 收集所有源数据
    const [ideas, conversations, cognitions] = await Promise.all([
      prisma.idea.findMany({ where: userFilter, select: { id: true, content: true, userId: true } }),
      prisma.conversation.findMany({
        where: userFilter,
        select: { id: true, title: true, rawContent: true, userId: true },
      }),
      prisma.cognition.findMany({ where: userFilter, select: { id: true, content: true, userId: true } }),
    ]);

    type SourceItem = {
      id: string;
      type: "idea" | "conversation" | "cognition";
      content: string;
      ideaId?: string;
      conversationId?: string;
      cognitionId?: string;
      userId?: string | null;
    };

    const sources: SourceItem[] = [
      ...ideas.map((i) => ({
        id: i.id,
        type: "idea" as const,
        content: i.content,
        ideaId: i.id,
        userId: i.userId,
      })),
      ...conversations.map((c) => ({
        id: c.id,
        type: "conversation" as const,
        content: `${c.title}\n${c.rawContent}`.slice(0, 8000),
        conversationId: c.id,
        userId: c.userId,
      })),
      ...cognitions.map((c) => ({
        id: c.id,
        type: "cognition" as const,
        content: c.content,
        cognitionId: c.id,
        userId: c.userId,
      })),
    ];

    // 2. 为每个 source 生成或复用 embedding
    const embeddings = new Map<string, Float32Array>();
    let processed = 0;
    let skipped = 0;

    // 预取所有已存在的 Memory 记录，避免在循环中逐条 findFirst（N+1 → 1）
    const existingMemories = await prisma.memory.findMany({
      where: {
        ...userFilter,
        type: { in: ["idea", "conversation", "cognition"] },
      },
      select: { id: true, type: true, ideaId: true, conversationId: true, cognitionId: true, embedding: true },
    });
    // 构建查找表：按 type + sourceId 索引
    const existingMap = new Map<string, (typeof existingMemories)[number]>();
    for (const m of existingMemories) {
      const key = `${m.type}:${m.ideaId || m.conversationId || m.cognitionId || ""}`;
      existingMap.set(key, m);
    }

    // 收集需要执行的 create/update 操作，最后批量提交
    const pendingUpdates: { id: string; embedding: Buffer; content: string }[] = [];
    const pendingCreates: any[] = [];

    for (const src of sources) {
      // 从预取的 map 中查找（避免 N+1 查询）
      const lookupKey = `${src.type}:${src.ideaId || src.conversationId || src.cognitionId || ""}`;
      const existing = existingMap.get(lookupKey);

      if (existing && existing.embedding && !force) {
        embeddings.set(src.id, bufferToFloat32(existing.embedding));
        skipped++;
        continue;
      }

      // 生成 embedding（API 调用，必须顺序执行）
      const vec = await embedText(src.content);
      embeddings.set(src.id, vec);

      const embeddingBuffer = float32ToBuffer(vec);
      const data: any = {
        type: src.type,
        content: src.content,
        embedding: embeddingBuffer,
        ideaId: src.ideaId || null,
        conversationId: src.conversationId || null,
        cognitionId: src.cognitionId || null,
        userId: src.userId || user.id,
      };

      if (existing) {
        pendingUpdates.push({ id: existing.id, embedding: embeddingBuffer, content: src.content });
      } else {
        pendingCreates.push(data);
      }
      processed++;
    }

    // 批量提交 create/update（使用 $transaction，避免 N 次 DB 往返）
    if (pendingCreates.length > 0 || pendingUpdates.length > 0) {
      await prisma.$transaction([
        ...pendingCreates.map((data) => prisma.memory.create({ data })),
        ...pendingUpdates.map((u) =>
          prisma.memory.update({
            where: { id: u.id },
            data: { embedding: u.embedding, content: u.content },
          })
        ),
      ]);
    }

    // 3. 计算相似度连边（>0.8 自动连边，AI 模式；TF-IDF 模式 >0.3）
    const threshold = hasAIEmbedding ? 0.8 : 0.3;
    const allMemories = await prisma.memory.findMany({
      where: userFilter,
      select: { id: true, embedding: true },
    });

    // 预解码所有 embedding，避免在 O(n²) 循环中重复解码
    const decoded = allMemories.map((m) => ({
      id: m.id,
      vec: m.embedding ? bufferToFloat32(m.embedding) : null,
    }));

    // 先在内存中计算所有 connections（O(n²) 但纯计算，无 DB IO）
    const updates: { id: string; connections: string[]; strength: number }[] = [];
    let edgeCount = 0;
    for (let i = 0; i < decoded.length; i++) {
      const connections: string[] = [];
      const vecI = decoded[i].vec;
      if (!vecI) {
        // 无 embedding 的节点：清空连边
        updates.push({ id: decoded[i].id, connections: [], strength: 0 });
        continue;
      }
      for (let j = 0; j < decoded.length; j++) {
        if (i === j) continue;
        const vecJ = decoded[j].vec;
        if (!vecJ) continue;
        const sim = cosineSimilarity(vecI, vecJ);
        if (sim >= threshold) {
          connections.push(decoded[j].id);
        }
      }
      edgeCount += connections.length;
      updates.push({
        id: decoded[i].id,
        connections,
        strength: connections.length,
      });
    }

    // 批量 update：使用 $transaction 一次性提交所有连边更新，避免 N 次 DB 往返
    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.memory.update({
            where: { id: u.id },
            data: { connections: u.connections, strength: u.strength },
          })
        )
      );
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
    const { user, error } = await requireAuth();
    if (error) return error;

    const memories = await prisma.memory.findMany({
      where: buildUserFilter(user),
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

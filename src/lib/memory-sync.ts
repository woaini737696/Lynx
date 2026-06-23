// Memory 写入辅助：在 idea/conversation/cognition 创建时自动生成 embedding 并写入 Memory 表
import { prisma } from "./db";
import { embedText, float32ToBuffer, bufferToFloat32, cosineSimilarity } from "./embedding";
import { hasAIEmbedding } from "./ai";

const threshold = hasAIEmbedding ? 0.8 : 0.3;

// 增量更新新节点的连边：与所有已有 Memory 计算相似度
async function updateConnectionsFor(newMemoryId: string, newVec: Float32Array) {
  try {
    const all = await prisma.memory.findMany({
      select: { id: true, embedding: true, connections: true },
    });

    // 1. 找出与 newMemory 相似的节点
    const newConnections: string[] = [];
    for (const m of all) {
      if (m.id === newMemoryId || !m.embedding) continue;
      const vec = bufferToFloat32(m.embedding);
      const sim = cosineSimilarity(newVec, vec);
      if (sim >= threshold) {
        newConnections.push(m.id);
      }
    }

    // 2. 更新新节点自身的 connections
    await prisma.memory.update({
      where: { id: newMemoryId },
      data: {
        connections: newConnections,
        strength: newConnections.length,
      },
    });

    // 3. 更新其他节点的 connections（把新节点加入它们的连接列表）
    for (const targetId of newConnections) {
      const target = all.find((m) => m.id === targetId);
      if (!target) continue;
      const targetConnections = (target.connections as string[]) || [];
      if (!targetConnections.includes(newMemoryId)) {
        await prisma.memory.update({
          where: { id: targetId },
          data: {
            connections: [...targetConnections, newMemoryId],
            strength: targetConnections.length + 1,
          },
        });
      }
    }
  } catch (e) {
    console.error("更新记忆连边失败:", e);
  }
}

export async function writeMemoryForIdea(ideaId: string, content: string) {
  try {
    const vec = await embedText(content);
    const memory = await prisma.memory.create({
      data: {
        type: "idea",
        ideaId,
        content,
        embedding: float32ToBuffer(vec),
      },
    });
    await updateConnectionsFor(memory.id, vec);
  } catch (e) {
    console.error("写入 idea memory 失败:", e);
  }
}

export async function writeMemoryForConversation(
  conversationId: string,
  title: string,
  rawContent: string
) {
  try {
    const content = `${title}\n${rawContent}`.slice(0, 8000);
    const vec = await embedText(content);
    const memory = await prisma.memory.create({
      data: {
        type: "conversation",
        conversationId,
        content,
        embedding: float32ToBuffer(vec),
      },
    });
    await updateConnectionsFor(memory.id, vec);
  } catch (e) {
    console.error("写入 conversation memory 失败:", e);
  }
}

export async function writeMemoryForCognition(
  cognitionId: string,
  content: string
) {
  try {
    const vec = await embedText(content);
    const memory = await prisma.memory.create({
      data: {
        type: "cognition",
        cognitionId,
        content,
        embedding: float32ToBuffer(vec),
      },
    });
    await updateConnectionsFor(memory.id, vec);
  } catch (e) {
    console.error("写入 cognition memory 失败:", e);
  }
}

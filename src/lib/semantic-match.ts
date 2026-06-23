// 语义匹配工具：基于 embedding 的余弦相似度匹配
// 用于灵感复活条件检查，替代关键词匹配

import { embedMany } from "ai";
import { embeddingProvider, embeddingModel, hasAIEmbedding } from "@/lib/ai";

// 生成一批文本的 embedding
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (!hasAIEmbedding) return [];
  if (texts.length === 0) return [];
  try {
    const { embeddings } = await embedMany({
      model: embeddingProvider.embedding(embeddingModel),
      values: texts.map((t) => t.slice(0, 8000)),
    });
    return embeddings;
  } catch (e) {
    console.error("语义匹配 embedding 生成失败:", e);
    return [];
  }
}

// 计算两个向量的余弦相似度
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// 批量计算条件与候选之间的语义匹配
// 返回所有相似度 >= threshold 的配对，按分数降序排列
export async function findSemanticMatches(
  conditions: { id: string; text: string }[],
  candidates: { id: string; text: string }[],
  threshold = 0.75
): Promise<{ conditionId: string; candidateId: string; score: number }[]> {
  if (conditions.length === 0 || candidates.length === 0) return [];

  // 一次性生成所有 embedding（条件 + 候选）
  const allTexts = [
    ...conditions.map((c) => c.text),
    ...candidates.map((c) => c.text),
  ];
  const embeddings = await generateEmbeddings(allTexts);
  if (embeddings.length === 0) return [];

  const condEmbeddings = embeddings.slice(0, conditions.length);
  const candEmbeddings = embeddings.slice(conditions.length);

  const matches: {
    conditionId: string;
    candidateId: string;
    score: number;
  }[] = [];
  for (let i = 0; i < conditions.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      const score = cosineSimilarity(condEmbeddings[i], candEmbeddings[j]);
      if (score >= threshold) {
        matches.push({
          conditionId: conditions[i].id,
          candidateId: candidates[j].id,
          score,
        });
      }
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}

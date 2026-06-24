// 语义匹配工具：基于 embedding 的余弦相似度匹配
// 用于灵感复活条件检查，替代关键词匹配

import { embedMany } from "ai";
import { embeddingProvider, embeddingModel, hasAIEmbedding } from "@/lib/ai";
import { embedText, cosineSimilarity } from "@/lib/embedding";

// 生成一批文本的 embedding
// 有 AI key 时使用 embedMany 批量生成；无 AI key 时降级为 TF-IDF（通过 embedText）
export async function generateEmbeddings(
  texts: string[]
): Promise<Float32Array[]> {
  if (texts.length === 0) return [];

  // TF-IDF 降级：使用 embedding.ts 的 embedText（内部走 tfidfVector）
  if (!hasAIEmbedding) {
    const results: Float32Array[] = [];
    for (const t of texts) {
      results.push(await embedText(t));
    }
    return results;
  }

  // AI 模式：批量生成
  try {
    const { embeddings } = await embedMany({
      model: embeddingProvider.embedding(embeddingModel),
      values: texts.map((t) => t.slice(0, 8000)),
    });
    return embeddings.map((e) => Float32Array.from(e));
  } catch (e) {
    console.error("语义匹配 embedding 生成失败，降级为 TF-IDF:", e);
    // AI 失败时降级为 TF-IDF
    const results: Float32Array[] = [];
    for (const t of texts) {
      results.push(await embedText(t));
    }
    return results;
  }
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

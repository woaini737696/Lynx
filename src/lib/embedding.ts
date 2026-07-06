// Embedding 生成 + 相似度计算
// 有 AI key 时使用 Vercel AI SDK embed；无 key 时降级为 TF-IDF 向量
// 两种模式产出相同结构的 Float32Array，下游统一处理
// 支持 EmbeddingCache 数据库缓存，避免重复计算相同文本的向量

import { createHash } from "crypto";
import { embed } from "ai";
import {
  embeddingProvider,
  embeddingModel,
  hasAIEmbedding,
} from "./ai";
import { prisma } from "./db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("embedding");

// ============ 中文分词（简易版）============
// 按字符 bigram + 英文单词拆分，足够做关键词相似度
export function tokenize(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  const cleaned = text.toLowerCase().replace(/\s+/g, " ").trim();

  // 英文单词
  const enWords = cleaned.match(/[a-z]+/g) || [];
  tokens.push(...enWords.filter((w) => w.length > 1));

  // 中文 bigram（按非中文字符分段后取相邻两字）
  const cnSegments = cleaned.match(/[\u4e00-\u9fa5]+/g) || [];
  for (const seg of cnSegments) {
    if (seg.length === 1) {
      tokens.push(seg);
    } else {
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.push(seg.substring(i, i + 2));
      }
    }
  }

  return tokens;
}

// ============ TF-IDF 向量（降级方案）============
// 维度固定为 256，用 hash 映射 token 到维度，避免动态词表
const TFIDF_DIM = 256;

export function tfidfVector(text: string): Float32Array {
  const vec = new Float32Array(TFIDF_DIM);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  const freq: Record<string, number> = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;

  for (const [token, count] of Object.entries(freq)) {
    // 简单 hash 到 0..255
    let h = 0;
    for (let i = 0; i < token.length; i++) {
      h = (h * 31 + token.charCodeAt(i)) >>> 0;
    }
    const idx = h % TFIDF_DIM;
    // 用 log 压频次，模拟 IDF 效果
    vec[idx] += 1 + Math.log(count);
  }

  // L2 归一化
  let norm = 0;
  for (let i = 0; i < TFIDF_DIM; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < TFIDF_DIM; i++) vec[i] /= norm;
  }

  return vec;
}

// ============ 统一 embedText 接口（带数据库缓存）============
// 有 AI key：调用 Vercel AI SDK embed（返回 1536 维或更多）
// 无 AI key：降级为 TF-IDF（256 维）
// 返回 Float32Array，存储为 Buffer
// 优先从 EmbeddingCache 表读取（按文本 SHA-256 哈希），避免重复计算

/** 计算文本的 SHA-256 哈希（用于缓存键） */
function textHash(text: string): string {
  return createHash("sha256").update(text, "utf-8").digest("hex");
}

/** 当前 embedding provider 名称（用于缓存隔离） */
function currentProvider(): string {
  return hasAIEmbedding ? "ai" : "tfidf";
}

export async function embedText(text: string): Promise<Float32Array> {
  const truncated = text.slice(0, 8000); // 防止超长
  const hash = textHash(truncated);
  const provider = currentProvider();

  // 1. 查缓存
  try {
    const cached = await prisma.embeddingCache.findUnique({
      where: { textHash: hash },
    });
    if (cached && cached.provider === provider && cached.dim > 0) {
      return bufferToFloat32(cached.embedding);
    }
  } catch {
    // DB 查询失败（如 prisma 未初始化），降级为直接计算
  }

  // 2. 计算向量
  let vec: Float32Array;
  if (hasAIEmbedding) {
    try {
      const { embedding } = await embed({
        model: embeddingProvider.embedding(embeddingModel),
        value: truncated,
      });
      vec = Float32Array.from(embedding);
    } catch (e) {
      logger.error({ err: e }, "AI embedding 失败，降级为 TF-IDF");
      vec = tfidfVector(truncated);
    }
  } else {
    vec = tfidfVector(truncated);
  }

  // 3. 写入缓存（fire-and-forget，不阻塞返回——性能优化）
  prisma.embeddingCache.upsert({
    where: { textHash: hash },
    create: {
      textHash: hash,
      embedding: float32ToBuffer(vec),
      provider: currentProvider(),
      dim: vec.length,
    },
    update: {
      embedding: float32ToBuffer(vec),
      provider: currentProvider(),
      dim: vec.length,
    },
  }).catch(() => {
    // 缓存写入失败不影响主流程
  });

  return vec;
}

// ============ 余弦相似度 ============
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  // 维度不同时（AI vs TF-IDF 混用），取较小维度
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============ Buffer <-> Float32Array 转换（存入 MySQL LongBlob）============
export function float32ToBuffer(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

export function bufferToFloat32(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

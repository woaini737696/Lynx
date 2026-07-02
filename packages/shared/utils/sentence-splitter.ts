// 句子分割器 - 纯 TypeScript
// 从 src/app/ai/assistant/utils.tsx 的 splitSentences 抽离
// 用于 TTS 流式合成：将长文本分割为句子，逐句合成播放

/**
 * 将文本分割为句子
 * 支持中文标点（。！？）和英文标点（.!?）
 * 保留标点在句子末尾
 *
 * @param text 要分割的文本
 * @param minLength 最小句子长度（短于此不单独成句，与下句合并），默认 5
 * @returns 句子数组
 */
export function splitSentences(text: string, minLength = 5): string[] {
  if (!text) return [];

  // 按中英文句号/问号/感叹号分割，保留标点
  const sentences = text
    .split(/(?<=[。！？!?])/g)
    .map((s) => s.trim())
    .filter(Boolean);

  // 合并过短的句子
  const result: string[] = [];
  let buffer = "";
  for (const s of sentences) {
    buffer += s;
    if (buffer.length >= minLength) {
      result.push(buffer);
      buffer = "";
    }
  }
  if (buffer) result.push(buffer);

  return result;
}

/**
 * 按固定长度分割文本（用于没有标点的长文本）
 */
export function splitByLength(text: string, maxLen = 80): string[] {
  if (!text) return [];
  const result: string[] = [];
  for (let i = 0; i < text.length; i += maxLen) {
    result.push(text.slice(i, i + maxLen));
  }
  return result;
}

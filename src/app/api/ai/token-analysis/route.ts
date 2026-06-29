import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";

// POST /api/ai/token-analysis
// Request:  { text: string, model?: string }
// Response: {
//   tokenCount, charCount, charCountNoSpaces, wordCount, sentenceCount, lineCount,
//   tokens: [{ text, type, start, end }],
//   stats: { cjk, latin, digit, punctuation, space, other },
//   model, estimatedCost: { input, currency }
// }
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "请求体格式错误，需为 JSON" }, { status: 400 });
    }

    const { text, model } = body as { text?: unknown; model?: unknown };
    if (typeof text !== "string") {
      return NextResponse.json({ error: "text 必须为字符串" }, { status: 400 });
    }

    const result = analyzeTokens(text, typeof model === "string" ? model : "deepseek-chat");
    return NextResponse.json(result);
  } catch (e) {
    const msg = (e as Error).message || "服务器错误";
    const status = msg.includes("未登录") || msg.includes("未授权") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// ============ Token 估算核心算法 ============
// 基于 GPT BPE 分词规则的简化实现，适用于 DeepSeek/GPT 系列模型。
// 精度误差通常 < 10%，足够用于预估和可视化。

interface TokenPiece {
  text: string;
  type: "cjk" | "latin" | "digit" | "punctuation" | "space" | "other";
  start: number;
  end: number;
  /** 该片段估算消耗的 token 数 */
  tokens: number;
}

function analyzeTokens(text: string, model: string) {
  const pieces: TokenPiece[] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    const code = ch.charCodeAt(0);

    // 空白符（空格、制表符）
    if (ch === " " || ch === "\t" || ch === "\u00A0") {
      let j = i + 1;
      while (j < len && (text[j] === " " || text[j] === "\t" || text[j] === "\u00A0")) j++;
      pieces.push({ text: text.slice(i, j), type: "space", start: i, end: j, tokens: 0 });
      i = j;
      continue;
    }

    // 换行符
    if (ch === "\n" || ch === "\r") {
      let j = i + 1;
      while (j < len && (text[j] === "\n" || text[j] === "\r")) j++;
      pieces.push({ text: text.slice(i, j), type: "space", start: i, end: j, tokens: 0 });
      i = j;
      continue;
    }

    // CJK 统一表意文字 + 全角字符
    if (isCJK(code)) {
      let j = i + 1;
      while (j < len && isCJK(text.charCodeAt(j))) j++;
      const segment = text.slice(i, j);
      // CJK 字符：每个约 1.5 token（GPT-4 BPE 中通常 1-2）
      const tokenEst = Math.max(1, Math.round(segment.length * 1.5));
      pieces.push({ text: segment, type: "cjk", start: i, end: j, tokens: tokenEst });
      i = j;
      continue;
    }

    // 拉丁字母（英文单词）
    if (isLatin(code)) {
      let j = i + 1;
      while (j < len && isLatin(text.charCodeAt(j))) j++;
      const word = text.slice(i, j);
      // 英文：短词(≤4)约 1 token，长词约 ceil(len/4)
      const tokenEst = word.length <= 4 ? 1 : Math.ceil(word.length / 4);
      pieces.push({ text: word, type: "latin", start: i, end: j, tokens: tokenEst });
      i = j;
      continue;
    }

    // 数字
    if (code >= 48 && code <= 57) {
      let j = i + 1;
      while (j < len && text.charCodeAt(j) >= 48 && text.charCodeAt(j) <= 57) j++;
      const num = text.slice(i, j);
      // 数字：每 3 位约 1 token
      const tokenEst = Math.max(1, Math.ceil(num.length / 3));
      pieces.push({ text: num, type: "digit", start: i, end: j, tokens: tokenEst });
      i = j;
      continue;
    }

    // 标点符号
    if (isPunctuation(code)) {
      let j = i + 1;
      while (j < len && isPunctuation(text.charCodeAt(j))) j++;
      const punct = text.slice(i, j);
      pieces.push({ text: punct, type: "punctuation", start: i, end: j, tokens: punct.length });
      i = j;
      continue;
    }

    // 其他字符（emoji 等）
    pieces.push({ text: ch, type: "other", start: i, end: i + 1, tokens: 1 });
    i++;
  }

  // 统计
  const tokenCount = pieces.reduce((s, p) => s + p.tokens, 0);
  const charCount = text.length;
  const charCountNoSpaces = text.replace(/\s/g, "").length;
  const wordCount = pieces.filter((p) => p.type === "latin" || p.type === "cjk").length;
  const sentenceCount = (text.match(/[。！？.!?;；\n]/g) || []).length || (text.trim() ? 1 : 0);
  const lineCount = text.split("\n").length;

  const stats = {
    cjk: pieces.filter((p) => p.type === "cjk").reduce((s, p) => s + p.text.length, 0),
    latin: pieces.filter((p) => p.type === "latin").reduce((s, p) => s + p.text.length, 0),
    digit: pieces.filter((p) => p.type === "digit").reduce((s, p) => s + p.text.length, 0),
    punctuation: pieces.filter((p) => p.type === "punctuation").reduce((s, p) => s + p.text.length, 0),
    space: pieces.filter((p) => p.type === "space").reduce((s, p) => s + p.text.length, 0),
    other: pieces.filter((p) => p.type === "other").reduce((s, p) => s + p.text.length, 0),
  };

  // 预估费用（基于 DeepSeek 定价，输入 ¥0.001/1K tokens）
  const pricePerK = getModelPrice(model);
  const estimatedCost = {
    input: Math.round((tokenCount / 1000) * pricePerK * 10000) / 10000,
    currency: "CNY",
  };

  return {
    tokenCount,
    charCount,
    charCountNoSpaces,
    wordCount,
    sentenceCount,
    lineCount,
    tokens: pieces.map((p) => ({ text: p.text, type: p.type, start: p.start, end: p.end, tokens: p.tokens })),
    stats,
    model,
    estimatedCost,
  };
}

function isCJK(code: number): boolean {
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||  // CJK 统一表意文字
    (code >= 0x3400 && code <= 0x4dbf) ||  // CJK 扩展 A
    (code >= 0x3000 && code <= 0x303f) ||  // CJK 符号和标点
    (code >= 0xff00 && code <= 0xffef) ||  // 全角字符
    (code >= 0x3040 && code <= 0x309f) ||  // 平假名
    (code >= 0x30a0 && code <= 0x30ff)     // 片假名
  );
}

function isLatin(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||   // A-Z
    (code >= 97 && code <= 122) ||  // a-z
    code === 95 ||                   // _
    (code >= 192 && code <= 383)    // 拉丁扩展
  );
}

function isPunctuation(code: number): boolean {
  return (
    (code >= 33 && code <= 47) ||   // ! " # $ % & ' ( ) * + , - . /
    (code >= 58 && code <= 64) ||   // : ; < = > ? @
    (code >= 91 && code <= 96) ||   // [ \ ] ^ _ `
    (code >= 123 && code <= 126) || // { | } ~
    code === 0x2018 || code === 0x2019 ||  // ' '
    code === 0x201c || code === 0x201d ||  // " "
    code === 0x3001 || code === 0x3002 ||  // 、 。
    code === 0xff01 || code === 0xff1f     // ！ ？
  );
}

function getModelPrice(model: string): number {
  // 返回每 1K token 的输入价格（CNY）
  const m = model.toLowerCase();
  if (m.includes("deepseek")) return 0.001;
  if (m.includes("gpt-4")) return 0.03;
  if (m.includes("gpt-3.5") || m.includes("gpt-4o-mini")) return 0.0005;
  if (m.includes("mimo")) return 0.002;
  return 0.001; // 默认
}

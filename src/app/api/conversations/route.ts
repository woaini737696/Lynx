import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ai, defaultModel, EXTRACT_PROMPT } from "@/lib/ai";
import { generateText } from "ai";
import { writeMemoryForConversation } from "@/lib/memory-sync";
import { parsePdf } from "@/lib/file-parser";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("conversations-api");

// 不进行 AI 提取的文件类型（无有效文本内容）
const NO_EXTRACT_SOURCES = new Set(["file-image"]);

// AI 视觉降级提示词（用于 PDF 解析失败时，让 AI 推断内容）
const PDF_FALLBACK_PROMPT = `你是一个文档内容推断助手。用户上传了一个 PDF 文件但本地解析失败（可能是扫描件或格式异常）。
请根据文件名和提供的片段信息，尽可能推断文档的主题和可能的内容结构。

文件名：{{filename}}
内容片段：
{{snippet}}

请输出：
1. 推断的文档主题
2. 可能包含的关键信息点（列表）
3. 建议的后续处理方式

如果信息不足以推断，请直接说明。`;

// 将 base64 字符串解码为 Buffer
function decodeBase64ToBuffer(b64: string): Buffer {
  // 移除可能存在的 data URL 前缀
  const cleaned = b64.replace(/^data:.*;base64,/, "");
  return Buffer.from(cleaned, "base64");
}

// AI 视觉降级：调用 AI 模型推断 PDF 内容
async function aiFallbackExtractPdf(filename: string, snippet: string): Promise<string> {
  if (!process.env.AI_API_KEY) {
    return `[PDF 解析失败] ${filename}\n本地解析失败且未配置 AI_API_KEY，无法进行视觉降级。\n片段：${snippet.slice(0, 200)}`;
  }
  try {
    const prompt = PDF_FALLBACK_PROMPT.replace("{{filename}}", filename).replace(
      "{{snippet}}",
      snippet.slice(0, 1000)
    );
    const result = await generateText({
      model: ai(defaultModel),
      prompt,
    });
    return `[AI 视觉降级推断] ${filename}\n${result.text}`;
  } catch (e) {
    logger.error({ err: e }, "AI 视觉降级失败");
    return `[PDF 解析失败] ${filename}\n本地与 AI 降级均失败。\n片段：${snippet.slice(0, 200)}`;
  }
}

// 捕获对话资产 + AI 提取
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await req.json();
    const { source, title, rawContent, useAI } = body;
    // PDF 专用字段：base64 编码的文件数据
    const fileData = body.fileData as string | undefined;
    const filename = body.filename as string | undefined;

    if (!rawContent && !fileData) {
      return NextResponse.json(
        { error: "source 和 rawContent（或 fileData）不能同时为空" },
        { status: 400 }
      );
    }
    if (!source) {
      return NextResponse.json({ error: "source 不能为空" }, { status: 400 });
    }

    // PDF 处理：本地优先 + AI 视觉降级
    let finalContent = rawContent || "";
    let pdfParseStatus: "local" | "ai-fallback" | "failed" | "skipped" | undefined;

    if (source === "file-pdf" && fileData) {
      try {
        const buffer = decodeBase64ToBuffer(fileData);
        finalContent = await parsePdf(buffer);
        pdfParseStatus = "local";
      } catch (e) {
        logger.error({ err: e }, "本地 PDF 解析失败，尝试 AI 降级");
        const snippet = (rawContent || "").slice(0, 1000);
        finalContent = await aiFallbackExtractPdf(filename || "unknown.pdf", snippet);
        pdfParseStatus = finalContent.startsWith("[AI 视觉降级推断]") ? "ai-fallback" : "failed";
      }
    } else if (source === "file-pdf" && !fileData) {
      // 无 fileData 时仅记录文件名（保持向后兼容）
      pdfParseStatus = "skipped";
    }

    let conclusions: string[] = [];
    let todos: string[] = [];
    let prompts: string[] = [];
    let data: string[] = [];

    // AI 提取（如果启用且有 API Key，且该类型支持文本提取）
    const canExtract = !NO_EXTRACT_SOURCES.has(source);
    if (useAI && canExtract && process.env.AI_API_KEY) {
      try {
        const result = await generateText({
          model: ai(defaultModel),
          system: EXTRACT_PROMPT,
          prompt: finalContent,
        });
        const extracted = JSON.parse(result.text);
        conclusions = extracted.conclusions || [];
        todos = extracted.todos || [];
        prompts = extracted.prompts || [];
        data = extracted.data || [];
      } catch (e) {
        logger.error({ err: e }, "AI 提取失败，使用空结果");
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        source,
        title: title || finalContent.slice(0, 50),
        rawContent: finalContent,
        conclusions,
        todos,
        prompts,
        data,
        userId: user.id,
      },
    });

    // 异步写入 Memory
    writeMemoryForConversation(
      conversation.id,
      conversation.title,
      conversation.rawContent
    ).catch(() => {});

    return NextResponse.json({
      conversation,
      success: true,
      pdfParseStatus,
    });
  } catch (e) {
    logger.error({ err: e }, "捕获对话失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 获取对话资产列表
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const conversations = await prisma.conversation.findMany({
      where: buildUserFilter(user),
      orderBy: { capturedAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ conversations });
  } catch (e) {
    logger.error({ err: e }, "获取对话失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

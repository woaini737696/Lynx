import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasAIEmbedding } from "@/lib/ai";
import { requireAuth } from "@/lib/auth-utils";

// 获取系统配置状态（不暴露 key 本身，只返回是否已配置）
// 设置页面需要实时数据，使用 no-store 禁用缓存
export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    // 检测数据库连接
    let dbStatus: "connected" | "error" = "error";
    let dbCounts: Record<string, number> = {};
    try {
      const [ideas, tasks, conversations, cognitions, memories] =
        await Promise.all([
          prisma.idea.count(),
          prisma.task.count(),
          prisma.conversation.count(),
          prisma.cognition.count(),
          prisma.memory.count(),
        ]);
      dbStatus = "connected";
      dbCounts = { ideas, tasks, conversations, cognitions, memories };
    } catch (e) {
      dbStatus = "error";
    }

    // AI 配置状态（不暴露 key）
    // 兼容多 Provider：AI_* / OPENAI_* / DEEPSEEK_* / MIMO_*
    const chatApiKey =
      process.env.AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.MIMO_API_KEY ||
      "";
    const chatModel =
      process.env.AI_MODEL ||
      process.env.DEEPSEEK_MODEL ||
      process.env.MIMO_MODEL ||
      "未设置（默认 gpt-4o-mini）";
    const chatBaseURLConfigured =
      process.env.AI_BASE_URL ||
      process.env.DEEPSEEK_BASE_URL ||
      process.env.MIMO_BASE_URL;
    const aiConfig = {
      chatProvider: Boolean(chatApiKey),
      chatModel,
      chatBaseURL: chatBaseURLConfigured
        ? "已设置"
        : "未设置（默认 https://api.openai.com/v1）",
      embeddingEnabled: hasAIEmbedding,
      embeddingModel: process.env.EMBEDDING_MODEL || "未设置（默认 text-embedding-3-small）",
      embeddingMode: hasAIEmbedding ? "AI 向量" : "TF-IDF 降级",
    };

    return NextResponse.json(
      {
        db: {
          status: dbStatus,
          url: "mysql://root@localhost:3306/lynnhub",
          counts: dbCounts,
        },
        ai: aiConfig,
        envFilePath: ".env",
        envExamplePath: ".env.example",
      },
      {
        headers: {
          // 设置页面需要实时数据（数据库连接状态、配置变更等），禁用缓存
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e) {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

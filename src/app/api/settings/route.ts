import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasAIEmbedding } from "@/lib/ai";
import { requireAuth } from "@/lib/auth-utils";

// 获取系统配置状态（不暴露 key 本身，只返回是否已配置）
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
    const aiConfig = {
      chatProvider: Boolean(
        process.env.AI_API_KEY || process.env.OPENAI_API_KEY
      ),
      chatModel: process.env.AI_MODEL || "未设置（默认 gpt-4o-mini）",
      chatBaseURL: process.env.AI_BASE_URL
        ? "已设置"
        : "未设置（默认 https://api.openai.com/v1）",
      embeddingEnabled: hasAIEmbedding,
      embeddingModel: process.env.AI_EMBEDDING_MODEL || "未设置（默认 text-embedding-3-small）",
      embeddingMode: hasAIEmbedding ? "AI 向量" : "TF-IDF 降级",
    };

    return NextResponse.json({
      db: {
        status: dbStatus,
        url: "mysql://root@localhost:3306/lynnhub",
        counts: dbCounts,
      },
      ai: aiConfig,
      envFilePath: ".env",
      envExamplePath: ".env.example",
    });
  } catch (e) {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  embedText,
  bufferToFloat32,
  cosineSimilarity,
} from "@/lib/embedding";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";

// 使用 request.url 读取查询参数，必须动态渲染
export const dynamic = "force-dynamic";

// 语义搜索：query 向量化后与所有 Memory embedding 比相似度，返回 top N
// 支持分页：limit（每页数量，默认 10，上限 100）+ offset（偏移量，默认 0）
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 10), 1), 100);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    if (!q.trim()) {
      return NextResponse.json({ results: [], query: q, limit, offset, total: 0 });
    }

    // 生成查询向量
    const queryVec = await embedText(q);

    // 拉取有 embedding 的 Memory（按用户过滤），按 createdAt 降序分页查询
    // 先查总数（用于分页元信息）
    const total = await prisma.memory.count({
      where: { embedding: { not: null }, ...buildUserFilter(user) },
    });

    // 分页拉取候选集（按 createdAt 降序）
    const memories = await prisma.memory.findMany({
      where: { embedding: { not: null }, ...buildUserFilter(user) },
      include: {
        idea: { select: { content: true, status: true } },
        conversation: { select: { title: true, source: true } },
        cognition: { select: { content: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });

    // 计算相似度并按相似度降序排列
    const scored = memories
      .map((m) => {
        const vec = bufferToFloat32(m.embedding!);
        const score = cosineSimilarity(queryVec, vec);
        let label = m.content.slice(0, 60);
        let source = m.type;
        if (m.idea) {
          label = m.idea.content;
          source = `idea (${m.idea.status})`;
        } else if (m.conversation) {
          label = m.conversation.title;
          source = `conversation (${m.conversation.source})`;
        } else if (m.cognition) {
          label = m.cognition.content;
          source = `cognition (${m.cognition.type})`;
        }
        return { id: m.id, label, source, score, type: m.type };
      })
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({
      results: scored,
      query: q,
      limit,
      offset,
      total,
    });
  } catch (e) {
    console.error("语义搜索失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

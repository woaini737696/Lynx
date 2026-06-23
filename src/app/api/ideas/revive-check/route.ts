import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ai, defaultModel, hasAIEmbedding } from "@/lib/ai";
import { generateText } from "ai";
import { findSemanticMatches } from "@/lib/semantic-match";

// AI 巡检复活条件检查
// 读取所有墓地灵感的 reviveCondition，与最近 7 天的新灵感内容比对
// 优先级：embedding 语义匹配 > AI 文本判断 > 关键词匹配

const REVIVE_CHECK_PROMPT = `你是一个灵感复活判断助手。用户之前放弃了一个灵感并设置了复活条件。
现在有新的灵感内容产生，请判断新灵感是否命中了复活条件。

被放弃的灵感：{{originalContent}}
放弃原因：{{reason}}
复活条件：{{reviveCondition}}

最近的新灵感内容：
{{recentIdeas}}

请判断是否有新灵感命中了复活条件。用 JSON 输出：
{
  "matched": true | false,
  "matchedContent": "命中的新灵感内容（如果 matched 为 true）",
  "reason": "命中理由（一句话）"
}

只输出 JSON。判断标准：新灵感的内容或意图与复活条件高度相关即可视为命中。`;

// 关键词匹配（无 AI 时的降级方案）
function keywordMatch(
  reviveCondition: string,
  recentContents: string[]
): { matched: boolean; matchedContent: string; reason: string } {
  // 提取复活条件中的关键词（2 字以上的中文词组）
  const keywords = reviveCondition
    .replace(/[，。、；：！？""''（）()\[\]{}]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (keywords.length === 0) {
    return { matched: false, matchedContent: "", reason: "" };
  }

  for (const content of recentContents) {
    const hits = keywords.filter((kw) => content.includes(kw));
    if (hits.length >= 1) {
      return {
        matched: true,
        matchedContent: content,
        reason: `关键词命中：${hits.join("、")}`,
      };
    }
  }
  return { matched: false, matchedContent: "", reason: "" };
}

export async function GET() {
  try {
    // 1. 读取所有未复活的墓地灵感
    const graveyards = await prisma.graveyard.findMany({
      where: { revivedAt: null },
      include: {
        idea: true,
      },
    });

    if (graveyards.length === 0) {
      return NextResponse.json({ suggestions: [], total: 0 });
    }

    // 2. 读取最近 7 天的新灵感
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentIdeas = await prisma.idea.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        status: { not: "graveyard" },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (recentIdeas.length === 0) {
      return NextResponse.json({ suggestions: [], total: 0 });
    }

    const hasAI = Boolean(process.env.AI_API_KEY);
    const suggestions = [];

    // ---- 优先级 1：embedding 语义匹配 ----
    if (hasAIEmbedding) {
      const conditions = graveyards
        .filter((g) => g.idea)
        .map((g) => ({ id: g.id, text: g.reviveCondition }));
      const candidates = recentIdeas.map((i) => ({
        id: i.id,
        text: i.content,
      }));

      const matches = await findSemanticMatches(conditions, candidates, 0.75);

      if (matches.length > 0) {
        // 每个条件只取最佳匹配
        const bestByCondition = new Map<
          string,
          { candidateId: string; score: number }
        >();
        for (const m of matches) {
          const prev = bestByCondition.get(m.conditionId);
          if (!prev || m.score > prev.score) {
            bestByCondition.set(m.conditionId, {
              candidateId: m.candidateId,
              score: m.score,
            });
          }
        }

        for (const g of graveyards) {
          if (!g.idea) continue;
          const best = bestByCondition.get(g.id);
          if (!best) continue;
          const matchedIdea = recentIdeas.find(
            (i) => i.id === best.candidateId
          );
          if (!matchedIdea) continue;
          suggestions.push({
            graveyardId: g.id,
            ideaId: g.originalIdeaId,
            originalContent: g.idea.content,
            reason: g.reason,
            reviveCondition: g.reviveCondition,
            matchedContent: matchedIdea.content,
            matchedIdeaId: matchedIdea.id,
            score: best.score,
          });
        }

        return NextResponse.json({
          suggestions,
          total: suggestions.length,
          mode: "semantic",
        });
      }

      // 语义匹配无命中时降级到 AI 文本判断或关键词匹配
    }

    // ---- 优先级 2：AI 文本判断 ----
    if (hasAI) {
      const recentContents = recentIdeas.map((i) => i.content);

      for (const g of graveyards) {
        if (!g.idea) continue;

        let matched = false;
        let matchedContent = "";
        let reason = "";

        try {
          const prompt = REVIVE_CHECK_PROMPT
            .replace("{{originalContent}}", g.idea.content)
            .replace("{{reason}}", g.reason)
            .replace("{{reviveCondition}}", g.reviveCondition)
            .replace(
              "{{recentIdeas}}",
              recentContents.map((c, i) => `${i + 1}. ${c}`).join("\n")
            );

          const result = await generateText({
            model: ai(defaultModel),
            prompt,
          });

          const parsed = JSON.parse(result.text);
          matched = Boolean(parsed.matched);
          matchedContent = parsed.matchedContent || "";
          reason = parsed.reason || "";
        } catch {
          // AI 失败时降级到关键词匹配
          const km = keywordMatch(g.reviveCondition, recentContents);
          matched = km.matched;
          matchedContent = km.matchedContent;
          reason = km.reason;
        }

        if (matched) {
          const matchedIdea = recentIdeas.find(
            (i) => i.content === matchedContent
          );
          suggestions.push({
            graveyardId: g.id,
            ideaId: g.originalIdeaId,
            originalContent: g.idea.content,
            reason: g.reason,
            reviveCondition: g.reviveCondition,
            matchedContent,
            matchedIdeaId: matchedIdea?.id || "",
          });
        }
      }

      return NextResponse.json({
        suggestions,
        total: suggestions.length,
        mode: "ai-text",
      });
    }

    // ---- 优先级 3：关键词匹配（无 AI 降级方案） ----
    const recentContents = recentIdeas.map((i) => i.content);
    for (const g of graveyards) {
      if (!g.idea) continue;
      const km = keywordMatch(g.reviveCondition, recentContents);
      if (km.matched) {
        const matchedIdea = recentIdeas.find(
          (i) => i.content === km.matchedContent
        );
        suggestions.push({
          graveyardId: g.id,
          ideaId: g.originalIdeaId,
          originalContent: g.idea.content,
          reason: g.reason,
          reviveCondition: g.reviveCondition,
          matchedContent: km.matchedContent,
          matchedIdeaId: matchedIdea?.id || "",
        });
      }
    }

    return NextResponse.json({
      suggestions,
      total: suggestions.length,
      mode: "keyword",
    });
  } catch (e) {
    console.error("复活条件检查失败:", e);
    return NextResponse.json(
      { error: "服务器错误", suggestions: [] },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("search-api");

// 使用 request.url 读取查询参数，必须动态渲染
export const dynamic = "force-dynamic";

// 支持的搜索类型
const ALL_TYPES = ["idea", "task", "cognition", "memory", "skill"] as const;
type SearchType = (typeof ALL_TYPES)[number];

// 统一搜索结果格式
interface SearchResult {
  id: string;
  type: SearchType;
  title: string;
  snippet: string;
  createdAt: string;
}

/**
 * 生成带高亮的摘要：匹配位置前后各截取 contextChars 字符，关键词用 <mark> 包裹
 */
function makeSnippet(text: string, keyword: string, contextChars = 50): string {
  if (!text) return "";
  if (!keyword) return text.slice(0, contextChars * 2);

  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const idx = lowerText.indexOf(lowerKeyword);

  if (idx === -1) {
    // 未命中（可能匹配的是其他字段），返回开头摘要
    return text.slice(0, contextChars * 2);
  }

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + keyword.length + contextChars);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  const before = text.slice(start, idx);
  const matched = text.slice(idx, idx + keyword.length);
  const after = text.slice(idx + keyword.length, end);

  return `${prefix}${before}<mark>${matched}</mark>${after}${suffix}`;
}

// GET /api/search?q=关键词&limit=10&offset=0&types=idea,task,cognition,memory,skill
export async function GET(req: NextRequest) {
  try {
    // 鉴权
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 10), 1), 50);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);

    // 解析 types 参数，默认全部
    const typesParam = searchParams.get("types") || "";
    const requestedTypes: SearchType[] = typesParam
      ? (typesParam
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter((t) => ALL_TYPES.includes(t as SearchType)) as SearchType[])
      : [...ALL_TYPES];

    if (requestedTypes.length === 0) {
      return NextResponse.json({ results: [], total: 0, q });
    }

    if (!q) {
      return NextResponse.json({ results: [], total: 0, q });
    }

    const userFilter = buildUserFilter(auth.user);
    const results: SearchResult[] = [];

    // 分页修复：各类型不单独 skip/take，而是统一拉取 offset+limit 条候选，
    // 合并后按 createdAt 降序排列，再统一 slice [offset, offset+limit)。
    // 这样分页基于全局排序，而非各类型独立分页后再拼接。
    const fetchTake = offset + limit;

    // 并行查询各类型 + 统计总数
    const tasks: Promise<void>[] = [];
    const counts: Record<SearchType, number> = {
      idea: 0, task: 0, cognition: 0, memory: 0, skill: 0,
    };

    if (requestedTypes.includes("idea")) {
      tasks.push(
        (async () => {
          const where = { ...userFilter, content: { contains: q } };
          const [items, count] = await Promise.all([
            prisma.idea.findMany({
              where,
              take: fetchTake,
              orderBy: { createdAt: "desc" },
              select: { id: true, content: true, createdAt: true },
            }),
            prisma.idea.count({ where }),
          ]);
          counts.idea = count;
          for (const it of items) {
            results.push({
              id: it.id,
              type: "idea",
              title: it.content.slice(0, 60),
              snippet: makeSnippet(it.content, q),
              createdAt: it.createdAt.toISOString(),
            });
          }
        })()
      );
    }

    if (requestedTypes.includes("task")) {
      tasks.push(
        (async () => {
          const where = { ...userFilter, content: { contains: q } };
          const [items, count] = await Promise.all([
            prisma.task.findMany({
              where,
              take: fetchTake,
              orderBy: { createdAt: "desc" },
              select: { id: true, content: true, createdAt: true },
            }),
            prisma.task.count({ where }),
          ]);
          counts.task = count;
          for (const it of items) {
            results.push({
              id: it.id,
              type: "task",
              title: it.content.slice(0, 60),
              snippet: makeSnippet(it.content, q),
              createdAt: it.createdAt.toISOString(),
            });
          }
        })()
      );
    }

    if (requestedTypes.includes("cognition")) {
      tasks.push(
        (async () => {
          const where = { ...userFilter, content: { contains: q } };
          const [items, count] = await Promise.all([
            prisma.cognition.findMany({
              where,
              take: fetchTake,
              orderBy: { createdAt: "desc" },
              select: { id: true, content: true, type: true, createdAt: true },
            }),
            prisma.cognition.count({ where }),
          ]);
          counts.cognition = count;
          for (const it of items) {
            results.push({
              id: it.id,
              type: "cognition",
              title: it.content.slice(0, 60),
              snippet: makeSnippet(it.content, q),
              createdAt: it.createdAt.toISOString(),
            });
          }
        })()
      );
    }

    if (requestedTypes.includes("memory")) {
      tasks.push(
        (async () => {
          const where = { ...userFilter, content: { contains: q } };
          const [items, count] = await Promise.all([
            prisma.memory.findMany({
              where,
              take: fetchTake,
              orderBy: { createdAt: "desc" },
              select: { id: true, content: true, type: true, createdAt: true },
            }),
            prisma.memory.count({ where }),
          ]);
          counts.memory = count;
          for (const it of items) {
            results.push({
              id: it.id,
              type: "memory",
              title: it.content.slice(0, 60),
              snippet: makeSnippet(it.content, q),
              createdAt: it.createdAt.toISOString(),
            });
          }
        })()
      );
    }

    if (requestedTypes.includes("skill")) {
      tasks.push(
        (async () => {
          // Skill 搜索 name / description / content 三个字段
          const where = {
            ...userFilter,
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
              { content: { contains: q } },
            ],
          };
          const [items, count] = await Promise.all([
            prisma.skill.findMany({
              where,
              take: fetchTake,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                name: true,
                description: true,
                content: true,
                createdAt: true,
              },
            }),
            prisma.skill.count({ where }),
          ]);
          counts.skill = count;
          for (const it of items) {
            // 优先从命中的字段生成摘要
            let snippet = makeSnippet(it.name, q);
            if (!snippet.includes("<mark>")) {
              snippet = makeSnippet(it.description, q);
            }
            if (!snippet.includes("<mark>")) {
              snippet = makeSnippet(it.content, q);
            }
            results.push({
              id: it.id,
              type: "skill",
              title: it.name,
              snippet,
              createdAt: it.createdAt.toISOString(),
            });
          }
        })()
      );
    }

    await Promise.all(tasks);

    // 合并后按 createdAt 降序排列，再统一分页
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    const paged = results.slice(offset, offset + limit);
    const hasMore = offset + paged.length < total;

    return NextResponse.json({
      results: paged,
      total,
      hasMore,
      q,
      limit,
      offset,
    });
  } catch (e) {
    logger.error({ err: e }, "全文搜索失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

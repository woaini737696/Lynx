import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { requireAuth } from "@/lib/auth-utils";

/** 迭代条目结构 */
interface DevLogEntry {
  number: number;
  date: string;
  title: string;
  rawContent: string;
}

/**
 * 将 DEV_LOG.md 原文按 "## 迭代 N - YYYY-MM-DD" 切分为结构化迭代数组
 * 同时返回原始全文以保持兼容
 */
function parseDevLog(content: string): { entries: DevLogEntry[]; raw: string } {
  const entries: DevLogEntry[] = [];
  // 匹配 "## 迭代 N - YYYY-MM-DD" 或 "## 迭代 N - YYYY-MM-DD（...）"
  const headerRegex = /^## 迭代 (\d+)\s*[-—]\s*(\d{4}-\d{2}-\d{2})\s*(.*)$/gm;
  const matches: Array<{ index: number; number: number; date: string; title: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = headerRegex.exec(content)) !== null) {
    matches.push({
      index: m.index,
      number: parseInt(m[1], 10),
      date: m[2],
      title: m[3].trim(),
    });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const rawContent = content.slice(start, end).trim();
    entries.push({
      number: matches[i].number,
      date: matches[i].date,
      title: matches[i].title || `迭代 ${matches[i].number}`,
      rawContent,
    });
  }
  return { entries, raw: content };
}

// GET /api/dev-log
// 读取项目根目录的 DEV_LOG.md，返回结构化迭代数组 + 原始内容
export async function GET() {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    const logPath = path.join(process.cwd(), "DEV_LOG.md");
    const content = fs.readFileSync(logPath, "utf-8");
    const { entries, raw } = parseDevLog(content);
    return NextResponse.json(
      { content: raw, entries, path: "DEV_LOG.md", total: entries.length },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "读取开发日志失败：" + (e as Error).message },
      { status: 500 }
    );
  }
}

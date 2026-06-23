import { NextRequest, NextResponse } from "next/server";
import { embedding } from "@/lib/ai-provider";

// POST /api/ai/embeddings
// Request: { text }
// Response: { embedding: number[] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "请求体格式错误，需为 JSON" },
        { status: 400 }
      );
    }

    const { text } = body as { text?: unknown };
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "text 必须为非空字符串" },
        { status: 400 }
      );
    }

    const vec = await embedding(text);
    return NextResponse.json({ embedding: vec });
  } catch (e) {
    const msg = (e as Error).message || "服务器错误";
    const status = msg.includes("未配置") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { searchUserMemory } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/memory/search?q=xxx - 搜索用户的 Hermes 持久化记忆
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    if (!q.trim()) {
      return NextResponse.json(
        { error: "搜索关键词 q 不能为空" },
        { status: 400 }
      );
    }

    const result = await searchUserMemory(auth.user.id, q.trim());
    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "搜索 Hermes 持久化记忆失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

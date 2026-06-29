/**
 * AI 助理可用工具列表（已登录用户）
 *
 * 返回 ai-assistant-tools.ts 中所有工具的 name/description
 * 用于职业空间"可见工具白名单"配置
 *
 * GET /api/ai/tools
 */

import { NextResponse } from "next/server";
import { AI_ASSISTANT_TOOLS } from "@/lib/ai-assistant-tools";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    tools: AI_ASSISTANT_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
    })),
    quickCommands: [], // 由 /api/ai/workspace + 静态 QUICK_COMMANDS 共同构成
  });
}

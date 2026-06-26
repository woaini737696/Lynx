/**
 * 快捷技能清单（admin 配置工作空间时用）
 * GET /api/admin/profession-workspaces/quick-commands
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { QUICK_COMMANDS } from "@/lib/ai-assistant-tools";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });
  }

  return NextResponse.json({
    quickCommands: QUICK_COMMANDS.map((q) => ({
      label: q.label,
      icon: q.icon,
      description: q.description,
      message: q.message,
    })),
  });
}

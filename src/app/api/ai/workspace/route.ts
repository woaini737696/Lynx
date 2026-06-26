/**
 * 当前用户工作空间 API（已登录用户按 Role.profession 加载）
 *
 * GET /api/ai/workspace - 返回当前用户的工作空间配置
 *  - profession：用户 Role.profession（优先）/ User.profession
 *  - 若 ProfessionWorkspace 表无配置，回退到 PROFESSIONS 静态默认值
 *  - 未登录用户返回空配置（前端 fallback 到 QUICK_COMMANDS 默认）
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-utils";
import {
  PROFESSIONS,
  isValidProfessionKey,
  type ProfessionDef,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({
      profession: null,
      workspace: null,
    });
  }

  // 1. 优先用 Role.profession（管理员在角色管理中设置）
  // 2. 回退到 User.profession
  // 3. 都为空则返回 null
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, profession: true },
  });
  if (!dbUser) {
    return NextResponse.json({ profession: null, workspace: null });
  }

  // 查 Role.profession
  let professionKey: string | null = null;
  const roleRow = await prisma.role.findUnique({
    where: { name: dbUser.role },
    select: { profession: true },
  });
  professionKey = roleRow?.profession || dbUser.profession || null;

  if (!professionKey || !isValidProfessionKey(professionKey)) {
    return NextResponse.json({ profession: null, workspace: null });
  }

  // 2. 查 ProfessionWorkspace 表
  const ws = await prisma.professionWorkspace.findUnique({
    where: { profession: professionKey },
  });

  const def: ProfessionDef | undefined = PROFESSIONS.find(
    (p) => p.key === professionKey
  );
  if (!def) {
    return NextResponse.json({ profession: professionKey, workspace: null });
  }

  // 3. 合并：DB 优先，缺失字段回退到 PROFESSIONS 默认
  const quickCommands =
    ws?.quickCommands && (ws.quickCommands as unknown[]).length > 0
      ? (ws.quickCommands as unknown[])
      : def.defaultQuickCommands.map((label) => ({ label }));

  const allowedTools =
    ws?.allowedTools && (ws.allowedTools as string[]).length > 0
      ? (ws.allowedTools as string[])
      : def.defaultAllowedTools;

  const systemPrompt = ws?.systemPrompt?.trim()
    ? ws.systemPrompt
    : def.defaultSystemPrompt;

  return NextResponse.json({
    profession: professionKey,
    workspace: {
      profession: professionKey,
      displayName: ws?.displayName || def.label,
      icon: ws?.icon || def.icon,
      accentColor: ws?.accentColor || def.accentColor,
      description: ws?.description || def.description,
      quickCommands,
      systemPrompt,
      defaultProvider: ws?.defaultProvider || def.defaultProvider || null,
      defaultModel: ws?.defaultModel || def.defaultModel || null,
      defaultReasoningMode:
        ws?.defaultReasoningMode || def.defaultReasoningMode || null,
      allowedTools,
      enabled: ws?.enabled ?? false,
      isDefault: !ws,
    },
  });
}

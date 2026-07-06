/**
 * 职业 AI 工作空间管理 API（仅 admin）
 *
 * GET   /api/admin/profession-workspaces       - 列出 12 岗位 + 数据库中的自定义配置
 * POST  /api/admin/profession-workspaces       - 创建/覆盖某职业的工作空间
 *
 * 权限：仅 admin 可读写；其他角色 403
 * 数据：合并 PROFESSIONS 静态定义 + ProfessionWorkspace 表自定义配置
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { PROFESSIONS, isValidProfessionKey } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** 序列化 ProfessionWorkspace 行（处理 JSON 字段） */
function serializeWorkspace(row: {
  id: string;
  profession: string;
  displayName: string;
  description: string | null;
  icon: string;
  accentColor: string;
  quickCommands: unknown;
  systemPrompt: string | null;
  defaultProvider: string | null;
  defaultModel: string | null;
  defaultReasoningMode: string | null;
  allowedTools: unknown;
  allowedProviders: unknown;
  enabled: boolean;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    profession: row.profession,
    displayName: row.displayName,
    description: row.description,
    icon: row.icon,
    accentColor: row.accentColor,
    quickCommands: (row.quickCommands as unknown[]) || [],
    systemPrompt: row.systemPrompt,
    defaultProvider: row.defaultProvider,
    defaultModel: row.defaultModel,
    defaultReasoningMode: row.defaultReasoningMode,
    allowedTools: (row.allowedTools as string[]) || [],
    allowedProviders: (row.allowedProviders as string[]) || [],
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** GET - 列出所有职业 + 数据库配置（含每个职业空间的用户数量） */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });
  }

  // 并行查询：DB 自定义配置 + 用户数量统计（按 profession 分组）
  // 用户归属职业空间：User.profession 字段在分配角色时由 Role.profession 同步写入
  const [rows, userCountsByProfession, allUsersCount] = await Promise.all([
    prisma.professionWorkspace.findMany(),
    // 统计 User.profession 直接归属的用户数（按 profession 分组）
    prisma.user.groupBy({
      by: ["profession"],
      _count: { _all: true },
    }),
    // 全部用户数（用于"未归属职业空间"统计）
    prisma.user.count(),
  ]);

  // 统计每个 profession 的用户数
  const userCountMap = new Map<string, number>();
  for (const item of userCountsByProfession) {
    if (item.profession) {
      userCountMap.set(item.profession, item._count._all);
    }
  }

  const rowMap = new Map(rows.map((r) => [r.profession, r]));

  // 合并：12 岗位静态定义 + 数据库自定义 + 用户数量
  const workspaces = PROFESSIONS.map((def) => {
    const row = rowMap.get(def.key);
    const base = row
      ? serializeWorkspace(row)
      : {
          id: null,
          profession: def.key,
          displayName: def.label,
          description: def.description,
          icon: def.icon,
          accentColor: def.accentColor,
          quickCommands: def.defaultQuickCommands.map((label) => ({ label })),
          systemPrompt: def.defaultSystemPrompt,
          defaultProvider: def.defaultProvider || null,
          defaultModel: def.defaultModel || null,
          defaultReasoningMode: def.defaultReasoningMode || null,
          allowedTools: def.defaultAllowedTools,
          allowedProviders: ["deepseek", "mimo"], // 默认允许全部 Provider
          enabled: false, // 未在 DB 中持久化
          updatedAt: null,
          isDefault: true,
        };
    return {
      ...base,
      userCount: userCountMap.get(def.key) || 0,
    };
  });

  return NextResponse.json({
    professions: PROFESSIONS.map((p) => ({
      key: p.key,
      label: p.label,
      icon: p.icon,
      accentColor: p.accentColor,
    })),
    workspaces,
    // 全部用户数（用于"未归属职业空间"统计）
    totalUsers: allUsersCount,
  });
}

/** POST - 创建/覆盖某职业的工作空间（upsert） */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const profession = String(body.profession || "").trim();
  if (!isValidProfessionKey(profession)) {
    return NextResponse.json({ error: "无效的职业 key" }, { status: 400 });
  }

  // 验证 allowedTools / quickCommands / allowedProviders JSON 字段
  const quickCommands = Array.isArray(body.quickCommands)
    ? (body.quickCommands as unknown[])
    : [];
  const allowedTools = Array.isArray(body.allowedTools)
    ? (body.allowedTools as unknown[]).map(String)
    : [];
  const allowedProviders = Array.isArray(body.allowedProviders)
    ? (body.allowedProviders as unknown[]).map(String)
    : [];

  const row = await prisma.professionWorkspace.upsert({
    where: { profession },
    create: {
      profession,
      displayName: String(body.displayName || "").slice(0, 100) || profession,
      description: body.description ? String(body.description).slice(0, 2000) : null,
      icon: String(body.icon || "💼").slice(0, 16),
      accentColor: String(body.accentColor || "orange").slice(0, 32),
      quickCommands: quickCommands as unknown as never,
      systemPrompt: body.systemPrompt ? String(body.systemPrompt).slice(0, 16000) : null,
      defaultProvider: body.defaultProvider ? String(body.defaultProvider).slice(0, 32) : null,
      defaultModel: body.defaultModel ? String(body.defaultModel).slice(0, 64) : null,
      defaultReasoningMode: body.defaultReasoningMode
        ? String(body.defaultReasoningMode).slice(0, 32)
        : null,
      allowedTools: allowedTools as unknown as never,
      allowedProviders: allowedProviders as unknown as never,
      enabled: body.enabled !== false,
    },
    update: {
      displayName: String(body.displayName || "").slice(0, 100) || profession,
      description: body.description ? String(body.description).slice(0, 2000) : null,
      icon: String(body.icon || "💼").slice(0, 16),
      accentColor: String(body.accentColor || "orange").slice(0, 32),
      quickCommands: quickCommands as unknown as never,
      systemPrompt: body.systemPrompt ? String(body.systemPrompt).slice(0, 16000) : null,
      defaultProvider: body.defaultProvider ? String(body.defaultProvider).slice(0, 32) : null,
      defaultModel: body.defaultModel ? String(body.defaultModel).slice(0, 64) : null,
      defaultReasoningMode: body.defaultReasoningMode
        ? String(body.defaultReasoningMode).slice(0, 32)
        : null,
      allowedTools: allowedTools as unknown as never,
      allowedProviders: allowedProviders as unknown as never,
      enabled: body.enabled !== false,
    },
  });

  return NextResponse.json({ workspace: serializeWorkspace(row) });
}

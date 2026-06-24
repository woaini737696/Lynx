import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { validateString, validateEnum } from "@/lib/validate";
import { Prisma } from "@prisma/client";

// 巡检对象枚举
const PATROL_SCOPES = ["inbox", "board", "graveyard", "all"] as const;
type PatrolScope = (typeof PATROL_SCOPES)[number];

// 通知渠道枚举
const NOTIFY_CHANNELS = ["toast", "notification", "push", "feishu"] as const;

// 校验 triggerTime：HH:mm 或 "manual"
function validateTriggerTime(value: unknown): string {
  if (typeof value !== "string") return "manual";
  const trimmed = value.trim();
  if (trimmed === "manual") return "manual";
  // HH:mm 格式校验
  const match = trimmed.match(/^(\d{2}):(\d{2})$/);
  if (!match) return "manual";
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return "manual";
  return trimmed;
}

// 校验 notifyChannels 数组
function validateNotifyChannels(value: unknown): string[] {
  if (!Array.isArray(value)) return ["toast", "notification"];
  const valid: string[] = [];
  for (const ch of value) {
    if (typeof ch === "string" && (NOTIFY_CHANNELS as readonly string[]).includes(ch)) {
      valid.push(ch);
    }
  }
  if (valid.length === 0) return ["toast", "notification"];
  return valid;
}

// 获取当前用户的所有巡检规则
export async function GET() {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const rules = await prisma.patrolRule.findMany({
      where: buildUserFilter(user),
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ rules });
  } catch (e) {
    console.error("获取巡检规则失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 创建新巡检规则
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await req.json().catch(() => ({}));

    // 输入校验
    const name = validateString(body?.name, 200);
    if (!name) {
      return NextResponse.json({ error: "规则名称不能为空" }, { status: 400 });
    }
    const description = validateString(body?.description, 5000);
    const scope = validateEnum<PatrolScope>(body?.scope, PATROL_SCOPES);
    const triggerTime = validateTriggerTime(body?.triggerTime);
    const prompt = validateString(body?.prompt, 100000);
    if (!prompt) {
      return NextResponse.json({ error: "巡检提示词不能为空" }, { status: 400 });
    }
    const threshold = Math.min(1, Math.max(0, Number(body?.threshold) || 0.75));
    const notifyChannels = validateNotifyChannels(body?.notifyChannels);
    const enabled = body?.enabled !== false; // 默认 true

    const rule = await prisma.patrolRule.create({
      data: {
        name,
        description,
        scope,
        triggerTime,
        prompt,
        threshold,
        notifyChannels: notifyChannels as unknown as Prisma.InputJsonValue,
        enabled,
        userId: user.id,
      },
    });

    return NextResponse.json({ rule, success: true });
  } catch (e) {
    console.error("创建巡检规则失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

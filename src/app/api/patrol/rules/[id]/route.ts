import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { validateString, validateEnum } from "@/lib/validate";
import { Prisma } from "@prisma/client";
import { schedulePatrolRule, cancelPatrolRule } from "@/lib/patrol-scheduler";

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

// 更新巡检规则
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = params;

    // 验证规则归属权
    const existing = await prisma.patrolRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // 构建更新数据（仅更新传入的字段）
    const data: Prisma.PatrolRuleUpdateInput = {};
    if (body?.name !== undefined) {
      const name = validateString(body.name, 200);
      if (!name) {
        return NextResponse.json({ error: "规则名称不能为空" }, { status: 400 });
      }
      data.name = name;
    }
    if (body?.description !== undefined) {
      data.description = validateString(body.description, 5000);
    }
    if (body?.scope !== undefined) {
      data.scope = validateEnum<PatrolScope>(body.scope, PATROL_SCOPES);
    }
    if (body?.triggerTime !== undefined) {
      data.triggerTime = validateTriggerTime(body.triggerTime);
    }
    if (body?.prompt !== undefined) {
      const prompt = validateString(body.prompt, 100000);
      if (!prompt) {
        return NextResponse.json({ error: "巡检提示词不能为空" }, { status: 400 });
      }
      data.prompt = prompt;
    }
    if (body?.threshold !== undefined) {
      data.threshold = Math.min(1, Math.max(0, Number(body.threshold) || 0.75));
    }
    if (body?.notifyChannels !== undefined) {
      data.notifyChannels = validateNotifyChannels(body.notifyChannels) as unknown as Prisma.InputJsonValue;
    }
    if (body?.enabled !== undefined) {
      data.enabled = Boolean(body.enabled);
    }

    const rule = await prisma.patrolRule.update({ where: { id }, data });

    // triggerTime 或 enabled 变更时，重新注册/取消 cron job
    if (body?.triggerTime !== undefined || body?.enabled !== undefined) {
      if (rule.enabled) {
        schedulePatrolRule(rule.id, rule.triggerTime);
      } else {
        cancelPatrolRule(rule.id);
      }
    }

    return NextResponse.json({ rule, success: true });
  } catch (e) {
    console.error("更新巡检规则失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 删除巡检规则
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { id } = params;

    // 验证规则归属权
    const existing = await prisma.patrolRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    // 关联的 PatrolLog 通过 onDelete: Cascade 自动删除
    await prisma.patrolRule.delete({ where: { id } });

    // 取消该规则对应的 cron job
    cancelPatrolRule(id);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("删除巡检规则失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

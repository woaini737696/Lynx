import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { chat } from "@/lib/ai-provider";
import { sendPushNotification, type PushSubscriptionObject } from "@/lib/push";
import { runLarkCliService, getCurrentUser } from "@/lib/lark-sync";
import { Prisma } from "@prisma/client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("patrol-run");

// 巡检结果项
interface PatrolResultItem {
  itemId: string;
  content: string;
  matched: boolean;
  reason: string;
  suggestion: string;
}

// 根据 scope 收集巡检数据
async function collectScopeData(
  scope: string,
  userFilter: { userId?: string }
): Promise<Array<{ itemId: string; content: string; type: string }>> {
  const items: Array<{ itemId: string; content: string; type: string }> = [];

  if (scope === "inbox" || scope === "all") {
    const ideas = await prisma.idea.findMany({
      where: { status: "inbox", ...userFilter },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    for (const idea of ideas) {
      items.push({ itemId: idea.id, content: idea.content, type: "idea" });
    }
  }

  if (scope === "board" || scope === "all") {
    const tasks = await prisma.task.findMany({
      where: { status: "active", ...userFilter },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    for (const task of tasks) {
      items.push({ itemId: task.id, content: task.content, type: "task" });
    }
  }

  if (scope === "graveyard" || scope === "all") {
    const whereClause =
      userFilter.userId
        ? { idea: { userId: userFilter.userId } }
        : {};
    const graveyards = await prisma.graveyard.findMany({
      where: whereClause,
      include: { idea: { select: { content: true } } },
      orderBy: { abandonedAt: "desc" },
      take: 100,
    });
    for (const g of graveyards) {
      items.push({
        itemId: g.id,
        content: `灵感：${g.idea?.content || ""}\n放弃原因：${g.reason}\n复活条件：${g.reviveCondition}`,
        type: "graveyard",
      });
    }
  }

  return items;
}

// 发送通知（push / feishu 渠道，toast 不需要后端发）
async function sendNotifications(
  userId: string,
  channels: string[],
  title: string,
  message: string
): Promise<void> {
  // push 渠道
  if (channels.includes("push")) {
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
      });
      for (const sub of subscriptions) {
        const subscription: PushSubscriptionObject = {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        };
        await sendPushNotification(subscription, { title, body: message });
      }
    } catch (e) {
      logger.error({ err: e }, "发送 push 通知失败");
    }
  }

  // feishu 渠道
  if (channels.includes("feishu")) {
    try {
      const settings = await prisma.aISetting.findFirst();
      if (settings?.feishuNotify) {
        const me = getCurrentUser();
        if (me) {
          const shellQuote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;
          const text = `🔔【AI 巡检】${title}\n${message}`;
          runLarkCliService(
            "im",
            `+messages-send --user-id ${shellQuote(me.openId)} --text ${shellQuote(text)}`
          );
        }
      }
    } catch (e) {
      logger.error({ err: e }, "发送飞书通知失败");
    }
  }
}

// 执行巡检
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    const { ruleId } = body as { ruleId?: string };

    if (!ruleId) {
      return NextResponse.json({ error: "ruleId 不能为空" }, { status: 400 });
    }

    // 读取规则
    const rule = await prisma.patrolRule.findUnique({ where: { id: ruleId } });
    if (!rule) {
      return NextResponse.json({ error: "规则不存在" }, { status: 404 });
    }
    if (user.role !== "admin" && rule.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const startedAt = Date.now();
    const userFilter = buildUserFilter(user);

    // 1. 根据 scope 收集数据
    const items = await collectScopeData(rule.scope, userFilter);

    if (items.length === 0) {
      // 无数据可巡检，仍记录日志
      const log = await prisma.patrolLog.create({
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          scope: rule.scope,
          success: true,
          results: [] as unknown as Prisma.InputJsonValue,
          hitCount: 0,
          durationMs: Date.now() - startedAt,
          finishedAt: new Date(),
        },
      });
      await prisma.patrolRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date() },
      });
      return NextResponse.json({
        results: [],
        hitCount: 0,
        logId: log.id,
        message: "巡检范围内无数据",
      });
    }

    // 2. 调用 AI 分析
    let results: PatrolResultItem[] = [];
    let aiSuccess = true;
    let aiError: string | null = null;

    try {
      // 构造用户消息：列出所有待巡检项
      const itemsText = items
        .map((item, i) => `[${i + 1}] (id:${item.itemId}, type:${item.type})\n${item.content}`)
        .join("\n\n");

      const userMessage = `以下是待巡检的数据项，请根据巡检规则分析每一项是否匹配，并给出建议。

待巡检数据：
${itemsText}

请用 JSON 数组输出每项的巡检结果，格式：
[
  {
    "itemId": "数据项的 id",
    "content": "数据项内容摘要",
    "matched": true | false,
    "reason": "匹配/不匹配的理由",
    "suggestion": "建议动作（如匹配则给出处理建议）"
  }
]

只输出 JSON 数组，不要其他内容。`;

      const aiResp = await chat(
        [{ role: "user", content: userMessage }],
        {
          system: rule.prompt,
          reasoningMode: "standard",
          temperature: 0.3,
        }
      );

      // 解析 AI 返回的 JSON 数组
      const jsonMatch = aiResp.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          results = parsed.map((item: Record<string, unknown>) => ({
            itemId: String(item.itemId || ""),
            content: String(item.content || ""),
            matched: Boolean(item.matched),
            reason: String(item.reason || ""),
            suggestion: String(item.suggestion || ""),
          }));
        }
      }
    } catch (e) {
      aiSuccess = false;
      aiError = (e as Error).message;
      logger.error({ err: e, ruleId }, "AI 巡检分析失败");
    }

    const hitCount = results.filter((r) => r.matched).length;
    const durationMs = Date.now() - startedAt;

    // 3. 写入 PatrolLog
    const log = await prisma.patrolLog.create({
      data: {
        ruleId: rule.id,
        ruleName: rule.name,
        scope: rule.scope,
        success: aiSuccess,
        results: results as unknown as Prisma.InputJsonValue,
        hitCount,
        durationMs,
        error: aiError,
        finishedAt: new Date(),
      },
    });

    // 4. 更新规则 lastRunAt
    await prisma.patrolRule.update({
      where: { id: rule.id },
      data: { lastRunAt: new Date() },
    });

    // 5. 根据 notifyChannels 发送通知（toast 不需要后端发）
    const channels = (rule.notifyChannels as string[]) || [];
    const notifyChannels = channels.filter(
      (ch) => ch !== "toast" && ch !== "notification"
    );
    if (notifyChannels.length > 0 && hitCount > 0) {
      const title = `巡检命中：${rule.name}`;
      const message = `共命中 ${hitCount} 项，请前往巡检日志查看详情`;
      await sendNotifications(user.id, notifyChannels, title, message).catch(() => {});
    }

    return NextResponse.json({
      results,
      hitCount,
      logId: log.id,
      success: aiSuccess,
    });
  } catch (e) {
    console.error("执行巡检失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

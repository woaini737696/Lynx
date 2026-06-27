// 巡检调度器：按 PatrolRule.triggerTime 注册 cron job，定时触发巡检
// triggerTime 支持两种格式：
//   1. "HH:mm"（每日定时，如 "10:00"）→ 转换为 cron "m H * * *"
//   2. 标准 5 字段 cron 表达式（如 "0 9 * * 1-5"）
//   3. "manual" 表示仅手动触发，不注册 cron job
import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("patrol-scheduler");
const scheduledJobs = new Map<string, ScheduledTask>();

/**
 * 将 triggerTime 转换为标准 5 字段 cron 表达式
 * - "manual" → null（不调度）
 * - "HH:mm" → "m H * * *"
 * - 已是 cron 表达式 → 原样返回
 */
function toCronExpression(triggerTime: string): string | null {
  if (!triggerTime || triggerTime === "manual") return null;

  // "HH:mm" 格式（兼容 "H:mm" / "HH:m"）
  const hhmmMatch = triggerTime.match(/^(\d{1,2}):(\d{1,2})$/);
  if (hhmmMatch) {
    const h = parseInt(hhmmMatch[1], 10);
    const m = parseInt(hhmmMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${m} ${h} * * *`;
    }
    return null;
  }

  // 已是标准 cron 表达式，原样返回（由 cron.validate 校验）
  return triggerTime;
}

// 启动巡检调度器：加载所有启用的 PatrolRule，按 triggerTime 注册 cron job
export async function startPatrolScheduler(): Promise<void> {
  try {
    const rules = await prisma.patrolRule.findMany({
      where: { enabled: true, triggerTime: { not: "manual" } },
    });
    for (const rule of rules) {
      schedulePatrolRule(rule.id, rule.triggerTime || "0 9 * * *");
    }
    logger.info({ count: rules.length }, "巡检调度器已启动");
  } catch (e) {
    logger.error({ err: e }, "巡检调度器启动失败");
  }
}

// 为单个规则注册 cron job
export function schedulePatrolRule(ruleId: string, triggerTime: string): boolean {
  // 先取消已有任务
  cancelPatrolRule(ruleId);

  // 转换为 cron 表达式
  const cronExpr = toCronExpression(triggerTime);
  if (!cronExpr) {
    // "manual" 或无效格式，不调度
    logger.info({ ruleId, triggerTime }, "规则为手动触发，不注册 cron job");
    return false;
  }

  // 验证 cron 表达式
  if (!cron.validate(cronExpr)) {
    logger.warn({ ruleId, cronExpr, triggerTime }, "无效的 cron 表达式");
    return false;
  }
  const task = cron.schedule(cronExpr, async () => {
    logger.info({ ruleId }, "定时巡检触发");
    try {
      // 调用巡检执行逻辑（内部调用，不走 HTTP）
      const { runPatrolRule } = await import("@/lib/patrol-runner");
      await runPatrolRule(ruleId);
    } catch (e) {
      logger.error({ err: e, ruleId }, "定时巡检执行失败");
    }
  });
  scheduledJobs.set(ruleId, task);
  logger.info({ ruleId, cronExpr }, "巡检 cron job 已注册");
  return true;
}

// 取消单个规则的 cron job
export function cancelPatrolRule(ruleId: string): void {
  const task = scheduledJobs.get(ruleId);
  if (task) {
    task.stop();
    scheduledJobs.delete(ruleId);
  }
}

// 停止所有 cron job
export function stopPatrolScheduler(): void {
  for (const [id, task] of scheduledJobs) {
    task.stop();
  }
  scheduledJobs.clear();
  logger.info("巡检调度器已停止");
}

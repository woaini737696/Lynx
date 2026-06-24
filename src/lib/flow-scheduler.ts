// Flows 调度器：定时触发器 + 事件触发器
// 使用 setInterval 轮询定时任务（避免引入 node-cron 依赖）
// 事件触发器通过 subscribeFlowEvents 订阅 Webhook 事件流
import { readFlows } from "@/lib/flow-store";
import { executeFlowInternal } from "@/lib/flow-engine";
import { subscribeWebhookEvents } from "@/lib/lark-webhook-handler";

// ============ 类型 ============

interface ScheduledJob {
  flowId: string;
  flowName: string;
  /** cron 风格的分钟/小时/天（简化版：仅支持 "HH:MM" 每日定时） */
  timeStr: string;
  /** 上次触发时间（用于去重，避免同一分钟内重复触发） */
  lastFired: string | null;
}

// ============ 定时调度器 ============

const scheduledJobs: ScheduledJob[] = [];
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
const SCHEDULER_INTERVAL = 60 * 1000; // 每分钟检查一次

/**
 * 解析定时表达式，支持两种格式：
 * - "HH:MM"（每日定时，如 "23:00"）
 * - "every Nm"（每 N 分钟，如 "every 30m"）
 * 返回 { shouldFire: boolean, description: string }
 */
function shouldFireNow(
  timeStr: string,
  lastFired: string | null
): { shouldFire: boolean; description: string } {
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  // 格式1：每日定时 "HH:MM"
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(":");
    const target = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (currentHHMM !== target) {
      return { shouldFire: false, description: `每日 ${target}` };
    }
    // 同一分钟内不重复触发
    if (lastFired) {
      const last = new Date(lastFired);
      if (
        last.getHours() === now.getHours() &&
        last.getMinutes() === now.getMinutes() &&
        last.getDate() === now.getDate()
      ) {
        return { shouldFire: false, description: `每日 ${target}（本分钟已触发）` };
      }
    }
    return { shouldFire: true, description: `每日 ${target}` };
  }

  // 格式2：每 N 分钟 "every Nm"
  const everyMatch = timeStr.match(/^every\s+(\d+)m$/i);
  if (everyMatch) {
    const intervalMin = parseInt(everyMatch[1], 10);
    if (intervalMin <= 0) {
      return { shouldFire: false, description: "无效间隔" };
    }
    if (!lastFired) {
      return { shouldFire: true, description: `每 ${intervalMin} 分钟` };
    }
    const last = new Date(lastFired);
    const elapsedMin = (now.getTime() - last.getTime()) / (60 * 1000);
    if (elapsedMin >= intervalMin) {
      return { shouldFire: true, description: `每 ${intervalMin} 分钟` };
    }
    return { shouldFire: false, description: `每 ${intervalMin} 分钟` };
  }

  return { shouldFire: false, description: "未知格式" };
}

/**
 * 从工作流列表中提取所有定时触发器节点。
 * 返回 { flowId, flowName, timeStr } 列表。
 */
async function loadScheduledFlows(): Promise<
  Array<{ flowId: string; flowName: string; timeStr: string }>
> {
  const flows = await readFlows();
  const result: Array<{ flowId: string; flowName: string; timeStr: string }> = [];
  for (const flow of flows) {
    if (!flow.enabled) continue;
    for (const node of flow.nodes) {
      if (
        node.type === "trigger" &&
        node.config?.triggerType === "schedule" &&
        node.config?.schedule
      ) {
        result.push({
          flowId: flow.id,
          flowName: flow.name,
          timeStr: node.config.schedule,
        });
      }
    }
  }
  return result;
}

/**
 * 执行定时触发的工作流。
 */
async function fireScheduledFlow(flowId: string, flowName: string): Promise<void> {
  console.log(`[flow-scheduler] 定时触发工作流: ${flowName} (${flowId})`);
  try {
    const flows = await readFlows();
    const flow = flows.find((f) => f.id === flowId);
    if (!flow || !flow.enabled) {
      console.log(`[flow-scheduler] 工作流不存在或未启用，跳过: ${flowId}`);
      return;
    }
    const result = await executeFlowInternal(flow, "");
    console.log(
      `[flow-scheduler] 工作流执行完成: ${flowName} success=${result.success} duration=${result.totalDurationMs}ms`
    );
  } catch (e) {
    console.error(`[flow-scheduler] 工作流执行失败: ${flowName}`, e);
  }
}

/**
 * 定时调度器主循环：每分钟检查一次是否有需要触发的工作流。
 */
async function tick(): Promise<void> {
  const scheduledFlows = await loadScheduledFlows();

  for (const sf of scheduledFlows) {
    // 查找或创建 job 记录
    let job = scheduledJobs.find((j) => j.flowId === sf.flowId);
    if (!job) {
      job = {
        flowId: sf.flowId,
        flowName: sf.flowName,
        timeStr: sf.timeStr,
        lastFired: null,
      };
      scheduledJobs.push(job);
    }
    // 更新 timeStr（可能被用户修改）
    job.timeStr = sf.timeStr;
    job.flowName = sf.flowName;

    const { shouldFire } = shouldFireNow(job.timeStr, job.lastFired);
    if (shouldFire) {
      job.lastFired = new Date().toISOString();
      // 异步执行，不阻塞调度循环
      fireScheduledFlow(job.flowId, job.flowName).catch(() => {});
    }
  }

  // 清理已删除/禁用的工作流 job
  const activeFlowIds = new Set(scheduledFlows.map((sf) => sf.flowId));
  for (let i = scheduledJobs.length - 1; i >= 0; i--) {
    if (!activeFlowIds.has(scheduledJobs[i].flowId)) {
      scheduledJobs.splice(i, 1);
    }
  }
}

/**
 * 启动定时调度器（幂等，重复调用不会创建多个 timer）。
 */
export function startFlowScheduler(): void {
  if (schedulerTimer) return;
  console.log("[flow-scheduler] 定时调度器已启动");
  // 启动后立即执行一次 tick（加载已有定时任务）
  tick().catch((e) => console.error("[flow-scheduler] 启动 tick 失败:", e));
  schedulerTimer = setInterval(() => {
    tick().catch((e) => console.error("[flow-scheduler] tick 失败:", e));
  }, SCHEDULER_INTERVAL);
}

/**
 * 停止定时调度器。
 */
export function stopFlowScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[flow-scheduler] 定时调度器已停止");
  }
}

// ============ 事件触发器 ============

let eventUnsubscribe: (() => void) | null = null;

/**
 * 从工作流列表中提取所有事件触发器节点。
 * 返回 { flowId, flowName, eventType } 列表。
 */
async function loadEventFlows(): Promise<
  Array<{ flowId: string; flowName: string; eventType: string }>
> {
  const flows = await readFlows();
  const result: Array<{ flowId: string; flowName: string; eventType: string }> = [];
  for (const flow of flows) {
    if (!flow.enabled) continue;
    for (const node of flow.nodes) {
      if (
        node.type === "trigger" &&
        node.config?.triggerType === "event" &&
        node.config?.eventType
      ) {
        result.push({
          flowId: flow.id,
          flowName: flow.name,
          eventType: node.config.eventType,
        });
      }
    }
  }
  return result;
}

/**
 * 启动事件触发器：订阅 Webhook 事件流，匹配到对应 eventType 时触发工作流。
 */
export async function startEventTriggers(): Promise<void> {
  if (eventUnsubscribe) return;
  console.log("[flow-scheduler] 事件触发器已启动");

  eventUnsubscribe = subscribeWebhookEvents(async (evt) => {
    try {
      const eventFlows = await loadEventFlows();
      const matched = eventFlows.filter((ef) => ef.eventType === evt.eventType);
      if (matched.length === 0) return;

      for (const ef of matched) {
        console.log(
          `[flow-scheduler] 事件触发工作流: ${ef.flowName} (${ef.flowId}) event=${evt.eventType}`
        );
        const flows = await readFlows();
        const flow = flows.find((f) => f.id === ef.flowId);
        if (!flow || !flow.enabled) continue;
        // 将事件摘要作为初始输入
        const input = evt.summary || `事件: ${evt.eventType}`;
        const result = await executeFlowInternal(flow, input);
        console.log(
          `[flow-scheduler] 事件触发工作流执行完成: ${ef.flowName} success=${result.success}`
        );
      }
    } catch (e) {
      console.error("[flow-scheduler] 事件触发处理失败:", e);
    }
  });
}

/**
 * 停止事件触发器。
 */
export function stopEventTriggers(): void {
  if (eventUnsubscribe) {
    eventUnsubscribe();
    eventUnsubscribe = null;
    console.log("[flow-scheduler] 事件触发器已停止");
  }
}

// ============ 统一启动/停止 ============

/**
 * 启动所有触发器（定时 + 事件）。
 * 应在应用启动时调用（如 instrumentation.ts 或 layout server side）。
 */
export async function startAllTriggers(): Promise<void> {
  startFlowScheduler();
  await startEventTriggers();
}

/**
 * 停止所有触发器。
 */
export function stopAllTriggers(): void {
  stopFlowScheduler();
  stopEventTriggers();
}

// ============ 状态查询（供 API 使用） ============

export function getSchedulerStatus(): {
  running: boolean;
  scheduledCount: number;
  jobs: Array<{ flowId: string; flowName: string; timeStr: string; lastFired: string | null }>;
} {
  return {
    running: schedulerTimer !== null,
    scheduledCount: scheduledJobs.length,
    jobs: scheduledJobs.map((j) => ({
      flowId: j.flowId,
      flowName: j.flowName,
      timeStr: j.timeStr,
      lastFired: j.lastFired,
    })),
  };
}

// Next.js Instrumentation 钩子
// 在应用启动时执行一次（仅 server side）
// 用于启动 Flows 定时/事件触发器调度器 + 飞书任务定时同步
export async function register(): Promise<void> {
  // 仅在 Node.js 运行时启动（排除 Edge）
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // 动态导入避免 Edge bundle 问题
  const { startAllTriggers } = await import("./src/lib/flow-scheduler");
  const { initializeDefaultFlows } = await import("./src/lib/flow-store");
  const { runSyncAsync } = await import("./src/lib/lark-sync");
  const { processFeedbackReports } = await import("./src/lib/hermes-learner");

  // 初始化默认工作流（如果数据库为空，从 .ai-flows.json 迁移或创建默认数据）
  await initializeDefaultFlows();

  await startAllTriggers();
  console.log("[instrumentation] Flows 触发器调度器已启动");

  // ===== 巡检调度器：按 PatrolRule.triggerTime 注册 cron job =====
  const { startPatrolScheduler } = await import("./src/lib/patrol-scheduler");
  await startPatrolScheduler();
  console.log("[instrumentation] 巡检调度器已启动");

  // ===== Hermes 反馈学习管道（每天定时处理 bad 标注） =====
  // 读取 HermesReport 中近 24h 的消息标注纠正，写入 feedback-learning.jsonl
  // 供 AI 助理 system prompt 注入参考，避免重复类似错误
  // 函数内部按 24h 窗口过滤，每 1 小时轮询一次（一天内首次有数据即处理）
  const HERMES_LEARNER_INTERVAL = 60 * 60 * 1000; // 每小时检查一次
  let learning = false;
  async function hermesLearnerTick() {
    if (learning) return; // 防止重叠执行
    learning = true;
    try {
      const count = await processFeedbackReports();
      if (count > 0) {
        console.log(`[instrumentation] Hermes 反馈学习处理 ${count} 条 bad 标注`);
      }
    } catch (e) {
      console.error("[instrumentation] Hermes 反馈学习处理异常:", e);
    } finally {
      learning = false;
    }
  }
  // 启动后延迟 60 秒执行首次处理（避免与应用启动并发）
  setTimeout(() => {
    hermesLearnerTick();
    setInterval(hermesLearnerTick, HERMES_LEARNER_INTERVAL);
  }, 60 * 1000);
  console.log("[instrumentation] Hermes 反馈学习管道已注册（每小时检查一次）");

  // ===== 飞书任务定时同步（每 5 分钟一次） =====
  // 解决"依赖用户访问 Web 端触发同步"的问题，服务端自动保持数据新鲜
  const LARK_SYNC_INTERVAL = 5 * 60 * 1000;
  let syncing = false;
  async function syncLarkTasksTick() {
    if (syncing) return; // 防止重叠执行
    syncing = true;
    try {
      const result = await runSyncAsync();
      if (!result.ok) {
        console.warn("[instrumentation] 飞书任务定时同步失败:", result.error);
      }
    } catch (e) {
      console.error("[instrumentation] 飞书任务定时同步异常:", e);
    } finally {
      syncing = false;
    }
  }
  // 启动后延迟 30 秒执行首次同步（避免与应用启动并发争抢资源）
  setTimeout(() => {
    syncLarkTasksTick();
    setInterval(syncLarkTasksTick, LARK_SYNC_INTERVAL);
  }, 30 * 1000);
  console.log("[instrumentation] 飞书任务定时同步已注册（每 5 分钟）");
}

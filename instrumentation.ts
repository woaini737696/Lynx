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

  // 初始化默认工作流（如果数据库为空，从 .ai-flows.json 迁移或创建默认数据）
  await initializeDefaultFlows();

  await startAllTriggers();
  console.log("[instrumentation] Flows 触发器调度器已启动");

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

// Next.js Instrumentation 钩子
// 在应用启动时执行一次（仅 server side）
// 用于启动 Flows 定时/事件触发器调度器
export async function register(): Promise<void> {
  // 仅在 Node.js 运行时启动（排除 Edge）
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // 动态导入避免 Edge bundle 问题
  const { startAllTriggers } = await import("./src/lib/flow-scheduler");
  const { initializeDefaultFlows } = await import("./src/lib/flow-store");

  // 初始化默认工作流（如果数据库为空，从 .ai-flows.json 迁移或创建默认数据）
  await initializeDefaultFlows();

  await startAllTriggers();
  console.log("[instrumentation] Flows 触发器调度器已启动");
}

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
  const { detectHermesInstall, startHermesAgent } = await import("./src/lib/hermes-client");
  const { prisma } = await import("./src/lib/db");

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

  // ===== Hermes Dashboard 自动启动（端口 9119）=====
  // 用户期望：项目服务启动时连带启动 Hermes Dashboard，保证 /settings 中"打开 Dashboard"可访问
  // 启动条件：
  //   1. hermes-agent 已安装（pip 包检测）
  //   2. 端口 9119 未被占用（避免重复启动）
  //   3. 至少有一个用户的 HermesConfig.autoStart = true（尊重用户意愿，未开启则不自动启动）
  // 失败不阻塞主服务，仅记录日志
  const HERMES_DASHBOARD_PORT = 9119;
  async function autoStartHermesDashboard() {
    try {
      // 1. 检测 hermes-agent 是否已安装
      const detect = await detectHermesInstall();
      if (!detect.installed) {
        console.log("[instrumentation] Hermes Agent 未安装，跳过 Dashboard 自动启动");
        return;
      }

      // 2. 检测端口 9119 是否已被占用（已占用说明 Dashboard 已在运行）
      const isPortInUse = await checkPortInUse(HERMES_DASHBOARD_PORT);
      if (isPortInUse) {
        console.log(`[instrumentation] Hermes Dashboard 端口 ${HERMES_DASHBOARD_PORT} 已被占用，跳过自动启动`);
        return;
      }

      // 3. 检测是否有用户开启了 autoStart
      const autoStartUser = await prisma.hermesConfig.findFirst({
        where: { autoStart: true },
        select: { userId: true },
      });
      if (!autoStartUser) {
        console.log("[instrumentation] 无用户开启 Hermes autoStart，跳过 Dashboard 自动启动");
        return;
      }

      // 4. 启动 Hermes Dashboard
      console.log(`[instrumentation] 自动启动 Hermes Dashboard（端口 ${HERMES_DASHBOARD_PORT}）...`);
      const result = await startHermesAgent(HERMES_DASHBOARD_PORT);
      if (result.success) {
        console.log(`[instrumentation] Hermes Dashboard 已启动（PID ${result.pid}，端口 ${HERMES_DASHBOARD_PORT}）`);
        // 同步更新所有开启 autoStart 的用户配置状态
        await prisma.hermesConfig.updateMany({
          where: { autoStart: true },
          data: {
            status: "running",
            endpoint: `http://localhost:${HERMES_DASHBOARD_PORT}`,
            lastCheckedAt: new Date(),
            lastError: null,
          },
        });
      } else {
        console.warn(`[instrumentation] Hermes Dashboard 自动启动失败：${result.error}`);
        // 记录错误到所有开启 autoStart 的用户配置
        await prisma.hermesConfig.updateMany({
          where: { autoStart: true },
          data: {
            status: "error",
            lastCheckedAt: new Date(),
            lastError: result.error || "自动启动失败",
          },
        });
      }
    } catch (e) {
      console.error("[instrumentation] Hermes Dashboard 自动启动异常:", e);
    }
  }

  // 端口检测函数：尝试 connect 端口，能连上说明被占用
  async function checkPortInUse(port: number): Promise<boolean> {
    try {
      const net = await import("net");
      return new Promise((resolve) => {
        const tester = net.createServer();
        tester.once("error", () => resolve(true)); // 端口被占用
        tester.once("listening", () => {
          tester.close(() => resolve(false)); // 端口空闲
        });
        tester.listen(port);
      });
    } catch {
      return false;
    }
  }

  // 启动后延迟 15 秒执行（在飞书同步之前，确保 Dashboard 尽早可用）
  setTimeout(() => {
    autoStartHermesDashboard();
  }, 15 * 1000);
  console.log("[instrumentation] Hermes Dashboard 自动启动已注册（延迟 15 秒执行）");
}

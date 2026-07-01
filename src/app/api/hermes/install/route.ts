import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import {
  getHermesConfig,
  upsertHermesConfig,
  detectHermesInstall,
  installHermesAgent,
  startHermesAgent,
  stopHermesAgent,
  clearHermesDetectCache,
  testHermesConnection,
} from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/install - 获取安装状态
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const config = await getHermesConfig(auth.user.id);

    // 检测本地安装（服务器=本机时检测真实安装状态）
    let installInfo: { installed: boolean; version?: string; path?: string } = { installed: false };
    try {
      installInfo = await detectHermesInstall();
    } catch {
      // 检测失败不阻塞
    }

    return NextResponse.json({
      status: config?.status || (installInfo.installed ? "installed" : "not_installed"),
      installed: installInfo.installed || config?.status === "installed" || config?.status === "running",
      version: installInfo.version || null,
      path: installInfo.path || null,
      config: config ? {
        enabled: config.enabled,
        endpoint: config.endpoint,
        autoStart: config.autoStart,
        capabilities: config.capabilities,
      } : null,
    });
  } catch (e) {
    logger.error({ err: e }, "获取 Hermes 安装状态失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/hermes/install - 一键安装/启动/停止 HermesAgent
// 在用户本地电脑执行 pip install / spawn dashboard / taskkill
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { action } = body as { action?: string };

    if (action === "install") {
      // 一键安装
      await upsertHermesConfig(auth.user.id, { status: "installing", lastError: null });
      const result = await installHermesAgent();
      clearHermesDetectCache();

      if (result.success) {
        await upsertHermesConfig(auth.user.id, {
          status: "installed",
          installedAt: new Date(),
          lastError: null,
        });
        return NextResponse.json({
          success: true,
          message: "Hermes Agent 安装成功",
          output: result.output?.slice(-500),
        });
      } else {
        await upsertHermesConfig(auth.user.id, {
          status: "error",
          lastError: result.error || "安装失败",
        });
        return NextResponse.json({
          success: false,
          error: result.error || "安装失败",
          output: result.output?.slice(-500),
        }, { status: 500 });
      }
    }

    if (action === "start") {
      // 一键启动 Dashboard
      const result = await startHermesAgent(9119);
      if (result.success) {
        await upsertHermesConfig(auth.user.id, { status: "running", lastError: null });
        return NextResponse.json({
          success: true,
          message: "Hermes Agent Dashboard 已启动",
          pid: result.pid,
        });
      } else {
        await upsertHermesConfig(auth.user.id, {
          status: "error",
          lastError: result.error || "启动失败",
        });
        return NextResponse.json({
          success: false,
          error: result.error || "启动失败",
        }, { status: 500 });
      }
    }

    if (action === "stop") {
      // 一键停止 Dashboard
      const result = await stopHermesAgent(9119);
      if (result.success) {
        await upsertHermesConfig(auth.user.id, { status: "installed", lastError: null });
        return NextResponse.json({
          success: true,
          message: "Hermes Agent Dashboard 已停止",
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.error || "停止失败",
        }, { status: 500 });
      }
    }

    if (action === "status") {
      // 检测连接状态
      const config = await getHermesConfig(auth.user.id);
      if (!config) {
        return NextResponse.json({ connected: false, error: "未配置 Hermes Agent" });
      }
      const result = await testHermesConnection(config);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "未知 action: " + action },
      { status: 400 }
    );
  } catch (e) {
    logger.error({ err: e }, "Hermes install POST 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

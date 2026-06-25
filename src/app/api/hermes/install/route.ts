import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import {
  getHermesConfig,
  upsertHermesConfig,
  detectHermesInstall,
  installHermesAgent,
  startHermesAgent,
  stopHermesAgent,
} from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/install - 获取安装状态
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const config = await getHermesConfig(auth.user.id);
    const detect = await detectHermesInstall();

    // 如果检测到已安装但数据库状态为 not_installed，自动更新
    if (detect.installed && config?.status === "not_installed") {
      await upsertHermesConfig(auth.user.id, {
        status: "installed",
        installedAt: new Date(),
      });
    }

    return NextResponse.json({
      status: detect.installed ? "installed" : (config?.status || "not_installed"),
      installed: detect.installed,
      version: detect.version,
      path: detect.path,
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

// POST /api/hermes/install - 一键安装/启动 Hermes Agent
// body: { action: "install" | "start" | "stop", port?: number }
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { action, port } = body as { action?: string; port?: number };

    if (action === "install") {
      // 标记为安装中
      await upsertHermesConfig(auth.user.id, {
        status: "installing",
        lastError: null,
      });

      const result = await installHermesAgent();
      if (result.success) {
        await upsertHermesConfig(auth.user.id, {
          status: "installed",
          installedAt: new Date(),
          lastCheckedAt: new Date(),
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
          lastError: result.error,
          lastCheckedAt: new Date(),
        });
        return NextResponse.json(
          { success: false, error: result.error || "安装失败" },
          { status: 500 }
        );
      }
    }

    if (action === "start") {
      const config = await getHermesConfig(auth.user.id);
      if (!config) {
        return NextResponse.json(
          { error: "请先安装 Hermes Agent" },
          { status: 400 }
        );
      }
      const targetPort = port || 9119; // Hermes Dashboard 默认端口
      const result = await startHermesAgent(targetPort);
      if (result.success) {
        await upsertHermesConfig(auth.user.id, {
          status: "running",
          endpoint: `http://localhost:${targetPort}`,
          lastCheckedAt: new Date(),
          lastError: null,
        });
        return NextResponse.json({
          success: true,
          message: `Hermes Agent Dashboard 已启动（端口 ${targetPort}）`,
          pid: result.pid,
        });
      } else {
        await upsertHermesConfig(auth.user.id, {
          status: "error",
          lastError: result.error,
          lastCheckedAt: new Date(),
        });
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        );
      }
    }

    if (action === "stop") {
      const config = await getHermesConfig(auth.user.id);
      const targetPort = port || 9119;
      const result = await stopHermesAgent(targetPort);
      await upsertHermesConfig(auth.user.id, {
        status: "installed",
        lastCheckedAt: new Date(),
        lastError: result.success ? null : result.error,
      });
      return NextResponse.json({
        success: result.success,
        message: result.success ? "Hermes Agent 已停止" : (result.error || "停止失败"),
      });
    }

    return NextResponse.json(
      { error: "未知操作，支持 install | start | stop" },
      { status: 400 }
    );
  } catch (e) {
    logger.error({ err: e }, "Hermes 安装/启动操作失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import {
  getHermesConfig,
  testHermesConnection,
  detectHermesInstall,
} from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/status - 获取 Hermes Agent 完整状态
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const config = await getHermesConfig(auth.user.id);
    const detect = await detectHermesInstall();

    let connected = false;
    let version: string | undefined;
    let capabilities: string[] = [];
    let connectionError: string | undefined;

    // 如果有配置且状态为 running，测试连接
    if (config && config.status === "running") {
      const testResult = await testHermesConnection(config);
      connected = testResult.connected;
      version = testResult.version;
      capabilities = testResult.capabilities || [];
      connectionError = testResult.error;
    }

    return NextResponse.json({
      installed: detect.installed,
      installVersion: detect.version,
      installPath: detect.path,
      config: config ? {
        enabled: config.enabled,
        endpoint: config.endpoint,
        autoStart: config.autoStart,
        capabilities: config.capabilities,
        status: config.status,
        installedAt: config.installedAt,
        lastCheckedAt: config.lastCheckedAt,
        lastError: config.lastError,
      } : null,
      connected,
      version,
      capabilities,
      connectionError,
    });
  } catch (e) {
    logger.error({ err: e }, "获取 Hermes 状态失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

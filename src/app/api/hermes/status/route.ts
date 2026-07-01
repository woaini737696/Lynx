import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getHermesConfig } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/status - 获取 Hermes Agent 配置（状态由前端浏览器直连本机探测，不在服务器端探测）
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const config = await getHermesConfig(auth.user.id);

    return NextResponse.json({
      // installed/version/connected 由前端浏览器直连本机 Dashboard (127.0.0.1:9119) 探测
      // 服务器端不返回服务器本机的安装信息（会误导用户）
      installed: false,
      installVersion: undefined,
      installPath: undefined,
      connected: false,
      version: undefined,
      capabilities: [],
      connectionError: undefined,
      // 仅返回 DB 中的配置项（enabled/autoStart/endpoint/status 等持久化配置）
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
    });
  } catch (e) {
    logger.error({ err: e }, "获取 Hermes 状态失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

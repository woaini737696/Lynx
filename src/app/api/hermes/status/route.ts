import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getHermesConfig } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

const WS_GATEWAY_URL = process.env.WS_GATEWAY_URL || "http://localhost:3001";

// GET /api/hermes/status - 获取 Hermes Agent 配置（状态由前端浏览器直连本机探测，不在服务器端探测）
// 附带返回 WS 网关中的在线设备列表（含 deviceType），供前端聚合 Dashboard 可用性
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const config = await getHermesConfig(auth.user.id);

    // 查询 WS 网关的在线设备列表（含 deviceType）
    // 网关不可达时静默降级为空数组，不影响状态展示
    let devices: Array<{ channelId: string; deviceName?: string; deviceType?: string }> = [];
    try {
      const resp = await fetch(
        `${WS_GATEWAY_URL}/devices?userId=${auth.user.id}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.devices)) {
          devices = data.devices;
        }
      }
    } catch (e) {
      logger.warn({ err: e }, "查询在线设备失败（WS 网关可能未启动）");
    }

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
      // 在线设备列表（来自 WS 网关），前端用于判断是否有桌面端在线
      // 跨机器场景下浏览器探测 127.0.0.1:9119 必然失败，
      // 通过此字段可获知"另一台机器上的桌面端正在运行 Dashboard"
      devices,
    });
  } catch (e) {
    logger.error({ err: e }, "获取 Hermes 状态失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

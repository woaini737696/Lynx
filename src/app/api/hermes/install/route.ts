import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getHermesConfig, testHermesConnection } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/install - 获取安装状态
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const config = await getHermesConfig(auth.user.id);

    return NextResponse.json({
      status: config?.status || "not_installed",
      installed: config?.status === "installed" || config?.status === "running",
      version: null,  // 版本号由前端浏览器直连本机 Dashboard 获取，不在服务器端探测
      path: null,
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

// POST /api/hermes/install - 仅保留 status 探测，删除 install/start/stop（违反架构约束）
// 真正的安装/启动/停止操作走 /api/hermes/dispatch 委托桌面端执行
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { action } = body as { action?: string };

    if (action === "status") {
      // 检测连接状态（仅用于服务器本机测试，非用户本机）
      const config = await getHermesConfig(auth.user.id);
      if (!config) {
        return NextResponse.json({ connected: false, error: "未配置 Hermes Agent" });
      }
      const result = await testHermesConnection(config);
      return NextResponse.json(result);
    }

    // install / start / stop 已废弃，应通过 /api/hermes/dispatch 委托桌面端执行
    if (action === "install" || action === "start" || action === "stop") {
      return NextResponse.json({
        error: "此操作已迁移到 /api/hermes/dispatch。请使用 Web 端「一键安装/启动/停止」按钮，会自动委托桌面端执行。",
      }, { status: 400 });
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

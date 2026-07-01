import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getHermesConfig } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/install - 获取安装状态
// 服务器不检测本地 hermes 安装（服务器禁止安装 hermes）
// 仅返回数据库中的配置状态，桌面端/Web端会通过 WS 上报真实本地状态
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const config = await getHermesConfig(auth.user.id);

    return NextResponse.json({
      // 服务器端不检测本地安装，仅返回数据库状态
      // 客户端（桌面端或 Web 端）会通过 WS 网关上报真实本地安装状态
      status: config?.status || "not_installed",
      installed: config?.status === "installed" || config?.status === "running",
      version: null, // 服务器不知道客户端版本
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

// POST /api/hermes/install - 服务器不执行安装/启动/停止（安全架构）
//
// 架构说明（2026-07-01 修正）：
// - HermesAgent 只能安装在用户本地电脑，服务器禁止安装（安全漏洞）
// - 桌面端：通过 Tauri command 在用户本地执行 pip install
// - Web 端：浏览器无法直接执行 pip，通过安装引导弹窗（探测本地 Dashboard + 复制命令）
//   或通过本地 Dashboard HTTP API (127.0.0.1:9119/api/install) 执行
// - 两端共用同一个 HermesAgent，只需在一端安装
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { action } = body as { action?: string };

    // 服务器不执行任何本地操作，返回中性提示（不强制下载桌面端）
    const actionLabel = action === "install" ? "安装" : action === "start" ? "启动" : action === "stop" ? "停止" : "相关操作";
    return NextResponse.json({
      success: false,
      error:
        `HermesAgent 只能${actionLabel}在您的本地电脑（服务器禁止执行，安全架构）。\n\n` +
        `您可以通过以下方式${actionLabel}：\n` +
        `1. 桌面端：打开「设置 → Lynx Agent」点击「一键${actionLabel}」\n` +
        `2. Web 端：点击「一键安装」打开安装引导弹窗，或直接在命令行运行：\n` +
        `   pip install hermes-agent\n` +
        `   hermes dashboard --port 9119\n` +
        `两端共用同一个 HermesAgent，只需在一端安装。`,
    }, { status: 400 });
  } catch (e) {
    logger.error({ err: e }, "Hermes install POST 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

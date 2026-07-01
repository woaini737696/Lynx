import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getHermesConfig } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/install - 获取安装状态
// 服务器不检测本地 hermes 安装（服务器禁止安装 hermes）
// 仅返回数据库中的配置状态，桌面端会通过 WS 上报真实本地状态
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const config = await getHermesConfig(auth.user.id);

    return NextResponse.json({
      // 服务器端不检测本地安装，仅返回数据库状态
      // 桌面端客户端会通过 WS 网关上报真实本地安装状态
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
      // 提示前端：服务器无法执行 install/start/stop，需要桌面端
      requiresDesktop: true,
    });
  } catch (e) {
    logger.error({ err: e }, "获取 Hermes 安装状态失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/hermes/install - 拒绝在服务器执行 install/start/stop
//
// 架构说明（2026-07-01 修正）：
// - HermesAgent 只能安装在用户本地电脑，服务器禁止安装（安全漏洞）
// - install/start/stop 必须通过桌面端客户端 Tauri command 在用户本地执行
// - 浏览器访问 Web 端时，这些操作应直接提示下载桌面端
// - 仅保留 status 查询（从数据库读取，不触碰服务器文件系统）
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { action } = body as { action?: string };

    // 所有涉及本地操作的动作都拒绝在服务器执行
    return NextResponse.json({
      success: false,
      error:
        "HermesAgent 只能安装在您的本地电脑，服务器不执行安装/启动/停止操作（安全架构）。\n\n" +
        "请下载并安装 Lynx 桌面端客户端，在桌面端的「设置 → Lynx Agent」中执行" +
        (action === "install" ? "安装" : action === "start" ? "启动" : action === "stop" ? "停止" : "相关操作") +
        "。\n" +
        "下载地址：https://ai.lynxdo.com/downloads",
      requiresDesktop: true,
    }, { status: 400 });
  } catch (e) {
    logger.error({ err: e }, "Hermes install POST 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

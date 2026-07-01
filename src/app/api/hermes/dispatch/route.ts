// Web 端委托桌面端执行特殊命令的 API
// 接收前端请求，通过 WS 网关下发到用户在线的桌面端设备
// 桌面端 ws_client.rs 识别 __LYNN_CMD__: 前缀并执行对应操作

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { dispatchRemoteCommand } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-dispatch");

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const command = typeof body?.command === "string" ? body.command.trim() : "";

    if (!command) {
      return NextResponse.json({ error: "command 不能为空" }, { status: 400 });
    }

    // 只允许 __LYNN_CMD__: 前缀的特殊命令（安全限制）
    if (!command.startsWith("__LYNN_CMD__:")) {
      return NextResponse.json({ error: "仅允许系统命令" }, { status: 400 });
    }

    logger.info({ userId: auth.user.id, command }, "委托桌面端执行命令");

    // 通过 WS 网关下发到用户在线设备，等待结果
    const result = await dispatchRemoteCommand(
      auth.user.id,
      command,
      180, // 安装/升级可能需要较长时间
    );

    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "委托执行命令失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

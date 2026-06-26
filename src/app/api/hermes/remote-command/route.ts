// 远程指令下发 API（安卓端/Web端 → 云端 → PC 端）
//
// 路由：
//   POST /api/hermes/remote-command          - 下发远程指令到目标 PC
//   GET  /api/hermes/remote-command?id=xx    - 查询单条指令状态
//   GET  /api/hermes/remote-command?list=1   - 查询当前用户的指令历史
//
// 工作流程：
//   1. 安卓端调用 POST 创建并下发指令
//   2. 云端写入 RemoteCommand 表（status=pending）
//   3. 通过 HTTP 调用 WS 网关 /dispatch 接口转发到目标 PC
//   4. PC 执行后通过 WS 回传进度，网关更新 RemoteCommand 表
//   5. 安卓端通过 GET 查询或 WS 订阅获取执行结果

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";
import { randomUUID } from "crypto";

const logger = getLogger("remote-command-api");

const WS_GATEWAY_URL = process.env.WS_GATEWAY_URL || "http://localhost:3001";

// 下发远程指令
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const command = typeof body?.command === "string" ? body.command.trim() : "";
    const targetDeviceId = typeof body?.targetDeviceId === "string" ? body.targetDeviceId : undefined;
    const source = typeof body?.source === "string" ? body.source : "web"; // web | android | ios

    if (!command) {
      return NextResponse.json({ error: "指令内容不能为空" }, { status: 400 });
    }

    const commandId = randomUUID();

    // 1. 写入数据库
    const record = await prisma.remoteCommand.create({
      data: {
        commandId,
        userId: auth.user.id,
        command,
        targetDeviceId: targetDeviceId || null,
        source,
        status: "pending",
        route: "pending", // 由 PC 端执行后回填
      },
    });

    // 2. 通过 HTTP 调用 WS 网关下发到目标 PC
    let dispatched = false;
    let dispatchReason = "";
    try {
      const resp = await fetch(`${WS_GATEWAY_URL}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.user.id,
          command,
          commandId,
          targetDeviceId,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await resp.json().catch(() => ({}));
      dispatched = !!data.dispatched;
      dispatchReason = data.reason || "";
    } catch (e) {
      dispatchReason = "WS 网关不可达：" + (e as Error).message;
      logger.warn({ err: e }, "WS 网关调用失败");
    }

    // 3. 更新指令状态
    if (!dispatched) {
      await prisma.remoteCommand.update({
        where: { id: record.id },
        data: { status: "failed", error: dispatchReason || "无在线 PC" },
      });
      return NextResponse.json({
        commandId,
        success: false,
        error: dispatchReason || "没有在线的 PC，请先在电脑上启动桌面端",
      }, { status: 409 });
    }

    logger.info({ commandId, userId: auth.user.id, source }, "远程指令已下发");
    return NextResponse.json({
      commandId,
      success: true,
      status: "dispatched",
    });
  } catch (e) {
    logger.error({ err: e }, "下发远程指令失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 查询指令状态/历史
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const list = url.searchParams.get("list");

    // 查询单条指令
    if (id) {
      const cmd = await prisma.remoteCommand.findFirst({
        where: { commandId: id, userId: auth.user.id },
      });
      if (!cmd) {
        return NextResponse.json({ error: "指令不存在" }, { status: 404 });
      }
      return NextResponse.json({ command: cmd });
    }

    // 查询历史列表（默认 20 条）
    const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 100);
    const status = url.searchParams.get("status");

    const where: { userId: string; status?: string } = { userId: auth.user.id };
    if (status) where.status = status;

    const commands = await prisma.remoteCommand.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ commands });
  } catch (e) {
    logger.error({ err: e }, "查询远程指令失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

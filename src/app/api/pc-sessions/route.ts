// PC 在线状态管理 API
//
// 路由：
//   GET  /api/pc-sessions         - 获取当前用户的 PC 在线设备列表
//   DELETE /api/pc-sessions?id=xx - 移除指定的 PC 会话记录
//   POST /api/pc-sessions/cleanup - 清理已离线超过 7 天的会话记录
//
// 配合 WS 网关（scripts/start-ws-gateway.js）使用：
//   - WS 网关负责实时维护在线状态
//   - 本路由提供查询/管理接口给前端

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("pc-sessions-api");

// 获取当前用户的 PC 会话列表（默认仅在线，?includeOffline=true 返回全部）
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const url = new URL(req.url);
    const includeOffline = url.searchParams.get("includeOffline") === "true";
    const onlyOnline = url.searchParams.get("online") === "true";

    const where: { userId: string; status?: { in: string[] } } = {
      userId: auth.user.id,
    };
    if (onlyOnline) {
      where.status = { in: ["online"] };
    } else if (!includeOffline) {
      where.status = { in: ["online", "idle"] };
    }

    const sessions = await prisma.pcSession.findMany({
      where,
      orderBy: { lastHeartbeat: "desc" },
      take: 50,
      select: {
        id: true,
        deviceName: true,
        agentVersion: true,
        capabilities: true,
        wsChannelId: true,
        status: true,
        authMode: true,
        lastHeartbeat: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      sessions,
      onlineCount: sessions.filter((s) => s.status === "online").length,
    });
  } catch (e) {
    logger.error({ err: e }, "查询 PC 会话失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 删除指定的 PC 会话记录（仅清理数据库记录，不影响实际 WS 连接）
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少 id 参数" }, { status: 400 });
    }

    // 仅允许删除自己的会话
    const session = await prisma.pcSession.findFirst({
      where: { id, userId: auth.user.id },
    });
    if (!session) {
      return NextResponse.json({ error: "会话不存在或无权限" }, { status: 404 });
    }

    await prisma.pcSession.delete({ where: { id } });
    logger.info({ sessionId: id }, "删除 PC 会话记录");
    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "删除 PC 会话失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

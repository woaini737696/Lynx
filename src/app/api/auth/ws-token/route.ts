// GET /api/auth/ws-token
// 为 Web 端签发临时 JWT，用于 WS 网关认证
// Web 端 use-device-ws.ts 原先用 `user:<id>` 被 ws-gateway 拒绝（仅接受 JWT 三段式）
// 此端点用 session 认证后签发 JWT，Web 端用该 JWT 注册 WS

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { signToken } from "@/lib/jwt";
import { getLogger } from "@/lib/logger";

const logger = getLogger("auth-ws-token");

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    // 签发 JWT（与 /api/auth/token 相同的签发逻辑，但仅用于 WS 认证）
    const token = await signToken({
      id: auth.user.id,
      username: auth.user.username,
      role: auth.user.role,
      permissionVersion: auth.user.permissionVersion,
    });

    return NextResponse.json({ token });
  } catch (e) {
    logger.error({ err: e }, "WS token 签发失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

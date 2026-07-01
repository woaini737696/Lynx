// 查询用户在线设备列表
// 通过 WS 网关 /devices 接口获取当前用户的在线设备

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("devices-api");

const WS_GATEWAY_URL = process.env.WS_GATEWAY_URL || "http://localhost:3001";

export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const resp = await fetch(`${WS_GATEWAY_URL}/devices?userId=${auth.user.id}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      return NextResponse.json({ devices: [], error: "WS 网关不可达" });
    }

    const data = await resp.json();
    const devices = Array.isArray(data.devices) ? data.devices : [];

    return NextResponse.json({ devices });
  } catch (e) {
    logger.warn({ err: e }, "查询在线设备失败");
    return NextResponse.json({ devices: [], error: "查询失败" });
  }
}

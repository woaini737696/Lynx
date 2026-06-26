// Tauri Updater 端点
//
// Tauri 桌面端启动后会定期请求本端点检查更新。
// 协议参考：https://v2.tauri.app/plugin/updater/
//
// 请求：
//   GET /api/desktop/update
//   Headers:
//     X-Tauri-Target: <target-triple>    例如 x86_64-pc-windows-msvc
//     X-Tauri-Version: <current-version> 例如 1.0.0
//     User-Agent: Tauri Updater
//
// 响应（无更新）：
//   204 No Content
//
// 响应（有更新）：
//   200 OK
//   {
//     "version": "1.0.1",
//     "pub_date": "2026-06-27T10:00:00Z",
//     "url": "https://app.lynnhub.com/releases/lynnhub-1.0.1-windows.msi",
//     "signature": "<minisign签名>",
//     "notes": "修复..."
//   }

import { NextRequest, NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";

const logger = getLogger("desktop-update-api");

// 最新版本配置（部署时通过环境变量覆盖）
// 当前为开发期占位实现：返回 204 No Content 表示无更新
export async function GET(req: NextRequest) {
  try {
    const currentVersion = req.headers.get("x-tauri-version") || "0.0.0";
    const target = req.headers.get("x-tauri-target") || "unknown";

    const latestVersion = process.env.DESKTOP_LATEST_VERSION || "1.0.0";
    const downloadUrl = process.env.DESKTOP_DOWNLOAD_URL || "";
    const signature = process.env.DESKTOP_SIGNATURE || "";
    const releaseNotes = process.env.DESKTOP_RELEASE_NOTES || "LynnHub 桌面端更新";

    logger.info({ currentVersion, target, latestVersion }, "检查桌面端更新");

    // 版本比较（简化实现）
    if (!isNewer(latestVersion, currentVersion)) {
      return new NextResponse(null, { status: 204 });
    }

    // 必须有下载 URL 才能返回更新
    if (!downloadUrl) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({
      version: latestVersion,
      pub_date: new Date().toISOString(),
      url: downloadUrl,
      signature,
      notes: releaseNotes,
    });
  } catch (e) {
    logger.error({ err: e }, "桌面端更新检查失败");
    return new NextResponse(null, { status: 500 });
  }
}

// 简单语义化版本比较：v1 > v2 返回 true
function isNewer(v1: string, v2: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  const [a1, a2, a3] = parse(v1);
  const [b1, b2, b3] = parse(v2);
  if (a1 !== b1) return a1 > b1;
  if (a2 !== b2) return a2 > b2;
  return a3 > b3;
}

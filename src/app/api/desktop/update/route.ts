// Tauri Updater 端点
//
// Tauri 桌面端启动后会定期请求本端点检查更新。
// 协议参考：https://v2.tauri.app/plugin/updater/
//
// 请求：
//   GET /api/desktop/update
//   Headers:
//     X-Tauri-Target: <target-triple>    例如 x86_64-pc-windows-msvc
//     X-Tauri-App-Version: <current-ver> 例如 1.0.0（Tauri 2.x）
//     X-Tauri-Version: <current-version> 兼容旧头
//     User-Agent: Tauri Updater
//
// 响应（无更新）：
//   204 No Content
//
// 响应（有更新）：
//   200 OK
//   {
//     "version": "1.0.1",
//     "notes": "更新说明",
//     "pub_date": "2026-06-27T00:00:00Z",
//     "platforms": {
//       "windows-x86_64": {
//         "signature": "",
//         "url": "https://gitee.com/.../Lynx_1.0.1_x64-setup.exe"
//       }
//     }
//   }

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { getLogger } from "@/lib/logger";

const logger = getLogger("desktop-update-api");

// 读取桌面端 package.json 的版本号作为"最新发布版本"
function getLatestVersion(): string {
  // 优先用环境变量覆盖（部署发布新版本时设置）
  if (process.env.DESKTOP_LATEST_VERSION) {
    return process.env.DESKTOP_LATEST_VERSION;
  }
  try {
    const pkgPath = join(process.cwd(), "desktop-native", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version || "1.0.0";
  } catch (e) {
    logger.warn({ err: e }, "读取 desktop-native/package.json 失败，回退到 1.0.0");
    return "1.0.0";
  }
}

// 将 Tauri target-triple 映射为 updater platforms 键
// 例如 x86_64-pc-windows-msvc → windows-x86_64
function targetToPlatform(target: string): string | null {
  const t = target.toLowerCase();
  if (t.includes("windows")) {
    if (t.includes("aarch64")) return "windows-aarch64";
    return "windows-x86_64";
  }
  if (t.includes("darwin")) {
    if (t.includes("aarch64")) return "darwin-aarch64";
    return "darwin-x86_64";
  }
  if (t.includes("linux")) {
    if (t.includes("aarch64")) return "linux-aarch64";
    return "linux-x86_64";
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    // Tauri 2.x 用 X-Tauri-App-Version，兼容旧版 X-Tauri-Version
    const currentVersion =
      req.headers.get("x-tauri-app-version") ||
      req.headers.get("x-tauri-version") ||
      "0.0.0";
    const target = req.headers.get("x-tauri-target") || "unknown";

    const latestVersion = getLatestVersion();
    const downloadUrl = process.env.DESKTOP_DOWNLOAD_URL || "";
    const signature = process.env.DESKTOP_SIGNATURE || "";
    const releaseNotes =
      process.env.DESKTOP_RELEASE_NOTES || "Lynx 桌面端更新";

    logger.info({ currentVersion, target, latestVersion }, "检查桌面端更新");

    // 版本比较：latestVersion 不高于 currentVersion 时返回 204
    if (!isNewer(latestVersion, currentVersion)) {
      return new NextResponse(null, { status: 204 });
    }

    // 必须有下载 URL 才能返回更新
    if (!downloadUrl) {
      return new NextResponse(null, { status: 204 });
    }

    // 构建 platforms 映射：优先当前请求平台，回退 windows-x86_64
    const platformKey = targetToPlatform(target) || "windows-x86_64";
    const platforms: Record<string, { signature: string; url: string }> = {
      [platformKey]: {
        signature,
        url: downloadUrl,
      },
    };
    // 兜底：如果当前平台不是 windows-x86_64，也一并补上（确保 Windows 主平台可更新）
    if (!platforms["windows-x86_64"]) {
      platforms["windows-x86_64"] = { signature, url: downloadUrl };
    }

    return NextResponse.json({
      version: latestVersion,
      notes: releaseNotes,
      pub_date: new Date().toISOString(),
      platforms,
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

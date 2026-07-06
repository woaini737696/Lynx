// 桌面端/安卓 APP 版本与下载地址（供 Electron 自动更新检查 + 官网动态获取）
//
// 下载源已切换到 Gitee Release 附件（公开仓库 lynn-hub-release），
// 相比服务器直存：下载更快、节省服务器流量费用。
//
// GET /api/hermes/app-version
// 响应：
//   {
//     "version": "1.0.2",
//     "downloadUrl": "https://gitee.com/.../Lynx_1.0.2_x64-setup.exe",
//     "androidDownloadUrl": "https://gitee.com/.../Lynx-android.apk",
//     "releaseNotes": "..."
//   }

import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { getLogger } from "@/lib/logger";

const logger = getLogger("app-version-api");

// P0 修复：强制动态渲染，避免 Next.js 构建时缓存响应
// 不加此行，standalone 构建后 GET 响应会被缓存，桌面端检查更新永远拿到旧版本号
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Gitee Release 公开下载基址（仓库 lynn-hub-release，已公开）
const GITEE_RELEASE_BASE =
  "https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub-release/releases/download";

export async function GET() {
  try {
    // 读取 desktop-electron/package.json 的版本号作为"最新发布版本"
    let version = "1.0.0";
    let releaseNotes = "奇思桌面端更新";
    try {
      const pkgPath = join(process.cwd(), "desktop-electron", "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      version = pkg.version || version;
    } catch (e) {
      logger.warn({ err: e }, "读取 desktop-electron/package.json 失败，回退默认版本");
    }

    // 环境变量覆盖（发布新版本时设置，优先级最高）
    const envVersion = process.env.DESKTOP_LATEST_VERSION;
    if (envVersion) version = envVersion;
    const envNotes = process.env.DESKTOP_RELEASE_NOTES;
    if (envNotes) releaseNotes = envNotes;

    // 构造 Gitee Release 下载链接（tag 与 version 一致：v1.0.9）
    // P0 修复：artifactName 已改为 QisiSetup-${version}.exe（package.json 配置）
    const tag = `v${version}`;
    const downloadUrl = `${GITEE_RELEASE_BASE}/${tag}/QisiSetup-${version}.exe`;
    const androidDownloadUrl = `${GITEE_RELEASE_BASE}/${tag}/Lynx-android.apk`;

    return NextResponse.json({
      version,
      downloadUrl,
      androidDownloadUrl,
      releaseNotes,
      publishedAt: new Date().toISOString(),
    });
  } catch (e) {
    logger.error({ err: e }, "获取应用版本失败");
    return NextResponse.json(
      { error: "获取版本信息失败" },
      { status: 500 }
    );
  }
}

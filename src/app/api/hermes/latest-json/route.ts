// HermesAgent latest.json 代理端点
//
// 桌面端 installer.rs / Web 端 hermes-client.ts 通过本端点读取服务器
// public/downloads/latest.json，避免直接请求静态文件路径因 Nginx 配置
// 问题导致连接异常重置（error 10054）。
//
// GET /api/hermes/latest-json → 透传 latest.json 内容

import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-latest-json-api");

// 使用 Node.js Runtime（避免 Edge Runtime 不支持 fs）
export const runtime = "nodejs";
// 每次都读取最新文件内容（发布新版本后立即生效）
export const dynamic = "force-dynamic";

// GET /api/hermes/latest-json - 公开接口，无需认证（与静态文件等价）
export async function GET() {
  try {
    const filePath = join(process.cwd(), "public", "downloads", "latest.json");

    if (!existsSync(filePath)) {
      logger.warn({ filePath }, "latest.json 文件不存在");
      return NextResponse.json(
        { error: "latest.json 不存在" },
        { status: 404 }
      );
    }

    const content = readFileSync(filePath, "utf-8");

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (e) {
    logger.error({ err: e }, "读取 latest.json 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// HermesAgent wheel 文件下载代理端点
//
// 桌面端 installer.rs / Web 端 hermes-client.ts 通过本端点下载服务器
// public/downloads/ 目录下的 wheel 文件，避免直接请求静态文件路径因
// Nginx 配置问题导致连接异常重置（error 10054）。
//
// GET /api/hermes/download-wheel?file=hermes_agent-0.18.0-py3-none-any.whl
//   → 流式返回 wheel 文件二进制内容

import { NextRequest, NextResponse } from "next/server";
import { createReadStream, existsSync, statSync } from "fs";
import { join, basename } from "path";
import { Readable } from "stream";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-download-wheel-api");

// 使用 Node.js Runtime（支持 createReadStream）
export const runtime = "nodejs";
// 动态渲染（响应内容随查询参数变化）
export const dynamic = "force-dynamic";

// GET /api/hermes/download-wheel?file=xxx.whl - 公开接口，无需认证
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileParam = searchParams.get("file") || "";

    // 安全校验：只允许 .whl 文件名，禁止路径穿越（剔除 .. 和路径分隔符）
    const safeName = basename(fileParam);
    if (!safeName || !safeName.endsWith(".whl") || safeName !== fileParam) {
      logger.warn({ fileParam }, "非法 wheel 文件名请求");
      return NextResponse.json(
        { error: "非法文件名" },
        { status: 400 }
      );
    }

    const filePath = join(process.cwd(), "public", "downloads", safeName);

    if (!existsSync(filePath)) {
      logger.warn({ filePath }, "wheel 文件不存在");
      return NextResponse.json(
        { error: "wheel 文件不存在" },
        { status: 404 }
      );
    }

    const stat = statSync(filePath);
    const fileSize = stat.size;

    // 流式返回文件内容（避免大文件全量载入内存）
    const nodeStream = createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    logger.info({ safeName, fileSize }, "开始流式返回 wheel 文件");

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(fileSize),
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (e) {
    logger.error({ err: e }, "wheel 文件下载失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

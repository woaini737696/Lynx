import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/**
 * 服务端日志读取 API
 * 读取 PM2 out.log 的最后 N 行，用于诊断面板导出
 *
 * GET /api/logs/server?limit=200
 * 返回 { logs: Array<{ ts, raw }> }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 1000);

    // PM2 日志路径（与 ecosystem.config.cjs 一致）
    const logPath = process.env.PM2_LOG_PATH || "/opt/lynx/logs/out.log";

    // 本地开发环境：日志文件不存在时返回空数组
    if (!existsSync(logPath)) {
      return NextResponse.json({
        success: true,
        logs: [],
        note: `日志文件 ${logPath} 不存在（本地开发环境无 PM2 日志）`,
      });
    }

    const content = await readFile(logPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    // 取最后 N 行
    const tail = lines.slice(-limit);

    // 解析每行，提取时间戳（PM2 日志格式：YYYY-MM-DD HH:mm:ss Z [level] ...）
    const logs = tail.map((raw) => {
      const match = raw.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4})/);
      return {
        ts: match ? match[1] : null,
        raw,
      };
    });

    return NextResponse.json({
      success: true,
      logs,
      total: lines.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "读取服务端日志失败",
        logs: [],
      },
      { status: 500 }
    );
  }
}

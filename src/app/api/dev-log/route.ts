import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

// GET /api/dev-log
// 读取项目根目录的 DEV_LOG.md 文件内容
export async function GET() {
  try {
    const logPath = path.join(process.cwd(), "DEV_LOG.md");
    const content = fs.readFileSync(logPath, "utf-8");
    return NextResponse.json({ content, path: "DEV_LOG.md" });
  } catch (e) {
    return NextResponse.json(
      { error: "读取开发日志失败：" + (e as Error).message },
      { status: 500 }
    );
  }
}

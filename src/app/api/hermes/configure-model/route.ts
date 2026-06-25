import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import {
  configureHermesModel,
  isHermesModelConfigured,
} from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// POST /api/hermes/configure-model - 一键配置 Hermes 的 LLM 模型
// 复用 LynnHub 的 DeepSeek API Key，写入 Hermes 的 .env 并设置默认模型
export async function POST() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const result = await configureHermesModel();
    if (result.success) {
      logger.info({ configured: result.configured }, "Hermes 模型配置成功");
      return NextResponse.json({
        success: true,
        configured: result.configured,
        message: `已配置 ${result.configured?.provider} / ${result.configured?.model}`,
      });
    }
    return NextResponse.json(
      { success: false, error: result.error || "配置失败" },
      { status: 400 }
    );
  } catch (e) {
    logger.error({ err: e }, "Hermes 模型配置失败");
    return NextResponse.json(
      { success: false, error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// GET /api/hermes/configure-model - 查询 Hermes 模型配置状态
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const status = await isHermesModelConfigured();
    return NextResponse.json({ success: true, ...status });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

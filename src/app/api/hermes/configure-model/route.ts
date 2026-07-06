import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import {
  configureHermesModel,
  isHermesModelConfigured,
} from "@/lib/hermes-client";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// POST /api/hermes/configure-model - 一键配置 Hermes 的 LLM 模型
// body: { provider?: "deepseek" | "mimo" | "auto" }
// 复用奇思的 DeepSeek / MiMo API Key，写入 Hermes 的 .env 并设置默认模型
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const provider = (body as { provider?: string })?.provider;

    // 校验 provider 参数
    let normalizedProvider: "deepseek" | "mimo" | "auto" = "auto";
    if (provider === "deepseek" || provider === "mimo" || provider === "auto") {
      normalizedProvider = provider;
    } else if (provider) {
      return NextResponse.json(
        { success: false, error: "provider 参数无效，可选值：deepseek | mimo | auto" },
        { status: 400 }
      );
    }

    const result = await configureHermesModel(normalizedProvider);
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

// GET /api/hermes/configure-model - 查询 Hermes 模型配置状态与可用模型
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const status = await isHermesModelConfigured();

    // 从 AISetting 获取可用模型列表与默认 provider
    let setting: Awaited<ReturnType<typeof prisma.aISetting.findFirst>> = null;
    try {
      setting = await prisma.aISetting.findFirst();
    } catch {
      // 数据库读取失败，忽略
    }

    const availableModels: Array<{
      provider: string;
      model: string;
      configured: boolean;
    }> = [];
    if (setting?.deepseekApiKey) {
      availableModels.push({
        provider: "deepseek",
        model: setting.deepseekModel || "deepseek-chat",
        configured: true,
      });
    }
    if (setting?.mimoApiKey) {
      availableModels.push({
        provider: "mimo",
        model: setting.mimoModel || "mimo-chat",
        configured: true,
      });
    }

    return NextResponse.json({
      success: true,
      ...status,
      defaultProvider: setting?.defaultProvider || "auto",
      availableModels,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

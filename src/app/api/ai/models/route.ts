import { NextResponse } from "next/server";
import {
  listAvailableProviders,
  listAvailableModels,
  getDefaultProvider,
  type LLMProvider,
} from "@/lib/ai-provider";

// GET /api/ai/models
// 返回可用的 LLM provider 列表、默认 provider，以及模型变体目录与推理模式
export async function GET() {
  try {
    const providers = listAvailableProviders();
    const defaultProvider: LLMProvider = getDefaultProvider();
    const catalog = listAvailableModels();

    return NextResponse.json({
      // 扁平 provider 列表（向后兼容）
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        model: p.model,
        available: p.available,
      })),
      default: defaultProvider,
      // 增强目录：provider 下的模型变体 + 推理模式
      catalog: {
        providers: catalog.providers,
        reasoningModes: catalog.reasoningModes,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "获取模型列表失败：" + (e as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasAIEmbedding } from "@/lib/ai";
import { requireAdmin } from "@/lib/auth-utils";
import { refreshAISettings } from "@/lib/ai-provider";
import { getLogger } from "@/lib/logger";

const logger = getLogger("settings-api");

/** 将 API Key 做 mask 处理：只保留前 3 位 + 后 4 位，中间用 **** 替代 */
function maskApiKey(key: string): string {
  if (!key) return "";
  // 短 key 直接返回 ****
  if (key.length <= 7) return "****";
  return `${key.slice(0, 3)}****${key.slice(-4)}`;
}

/**
 * 获取系统配置状态（不暴露 key 本身，只返回是否已配置 + mask 后的值）
 * 设置页面需要实时数据，使用 no-store 禁用缓存
 */
export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    // 检测数据库连接
    let dbStatus: "connected" | "error" = "error";
    let dbCounts: Record<string, number> = {};
    try {
      const [ideas, tasks, conversations, cognitions, memories] =
        await Promise.all([
          prisma.idea.count(),
          prisma.task.count(),
          prisma.conversation.count(),
          prisma.cognition.count(),
          prisma.memory.count(),
        ]);
      dbStatus = "connected";
      dbCounts = { ideas, tasks, conversations, cognitions, memories };
    } catch (e) {
      dbStatus = "error";
    }

    // AI 配置状态（不暴露 key）
    // 兼容多 Provider：AI_* / OPENAI_* / DEEPSEEK_* / MIMO_*
    const chatApiKey =
      process.env.AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.MIMO_API_KEY ||
      "";
    const chatModel =
      process.env.AI_MODEL ||
      process.env.DEEPSEEK_MODEL ||
      process.env.MIMO_MODEL ||
      "未设置（默认 gpt-4o-mini）";
    const chatBaseURLConfigured =
      process.env.AI_BASE_URL ||
      process.env.DEEPSEEK_BASE_URL ||
      process.env.MIMO_BASE_URL;
    const aiConfig = {
      chatProvider: Boolean(chatApiKey),
      chatModel,
      chatBaseURL: chatBaseURLConfigured
        ? "已设置"
        : "未设置（默认 https://api.openai.com/v1）",
      embeddingEnabled: hasAIEmbedding,
      embeddingModel: process.env.EMBEDDING_MODEL || "未设置（默认 text-embedding-3-small）",
      embeddingMode: hasAIEmbedding ? "AI 向量" : "TF-IDF 降级",
    };

    // ============ 环境变量配置状态（仅 boolean） ============
    const envSettings = {
      deepseekApiKey: Boolean(process.env.DEEPSEEK_API_KEY),
      deepseekBaseUrl: Boolean(process.env.DEEPSEEK_BASE_URL),
      deepseekModel: Boolean(process.env.DEEPSEEK_MODEL),
      mimoApiKey: Boolean(process.env.MIMO_API_KEY),
      mimoBaseUrl: Boolean(process.env.MIMO_BASE_URL),
      mimoModel: Boolean(process.env.MIMO_MODEL),
      embeddingApiKey: Boolean(process.env.EMBEDDING_API_KEY),
      embeddingBaseUrl: Boolean(process.env.EMBEDDING_BASE_URL),
      embeddingModel: Boolean(process.env.EMBEDDING_MODEL),
      // ASR/TTS 共用 MIMO_API_KEY，只调用不同模型
      asrApiKey: Boolean(process.env.ASR_API_KEY || process.env.MIMO_API_KEY),
      asrBaseUrl: Boolean(process.env.ASR_BASE_URL || process.env.MIMO_BASE_URL),
      asrModel: Boolean(process.env.ASR_MODEL),
      ttsApiKey: Boolean(process.env.TTS_API_KEY || process.env.MIMO_API_KEY),
      ttsBaseUrl: Boolean(process.env.TTS_BASE_URL || process.env.MIMO_BASE_URL),
      ttsModel: Boolean(process.env.TTS_MODEL),
    };

    // ============ 数据库已保存的配置（mask 敏感字段） ============
    let dbSettings: Record<string, { configured: boolean; value: string }> = {
      defaultProvider: { configured: false, value: "" },
      deepseekApiKey: { configured: false, value: "" },
      deepseekBaseUrl: { configured: false, value: "" },
      deepseekModel: { configured: false, value: "" },
      mimoApiKey: { configured: false, value: "" },
      mimoBaseUrl: { configured: false, value: "" },
      mimoModel: { configured: false, value: "" },
      embeddingApiKey: { configured: false, value: "" },
      embeddingBaseUrl: { configured: false, value: "" },
      embeddingModel: { configured: false, value: "" },
    };
    try {
      const setting = await prisma.aISetting.findFirst();
      if (setting) {
        dbSettings = {
          defaultProvider: {
            configured: Boolean(setting.defaultProvider),
            value: setting.defaultProvider || "",
          },
          deepseekApiKey: {
            configured: Boolean(setting.deepseekApiKey),
            value: maskApiKey(setting.deepseekApiKey || ""),
          },
          deepseekBaseUrl: {
            configured: Boolean(setting.deepseekBaseUrl),
            value: setting.deepseekBaseUrl || "",
          },
          deepseekModel: {
            configured: Boolean(setting.deepseekModel),
            value: setting.deepseekModel || "",
          },
          mimoApiKey: {
            configured: Boolean(setting.mimoApiKey),
            value: maskApiKey(setting.mimoApiKey || ""),
          },
          mimoBaseUrl: {
            configured: Boolean(setting.mimoBaseUrl),
            value: setting.mimoBaseUrl || "",
          },
          mimoModel: {
            configured: Boolean(setting.mimoModel),
            value: setting.mimoModel || "",
          },
          embeddingApiKey: {
            configured: Boolean(setting.embeddingApiKey),
            value: maskApiKey(setting.embeddingApiKey || ""),
          },
          embeddingBaseUrl: {
            configured: Boolean(setting.embeddingBaseUrl),
            value: setting.embeddingBaseUrl || "",
          },
          embeddingModel: {
            configured: Boolean(setting.embeddingModel),
            value: setting.embeddingModel || "",
          },
        };
      }
    } catch (e) {
      // 数据库读取失败时保持空配置
      logger.warn({ err: e }, "读取 AISetting 失败");
    }

    return NextResponse.json(
      {
        db: {
          status: dbStatus,
          configured: Boolean(process.env.DATABASE_URL),
          counts: dbCounts,
        },
        ai: aiConfig,
        envSettings,
        dbSettings,
        envFilePath: ".env",
        envExamplePath: ".env.example",
      },
      {
        headers: {
          // 设置页面需要实时数据（数据库连接状态、配置变更等），禁用缓存
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e) {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * 保存 AI Provider 配置到数据库 AISetting 表
 * 空字符串的字段不保存（保持 null）
 * 保存后调用 refreshAISettings() 刷新内存缓存
 */
export async function PUT(req: NextRequest) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
    }

    // 提取字段：空字符串视为不保存（保持 null）
    const pickStr = (key: string): string | null => {
      const v = (body as Record<string, unknown>)[key];
      if (typeof v !== "string") return null;
      const trimmed = v.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    // defaultProvider 仅接受 deepseek / mimo
    const rawProvider = pickStr("defaultProvider");
    const defaultProvider =
      rawProvider === "deepseek" || rawProvider === "mimo" ? rawProvider : null;

    const data = {
      defaultProvider,
      deepseekApiKey: pickStr("deepseekApiKey"),
      deepseekBaseUrl: pickStr("deepseekBaseUrl"),
      deepseekModel: pickStr("deepseekModel"),
      mimoApiKey: pickStr("mimoApiKey"),
      mimoBaseUrl: pickStr("mimoBaseUrl"),
      mimoModel: pickStr("mimoModel"),
      embeddingApiKey: pickStr("embeddingApiKey"),
      embeddingBaseUrl: pickStr("embeddingBaseUrl"),
      embeddingModel: pickStr("embeddingModel"),
    };

    // upsert：如果没有记录就创建，有就更新第一条
    const existing = await prisma.aISetting.findFirst();
    if (existing) {
      await prisma.aISetting.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.aISetting.create({ data });
    }

    // 刷新内存缓存，使新配置立即生效
    await refreshAISettings();

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "保存 AI 配置失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

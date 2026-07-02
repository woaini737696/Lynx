// AI Provider 抽象层
// 支持 DeepSeek 和小米 MiMo 两个 LLM 的动态切换
// 全部走 OpenAI 兼容协议（/chat/completions、/embeddings）

import { decrypt } from "@/lib/crypto";

// ============ 类型定义 ============

/** LLM Provider 标识 */
export type LLMProvider = "deepseek" | "mimo";

/** 推理模式：fast 最低延迟 / standard 平衡 / deep 最强能力 */
export type ReasoningMode = "fast" | "standard" | "deep";

/** 聊天消息角色 */
export type ChatRole = "system" | "user" | "assistant";

/** 单条聊天消息 */
export interface ChatMessage {
  role: ChatRole;
  content: string | MultimodalContent[];
}

/** 多模态内容片段 */
export interface MultimodalContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

/** 调用聊天接口的选项 */
export interface ChatOptions {
  /** 指定 provider，未传则使用默认 */
  provider?: LLMProvider;
  /** 覆盖默认模型名 */
  model?: string;
  /** 推理模式，影响 temperature / maxTokens，未传则 standard */
  reasoningMode?: ReasoningMode;
  /** 采样温度，0-2（显式传入优先于推理模式默认值） */
  temperature?: number;
  /** 最大生成 token 数（显式传入优先于推理模式默认值） */
  maxTokens?: number;
  /** 系统提示词（若 messages 中已包含 system 消息则忽略） */
  system?: string;
  /** 用户级 API Key（优先于全局配置，由 getLLMConfigForUser 传入） */
  apiKey?: string;
  /** 强制覆盖 baseUrl（用户级配置时使用） */
  baseUrl?: string;
}

/** 聊天接口返回 */
export interface ChatResponse {
  /** 模型生成的文本内容 */
  content: string;
  /** 实际使用的 provider */
  provider: LLMProvider;
  /** 实际使用的模型名 */
  model: string;
  /** token 用量（如 API 返回） */
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/** Provider 配置信息 */
export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** 可用 Provider 列表项（对外暴露，不包含 apiKey） */
export interface ProviderInfo {
  id: LLMProvider;
  /** 展示名称 */
  name: string;
  /** 默认模型名 */
  model: string;
  /** 是否可用（apiKey 已配置） */
  available: boolean;
}

// ============ Provider 元数据 ============

const PROVIDER_META: Record<
  LLMProvider,
  { name: string; envKey: string; envBaseUrl: string; envModel: string }
> = {
  deepseek: {
    name: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    envBaseUrl: "DEEPSEEK_BASE_URL",
    envModel: "DEEPSEEK_MODEL",
  },
  mimo: {
    name: "小米 MiMo",
    envKey: "MIMO_API_KEY",
    envBaseUrl: "MIMO_BASE_URL",
    envModel: "MIMO_MODEL",
  },
};

// ============ 推理模式配置 ============

/** 推理模式对应的采样参数 */
interface ReasoningModeConfig {
  /** 采样温度 */
  temperature: number;
  /** 最大生成 token 数 */
  maxTokens: number;
  /** 是否启用思考模式（模型支持时） */
  thinking?: boolean;
}

/** 各推理模式的默认参数 */
const REASONING_MODE_CONFIG: Record<ReasoningMode, ReasoningModeConfig> = {
  // fast：最低 temperature，maxTokens 限制小，不启用思考
  fast: { temperature: 0.3, maxTokens: 1024 },
  // standard：默认 temperature，正常 maxTokens
  standard: { temperature: 0.7, maxTokens: 4096 },
  // deep：高 temperature，大 maxTokens，启用思考模式
  deep: { temperature: 0.9, maxTokens: 8192, thinking: true },
};

// ============ 模型变体元数据 ============

/** 单个模型变体信息 */
export interface ModelVariant {
  id: string;
  name: string;
  desc: string;
  /** 是否支持多模态（图片输入） */
  multimodal?: boolean;
}

/** Provider 下的模型变体集合 */
export interface ProviderModels {
  id: LLMProvider;
  name: string;
  /** 是否可用（apiKey 已配置） */
  available: boolean;
  models: ModelVariant[];
}

/** 推理模式展示信息 */
export interface ReasoningModeInfo {
  id: ReasoningMode;
  name: string;
  desc: string;
}

/** 可用模型清单 */
export interface AvailableModels {
  providers: ProviderModels[];
  reasoningModes: ReasoningModeInfo[];
}

/** 各 Provider 的模型变体目录（静态） */
const MODEL_CATALOG: Record<LLMProvider, { name: string; models: ModelVariant[] }> = {
  deepseek: {
    name: "DeepSeek",
    models: [
      { id: "deepseek-chat", name: "DeepSeek Flash", desc: "快速响应", multimodal: false },
      { id: "deepseek-reasoner", name: "DeepSeek Pro", desc: "深度推理", multimodal: false },
      { id: "deepseek-vl2", name: "DeepSeek VL2", desc: "视觉多模态", multimodal: true },
    ],
  },
  mimo: {
    name: "小米 MiMo",
    models: [
      { id: "mimo-v2.5", name: "MiMo 2.5", desc: "多模态标准版（支持图片/文件）", multimodal: true },
      { id: "mimo-v2.5-pro", name: "MiMo 2.5 Pro", desc: "增强版", multimodal: true },
      { id: "mimo-vl-7b", name: "MiMo VL", desc: "视觉多模态", multimodal: true },
      { id: "mimo-v2.5-tts", name: "MiMo TTS", desc: "语音合成", multimodal: false },
      { id: "mimo-v2.5-tts-voiceclone", name: "MiMo 音色复刻", desc: "TTS音色克隆", multimodal: false },
    ],
  },
};

/**
 * 检查指定模型是否支持多模态（图片输入）
 * @param provider LLM 服务商
 * @param modelId 模型 ID
 */
export function isModelMultimodal(provider: LLMProvider, modelId: string): boolean {
  const catalog = MODEL_CATALOG[provider];
  if (!catalog) return false;
  const variant = catalog.models.find((m) => m.id === modelId);
  return Boolean(variant?.multimodal);
}

/** 推理模式展示信息（静态） */
const REASONING_MODE_META: ReasoningModeInfo[] = [
  { id: "fast", name: "快速", desc: "最低延迟" },
  { id: "standard", name: "标准", desc: "平衡模式" },
  { id: "deep", name: "深度推理", desc: "最强能力" },
];

/** 获取默认 provider（环境变量配置） */
export function getDefaultProvider(): LLMProvider {
  // 优先读数据库缓存
  if (_dbSettingsCache?.defaultProvider) {
    return _dbSettingsCache.defaultProvider === "mimo" ? "mimo" : "deepseek";
  }
  const raw = (process.env.DEFAULT_LLM_PROVIDER || "deepseek").toLowerCase();
  return raw === "mimo" ? "mimo" : "deepseek";
}

// ============ 数据库 AISetting 缓存 ============

/** 数据库 AISetting 缓存（优先级高于环境变量） */
interface DBAISettings {
  defaultProvider?: string;
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
  deepseekModel?: string;
  mimoApiKey?: string;
  mimoBaseUrl?: string;
  mimoModel?: string;
  embeddingApiKey?: string;
  embeddingBaseUrl?: string;
  embeddingModel?: string;
}

let _dbSettingsCache: DBAISettings | null = null;
let _dbSettingsLoaded = false;
let _dbSettingsLoading: Promise<void> | null = null;

/**
 * 从数据库重新加载 AISetting 到内存缓存
 * 设置页保存后调用此函数立即生效
 */
export async function refreshAISettings(): Promise<void> {
  try {
    const { prisma } = await import("@/lib/db");
    const setting = await prisma.aISetting.findFirst();
    if (setting) {
      _dbSettingsCache = {
        defaultProvider: setting.defaultProvider || undefined,
        deepseekApiKey: decrypt(setting.deepseekApiKey) || undefined,
        deepseekBaseUrl: setting.deepseekBaseUrl || undefined,
        deepseekModel: setting.deepseekModel || undefined,
        mimoApiKey: decrypt(setting.mimoApiKey) || undefined,
        mimoBaseUrl: setting.mimoBaseUrl || undefined,
        mimoModel: setting.mimoModel || undefined,
        embeddingApiKey: decrypt(setting.embeddingApiKey) || undefined,
        embeddingBaseUrl: setting.embeddingBaseUrl || undefined,
        embeddingModel: setting.embeddingModel || undefined,
      };
    } else {
      _dbSettingsCache = null;
    }
    _dbSettingsLoaded = true;
  } catch (e) {
    console.error("[ai-provider] 加载 AISetting 失败，回退到环境变量:", e);
    _dbSettingsCache = null;
    _dbSettingsLoaded = true;
  }
}

/** 懒加载：首次调用时异步加载，后续直接读缓存 */
function ensureSettingsLoaded(): void {
  if (!_dbSettingsLoaded && !_dbSettingsLoading) {
    _dbSettingsLoading = refreshAISettings();
  }
}

// 模块加载时启动异步加载（不阻塞）
ensureSettingsLoaded();

// ============ 配置读取 ============

/**
 * 获取指定 provider 的配置
 * 优先级：数据库 AISetting > 环境变量
 * @param provider 不传则使用默认 provider
 */
export function getLLMConfig(provider?: LLMProvider): ProviderConfig {
  const resolved: LLMProvider =
    provider === "deepseek" || provider === "mimo"
      ? provider
      : getDefaultProvider();

  const meta = PROVIDER_META[resolved];

  // 优先读数据库缓存
  const dbKey = resolved === "deepseek" ? _dbSettingsCache?.deepseekApiKey : _dbSettingsCache?.mimoApiKey;
  const dbBaseUrl = resolved === "deepseek" ? _dbSettingsCache?.deepseekBaseUrl : _dbSettingsCache?.mimoBaseUrl;
  const dbModel = resolved === "deepseek" ? _dbSettingsCache?.deepseekModel : _dbSettingsCache?.mimoModel;

  const apiKey = dbKey || process.env[meta.envKey] || "";
  const baseUrl = dbBaseUrl || process.env[meta.envBaseUrl] || "";
  const model = dbModel || process.env[meta.envModel] || "";

  if (!apiKey) {
    throw new Error(
      `Provider "${resolved}" 未配置 API Key（请在设置页配置，或设置环境变量 ${meta.envKey}）`
    );
  }
  if (!baseUrl) {
    throw new Error(
      `Provider "${resolved}" 未配置 Base URL（环境变量 ${meta.envBaseUrl}）`
    );
  }
  if (!model) {
    throw new Error(
      `Provider "${resolved}" 未配置模型名（环境变量 ${meta.envModel}）`
    );
  }

  return { apiKey, baseUrl, model };
}

/**
 * 获取指定用户的 LLM 配置（异步，因为需要查数据库）
 * 优先级：用户自配 Key > 全局 AISetting > 环境变量
 * @param provider 显式指定 provider；不传则读用户偏好或全局默认
 * @param userId 用户 ID（用于读取用户级 Key）
 */
export async function getLLMConfigForUser(
  userId: string,
  provider?: LLMProvider
): Promise<ProviderConfig & { provider: LLMProvider; userKeyUsed: boolean }> {
  // 确保全局设置已加载
  if (!_dbSettingsLoaded) {
    await refreshAISettings();
  }

  // 读取用户级配置
  let userDeepseekKey: string | null = null;
  let userMimoKey: string | null = null;
  let userPreferredProvider: string | null = null;
  let allowedProviders: string[] | null = null;
  try {
    const { prisma } = await import("@/lib/db");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        userDeepseekApiKey: true,
        userMimoApiKey: true,
        userAiProvider: true,
        profession: true,
      },
    });
    if (user) {
      userDeepseekKey = decrypt(user.userDeepseekApiKey) || null;
      userMimoKey = decrypt(user.userMimoApiKey) || null;
      userPreferredProvider = user.userAiProvider || null;

      // 检查职业空间的 allowedProviders 限制
      if (user.profession) {
        const ws = await prisma.professionWorkspace.findUnique({
          where: { profession: user.profession },
          select: { allowedProviders: true, enabled: true },
        });
        if (ws?.enabled) {
          const ap = ws.allowedProviders as string[] | null;
          if (Array.isArray(ap) && ap.length > 0) {
            allowedProviders = ap;
          }
        }
      }
    }
  } catch {
    // 读取失败不阻断，回退到全局配置
  }

  // 解析 provider：显式传入 > 用户偏好 > 全局默认
  let resolved: LLMProvider;
  if (provider === "deepseek" || provider === "mimo") {
    resolved = provider;
  } else if (userPreferredProvider === "mimo") {
    resolved = "mimo";
  } else if (userPreferredProvider === "deepseek") {
    resolved = "deepseek";
  } else {
    resolved = getDefaultProvider();
  }

  // 校验 allowedProviders 限制
  if (allowedProviders && !allowedProviders.includes(resolved)) {
    // 用户当前 provider 不在允许列表内，回退到允许列表的第一个
    resolved = (allowedProviders[0] as LLMProvider) || resolved;
  }

  const meta = PROVIDER_META[resolved];
  let apiKey: string;
  let userKeyUsed = false;

  // 优先级：用户自配 Key > 全局 AISetting > 环境变量
  if (resolved === "deepseek" && userDeepseekKey) {
    apiKey = userDeepseekKey;
    userKeyUsed = true;
  } else if (resolved === "mimo" && userMimoKey) {
    apiKey = userMimoKey;
    userKeyUsed = true;
  } else {
    const dbKey = resolved === "deepseek" ? _dbSettingsCache?.deepseekApiKey : _dbSettingsCache?.mimoApiKey;
    apiKey = dbKey || process.env[meta.envKey] || "";
  }

  const dbBaseUrl = resolved === "deepseek" ? _dbSettingsCache?.deepseekBaseUrl : _dbSettingsCache?.mimoBaseUrl;
  const dbModel = resolved === "deepseek" ? _dbSettingsCache?.deepseekModel : _dbSettingsCache?.mimoModel;
  const baseUrl = dbBaseUrl || process.env[meta.envBaseUrl] || "";
  const model = dbModel || process.env[meta.envModel] || "";

  if (!apiKey) {
    throw new Error(
      `Provider "${resolved}" 未配置 API Key（请在设置页配置你的 Key，或联系管理员配置全局 Key）`
    );
  }
  if (!baseUrl) {
    throw new Error(`Provider "${resolved}" 未配置 Base URL`);
  }
  if (!model) {
    throw new Error(`Provider "${resolved}" 未配置模型名`);
  }

  return { apiKey, baseUrl, model, provider: resolved, userKeyUsed };
}

// ============ 可用 Provider 列表 ============

/**
 * 列出所有 provider 及其可用状态
 * 不抛错，apiKey 未配置的 provider 标记为 available=false
 */
export function listAvailableProviders(): ProviderInfo[] {
  return (Object.keys(PROVIDER_META) as LLMProvider[]).map((id) => {
    const meta = PROVIDER_META[id];
    const apiKey = process.env[meta.envKey] || "";
    const model = process.env[meta.envModel] || "";
    return {
      id,
      name: meta.name,
      model,
      available: Boolean(apiKey),
    };
  });
}

// ============ 可用模型清单（含变体与推理模式） ============

/**
 * 列出所有 provider 的模型变体及推理模式
 * provider 的 available 字段反映 apiKey 是否已配置
 */
export function listAvailableModels(): AvailableModels {
  const providers: ProviderModels[] = (
    Object.keys(MODEL_CATALOG) as LLMProvider[]
  ).map((id) => {
    const meta = PROVIDER_META[id];
    const apiKey = process.env[meta.envKey] || "";
    return {
      id,
      name: MODEL_CATALOG[id].name,
      available: Boolean(apiKey),
      models: MODEL_CATALOG[id].models,
    };
  });
  return {
    providers,
    reasoningModes: REASONING_MODE_META,
  };
}

// ============ 聊天接口 ============

/**
 * 估算文本的 token 数（fallback：当 provider 不返回 usage 时使用）
 * 粗略规则：中文约 1.5 字/token，英文约 0.75 词/token，数字/符号按 1 token 计
 * 误差 ±20%，仅用于 UI 显示，不用于计费
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const digits = (text.match(/\d/g) || []).length;
  const symbols = (text.match(/[^\w\s\u4e00-\u9fa5]/g) || []).length;
  return Math.ceil(chineseChars / 1.5 + englishWords / 0.75 + digits + symbols / 2);
}

/**
 * 确保 usage 不为空：provider 返回了就用 provider 的，否则基于消息估算
 * 用于 UI 显示，保证每条消息都有 token 数
 */
function ensureUsage(
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  messages: ChatMessage[],
  output: string
): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
  if (usage && typeof usage.total_tokens === "number" && usage.total_tokens > 0) {
    return {
      prompt_tokens: usage.prompt_tokens ?? 0,
      completion_tokens: usage.completion_tokens ?? 0,
      total_tokens: usage.total_tokens,
    };
  }
  // Fallback：基于消息内容估算
  const inputText = messages
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("");
  const promptTokens = estimateTokens(inputText);
  const completionTokens = estimateTokens(output);
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };
}

/**
 * 调用 OpenAI 兼容的 /chat/completions 接口
 * @param messages 消息列表
 * @param options 选项（provider、model、temperature 等）
 */
export async function chat(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<ChatResponse> {
  const provider: LLMProvider =
    options?.provider === "deepseek" || options?.provider === "mimo"
      ? options.provider
      : getDefaultProvider();

  const baseConfig = getLLMConfig(provider);
  // 用户级 Key 覆盖（由 getLLMConfigForUser 传入，优先级最高）
  const config: ProviderConfig = {
    apiKey: options?.apiKey || baseConfig.apiKey,
    baseUrl: options?.baseUrl || baseConfig.baseUrl,
    model: baseConfig.model,
  };
  const reasoningMode: ReasoningMode =
    options?.reasoningMode === "fast" ||
    options?.reasoningMode === "standard" ||
    options?.reasoningMode === "deep"
      ? options.reasoningMode
      : "standard";
  const modeConfig = REASONING_MODE_CONFIG[reasoningMode];

  // 解析模型：显式传入优先；DeepSeek 深度推理模式自动切换到 reasoner 模型
  let model = options?.model || config.model;
  if (reasoningMode === "deep" && provider === "deepseek") {
    model = "deepseek-reasoner";
  }

  // 根据推理模式调整 temperature / maxTokens（显式传入优先）
  const temperature = options?.temperature ?? modeConfig.temperature;
  let maxTokens = options?.maxTokens ?? modeConfig.maxTokens;
  // MiMo 深度推理模式增加 maxTokens（推理模型需要更多 token）
  if (reasoningMode === "deep" && provider === "mimo") {
    maxTokens = options?.maxTokens ?? modeConfig.maxTokens * 2;
  }

  // 组装消息：可选 system 提示词前置
  let finalMessages: ChatMessage[] = messages;
  if (
    options?.system &&
    !messages.some((m) => m.role === "system")
  ) {
    finalMessages = [
      { role: "system", content: options.system },
      ...messages,
    ];
  }

  // 请求体
  const body: Record<string, unknown> = {
    model,
    messages: finalMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
    max_tokens: maxTokens,
  };

  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  // 性能优化：60 秒总超时（非流式调用需等完整响应）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      // @ts-ignore - Node 18+ undici 支持 keepalive
      keepalive: true,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    throw new Error(
      `调用 ${provider} 聊天接口网络错误：${(e as Error).message}`
    );
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const errText = await safeReadText(res);
    throw new Error(
      `${provider} 聊天接口返回错误 ${res.status}：${errText.slice(0, 500)}`
    );
  }

  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") {
    throw new Error(`${provider} 聊天接口返回数据格式异常`);
  }

  const choices = (data as { choices?: Array<{ message?: { content?: string } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`${provider} 聊天接口未返回有效内容`);
  }

  return {
    content,
    provider,
    model,
    usage: ensureUsage((data as { usage?: ChatResponse["usage"] }).usage, finalMessages, content),
  };
}

// ============ 流式聊天接口 ============

/** 流式事件类型 */
export type StreamEvent =
  | { type: "meta"; provider: LLMProvider; model: string }
  | { type: "delta"; content: string }
  | { type: "done"; usage?: ChatResponse["usage"] }
  | { type: "error"; message: string };

/**
 * 流式调用 OpenAI 兼容的 /chat/completions 接口
 * 返回异步生成器，逐个 yield StreamEvent
 * @param messages 消息列表
 * @param options 选项（provider、model、temperature 等）
 */
export async function* chatStream(
  messages: ChatMessage[],
  options?: ChatOptions
): AsyncGenerator<StreamEvent> {
  const provider: LLMProvider =
    options?.provider === "deepseek" || options?.provider === "mimo"
      ? options.provider
      : getDefaultProvider();

  let config: ProviderConfig;
  try {
    const baseConfig = getLLMConfig(provider);
    // 用户级 Key 覆盖（由 getLLMConfigForUser 传入，优先级最高）
    config = {
      apiKey: options?.apiKey || baseConfig.apiKey,
      baseUrl: options?.baseUrl || baseConfig.baseUrl,
      model: baseConfig.model,
    };
  } catch (e) {
    yield { type: "error", message: (e as Error).message };
    return;
  }

  // 解析推理模式（未传则 standard）
  const reasoningMode: ReasoningMode =
    options?.reasoningMode === "fast" ||
    options?.reasoningMode === "standard" ||
    options?.reasoningMode === "deep"
      ? options.reasoningMode
      : "standard";
  const modeConfig = REASONING_MODE_CONFIG[reasoningMode];

  // 解析模型：显式传入优先；DeepSeek 深度推理模式自动切换到 reasoner 模型
  let model = options?.model || config.model;
  if (reasoningMode === "deep" && provider === "deepseek") {
    model = "deepseek-reasoner";
  }

  // 根据推理模式调整 temperature / maxTokens（显式传入优先）
  const temperature = options?.temperature ?? modeConfig.temperature;
  let maxTokens = options?.maxTokens ?? modeConfig.maxTokens;
  if (reasoningMode === "deep" && provider === "mimo") {
    maxTokens = options?.maxTokens ?? modeConfig.maxTokens * 2;
  }

  // 组装消息：可选 system 提示词前置
  let finalMessages: ChatMessage[] = messages;
  if (
    options?.system &&
    !messages.some((m) => m.role === "system")
  ) {
    finalMessages = [
      { role: "system", content: options.system },
      ...messages,
    ];
  }

  // 请求体（启用流式 + usage 回传）
  const body: Record<string, unknown> = {
    model,
    messages: finalMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
  };

  // 先发送 meta 事件
  yield { type: "meta", provider, model };

  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  // 首字延迟优化：连接+首字节超时 30 秒（避免 Provider 挂死时无限等待）
  // 流式传输开始后不再受此超时限制（fetch 的 signal 仅控制建立连接+首字节）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      // @ts-ignore - Node 18+ undici 支持 keepalive
      keepalive: true,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    yield {
      type: "error",
      message: `调用 ${provider} 聊天接口网络错误：${(e as Error).message}`,
    };
    return;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const errText = await safeReadText(res);
    yield {
      type: "error",
      message: `${provider} 聊天接口返回错误 ${res.status}：${errText.slice(0, 500)}`,
    };
    return;
  }

  if (!res.body) {
    yield { type: "error", message: `${provider} 聊天接口未返回流式数据` };
    return;
  }

  // 解析 SSE 流
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let usage: ChatResponse["usage"] | undefined;
  let fullContent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按行处理 SSE
      const lines = buffer.split("\n");
      // 保留最后一行（可能不完整）
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          yield { type: "done", usage: ensureUsage(usage, finalMessages, fullContent) };
          return;
        }
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{
              delta?: { content?: string };
              finish_reason?: string | null;
            }>;
            usage?: ChatResponse["usage"];
          };
          // 提取 usage（通常在最后一个 chunk）
          if (parsed.usage) {
            usage = parsed.usage;
          }
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            fullContent += delta;
            yield { type: "delta", content: delta };
          }
        } catch {
          // 忽略解析错误的行
        }
      }
    }
    // 流自然结束（未收到 [DONE]）
    yield { type: "done", usage: ensureUsage(usage, finalMessages, fullContent) };
  } finally {
    reader.releaseLock();
  }
}

// ============ Embedding 接口 ============

/**
 * 调用 OpenAI 兼容的 /embeddings 接口
 * 使用 EMBEDDING_* 系列环境变量
 */
export async function embedding(text: string): Promise<number[]> {
  const apiKey = process.env.EMBEDDING_API_KEY || "";
  const baseUrl = process.env.EMBEDDING_BASE_URL || "";
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

  if (!apiKey) {
    throw new Error("Embedding API Key 未配置（环境变量 EMBEDDING_API_KEY）");
  }
  if (!baseUrl) {
    throw new Error("Embedding Base URL 未配置（环境变量 EMBEDDING_BASE_URL）");
  }

  const url = `${baseUrl.replace(/\/$/, "")}/embeddings`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });
  } catch (e) {
    throw new Error(
      `调用 Embedding 接口网络错误：${(e as Error).message}`
    );
  }

  if (!res.ok) {
    const errText = await safeReadText(res);
    throw new Error(
      `Embedding 接口返回错误 ${res.status}：${errText.slice(0, 500)}`
    );
  }

  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") {
    throw new Error("Embedding 接口返回数据格式异常");
  }

  const vec = (data as { data?: Array<{ embedding?: number[] }> }).data?.[0]
    ?.embedding;
  if (!Array.isArray(vec)) {
    throw new Error("Embedding 接口未返回有效向量");
  }

  return vec;
}

// ============ 工具函数 ============

/** 安全读取响应文本（失败时返回空串） */
async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

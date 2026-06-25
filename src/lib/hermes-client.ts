// Hermes Agent 客户端
// 封装与本地 Hermes Agent HTTP API 的交互
// Hermes Agent 是 NousResearch 开发的开源本地 AI 代理框架，支持：
// - Computer Use（桌面控制，通过 trycua 支持 Windows/Linux/macOS）
// - Shell 命令执行
// - MCP 工具集成
// - Skills Hub（17 类 672+ 技能）
// - 自我进化

import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-client");

// ============ 类型定义 ============

export interface HermesConfig {
  id: string;
  userId: string;
  enabled: boolean;
  endpoint: string;
  apiKey: string | null;
  autoStart: boolean;
  capabilities: string[]; // ["computer_use", "shell", "mcp", "skills_hub"]
  installedAt: Date | null;
  status: string; // not_installed | installing | installed | running | error
  lastCheckedAt: Date | null;
  lastError: string | null;
}

export interface HermesTaskRequest {
  /** 任务描述（自然语言） */
  prompt: string;
  /** 执行模式：computer_use（桌面控制）| shell（命令行）| auto（自动选择） */
  mode?: "computer_use" | "shell" | "auto";
  /** 超时时间（秒），默认 120 */
  timeout?: number;
  /** 工作目录（shell 模式） */
  workDir?: string;
  /** 附加参数 */
  options?: Record<string, unknown>;
}

export interface HermesTaskResult {
  success: boolean;
  output: string;
  /** 执行步骤日志 */
  steps?: Array<{ action: string; result: string; timestamp: string }>;
  /** 截图 URL（computer_use 模式） */
  screenshots?: string[];
  /** 耗时（毫秒） */
  durationMs?: number;
  error?: string;
}

export interface HermesSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  /** 参数定义 */
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
    default?: unknown;
  }>;
  /** 提示词模板 */
  promptTemplate?: string;
  tags?: string[];
  /** 使用次数 */
  usageCount?: number;
  /** 评分 */
  rating?: number;
}

// ============ 配置管理 ============

/** 获取用户的 Hermes 配置（不存在时返回 null） */
export async function getHermesConfig(userId: string): Promise<HermesConfig | null> {
  const config = await prisma.hermesConfig.findUnique({
    where: { userId },
  });
  if (!config) return null;
  return {
    id: config.id,
    userId: config.userId,
    enabled: config.enabled,
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    autoStart: config.autoStart,
    capabilities: config.capabilities as unknown as string[],
    installedAt: config.installedAt,
    status: config.status,
    lastCheckedAt: config.lastCheckedAt,
    lastError: config.lastError,
  };
}

/** 创建或更新用户的 Hermes 配置 */
export async function upsertHermesConfig(
  userId: string,
  data: Partial<Omit<HermesConfig, "id" | "userId">>
): Promise<HermesConfig> {
  const capabilities = data.capabilities
    ? data.capabilities as unknown as never
    : undefined;
  const config = await prisma.hermesConfig.upsert({
    where: { userId },
    create: {
      userId,
      enabled: data.enabled ?? false,
      endpoint: data.endpoint ?? "http://localhost:9119",
      apiKey: data.apiKey ?? null,
      autoStart: data.autoStart ?? false,
      capabilities: (data.capabilities ?? ["computer_use", "shell", "skills_hub"]) as unknown as never,
      status: data.status ?? "not_installed",
      installedAt: data.installedAt ?? null,
      lastCheckedAt: data.lastCheckedAt ?? null,
      lastError: data.lastError ?? null,
    },
    update: {
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      ...(data.endpoint !== undefined && { endpoint: data.endpoint }),
      ...(data.apiKey !== undefined && { apiKey: data.apiKey }),
      ...(data.autoStart !== undefined && { autoStart: data.autoStart }),
      ...(capabilities !== undefined && { capabilities }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.installedAt !== undefined && { installedAt: data.installedAt }),
      ...(data.lastCheckedAt !== undefined && { lastCheckedAt: data.lastCheckedAt }),
      ...(data.lastError !== undefined && { lastError: data.lastError }),
    },
  });
  return {
    id: config.id,
    userId: config.userId,
    enabled: config.enabled,
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    autoStart: config.autoStart,
    capabilities: config.capabilities as unknown as string[],
    installedAt: config.installedAt,
    status: config.status,
    lastCheckedAt: config.lastCheckedAt,
    lastError: config.lastError,
  };
}

// ============ HTTP 请求封装 ============

async function hermesFetch(
  config: HermesConfig,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${config.endpoint.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }
  return fetch(url, { ...options, headers });
}

// ============ 命令行执行封装 ============

// ============ 用户 Profile 管理（持久化记忆核心） ============

/**
 * 获取用户专属的 Hermes profile 目录
 *
 * 路径：~/.lynnhub/hermes-profiles/<userId>/
 * 内含：
 *   - hermes/.env          - LLM 配置（API Key、Base URL、Model）
 *   - hermes/config.yaml   - Hermes 模型设置
 *   - hermes/auth.json     - 认证信息
 *   - hermes/logs/         - 日志
 *   - hermes/skills/       - /learn 自动生成的技能
 *   - hermes/memory/       - 持久化记忆（FTS5 全文索引）
 *   - hermes/sessions/     - 会话历史
 *
 * 每个用户的记忆、技能、会话完全隔离，跨会话保留。
 */
export function getUserProfileDir(userId: string): string {
  const path = require("path") as typeof import("path");
  const os = require("os") as typeof import("os");
  return path.join(os.homedir(), ".lynnhub", "hermes-profiles", userId);
}

/**
 * 获取用户 profile 下的 hermes 数据目录
 */
export function getUserHermesDir(userId: string): string {
  const path = require("path") as typeof import("path");
  return path.join(getUserProfileDir(userId), "hermes");
}

/**
 * 构建 hermes CLI 调用所需的安全环境
 *
 * 根因：TRAE 沙箱限制了对 C:\Users\...\AppData\Local\hermes\logs\ 的写入，
 * 导致 hermes 启动时 concurrent_log_handler 抛出 OSError: Bad file descriptor。
 *
 * 方案（持久化 profile）：
 * - 传入 userId 时，重定向 LOCALAPPDATA 到 ~/.lynnhub/hermes-profiles/<userId>/
 *   使记忆、skills、会话跨会话持久化保留
 * - 不传 userId 时（向后兼容），使用临时目录
 * - 首次使用时从原 hermes 目录复制配置（不覆盖已有的）
 */
function buildHermesEnv(userId?: string): NodeJS.ProcessEnv {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const os = require("os") as typeof import("os");

  const origLocal = process.env.LOCALAPPDATA || "";
  const origHermesDir = path.join(origLocal, "hermes");

  // 选择 profile 目录：有 userId 用持久化目录，否则用临时目录
  const profileLocal = userId
    ? getUserProfileDir(userId)
    : path.join(os.tmpdir(), "hermes_local_run");
  const profileHermesDir = path.join(profileLocal, "hermes");

  // 确保目录结构存在（首次创建）
  const subDirs = ["logs", "skills", "memory", "sessions"];
  for (const sub of subDirs) {
    fs.mkdirSync(path.join(profileHermesDir, sub), { recursive: true });
  }

  // 复制配置文件（仅首次，不覆盖已有的 - 保留用户自定义）
  if (fs.existsSync(origHermesDir)) {
    for (const file of [".env", "config.yaml", "auth.json"]) {
      const src = path.join(origHermesDir, file);
      const dst = path.join(profileHermesDir, file);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        try {
          fs.copyFileSync(src, dst);
        } catch {
          // 复制失败不阻塞，hermes 可能用环境变量中的 Key
        }
      }
    }
  }

  return {
    ...process.env,
    LOCALAPPDATA: profileLocal,
  };
}

/** 执行 hermes 命令并返回 stdout */
async function execHermes(
  args: string[],
  timeoutMs: number = 30_000,
  userId?: string
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  const hermesExe = await findHermesExe();
  if (!hermesExe) {
    return { success: false, stdout: "", stderr: "", error: "未找到 hermes 可执行文件" };
  }

  try {
    const { stdout, stderr } = await execFileAsync(hermesExe, args, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 10, // 10MB
      env: buildHermesEnv(userId),
      cwd: process.env.HOME || process.env.USERPROFILE || undefined,
    });
    return { success: true, stdout, stderr };
  } catch (e) {
    const err = e as Error & { stdout?: string; stderr?: string; code?: string };
    if (err.code === "ETIMEDOUT") {
      return { success: false, stdout: "", stderr: "", error: `命令执行超时（${timeoutMs / 1000}秒）` };
    }
    return {
      success: false,
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      error: err.message,
    };
  }
}

// ============ Hermes Agent 操作 ============

/**
 * 测试与 Hermes Agent 的连接
 * 优先尝试 HTTP API（如果 dashboard 已启动），回退到命令行 `hermes status`
 */
export async function testHermesConnection(
  config: HermesConfig
): Promise<{ connected: boolean; version?: string; capabilities?: string[]; error?: string }> {
  // 1. 先尝试 HTTP 连接（如果 dashboard 服务在运行）
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await hermesFetch(config, "/", {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      let version: string | undefined;
      try {
        const data = await res.json();
        version = data.version || data.data?.version;
      } catch {
        // 非 JSON 响应也视为连接成功
      }
      return {
        connected: true,
        version,
        capabilities: config.capabilities,
      };
    }
  } catch {
    // HTTP 连接失败，回退到命令行检测
  }

  // 2. 回退：通过 `hermes status` 命令检测
  const result = await execHermes(["status"], 15000);
  if (result.success && result.stdout.length > 0) {
    const versionMatch = result.stdout.match(/Version:\s*(.+)/i);
    return {
      connected: true,
      version: versionMatch?.[1]?.trim() || "unknown",
      capabilities: config.capabilities,
    };
  }

  return {
    connected: false,
    error: result.error || "Hermes Agent 未运行或未正确配置。请先点击'启动'按钮启动 Dashboard 服务。",
  };
}

/**
 * 执行 Hermes 任务（通过 CLI，支持持久化 profile + 自动学习）
 *
 * 架构说明：
 * Hermes Dashboard 是管理界面（查看 sessions/config/skills），没有通用 prompt 执行 API。
 * 任务执行统一通过 CLI `hermes -z "prompt" --yolo --learn`，hermes 内部会自动调用工具完成任务。
 *
 * 执行流程：
 * 1. 预检 LLM 模型是否已配置（未配置时自动配置）
 * 2. 通过 CLI 执行任务（传入 userId 启用持久化 profile）
 * 3. 任务成功后，自动生成的 skill 会写入 profile/skills/ 目录，由 syncLearnedSkills 回写
 */
export async function executeHermesTask(
  config: HermesConfig,
  request: HermesTaskRequest,
  userId?: string
): Promise<HermesTaskResult> {
  const start = Date.now();
  const timeoutMs = (request.timeout ?? 120) * 1000;

  // 1. 预检：模型是否已配置（未配置会导致 "no final response was produced"）
  try {
    const check = await isHermesModelConfigured();
    if (!check.configured && !check.hasApiKey) {
      const cfg = await configureHermesModel();
      if (!cfg.success) {
        return {
          success: false,
          output: "",
          error:
            "Hermes 尚未配置 LLM 模型。\n" +
            "自动配置失败：" + (cfg.error || "未知原因") + "\n\n" +
            "请点击「一键配置模型」按钮，或在 Hermes 设置中手动配置 DeepSeek API Key。",
          durationMs: Date.now() - start,
        };
      }
    }
  } catch {
    // 预检失败不阻塞，继续尝试执行
  }

  // 2. 通过 CLI 执行任务（传入 userId 启用持久化 profile）
  // 注意：--learn 在部分 Hermes 版本中不支持，通过 syncLearnedSkills 扫描 skills 目录实现学习回写
  const args = ["-z", request.prompt, "--yolo"];

  const result = await execHermes(args, timeoutMs, userId);
  if (result.success) {
    const output = result.stdout.trim() || result.stderr.trim();
    return {
      success: true,
      output: output || "(任务已完成，无控制台输出)",
      durationMs: Date.now() - start,
    };
  }

  // CLI 执行失败 — 给出有针对性的错误提示
  const errLower = (result.error || "").toLowerCase();
  let friendlyError: string;
  if (errLower.includes("no final response") || errLower.includes("no final")) {
    friendlyError =
      "Hermes 未产生最终响应——通常是因为 LLM 模型未配置。\n" +
      "请点击「一键配置模型」按钮（会自动复用 LynnHub 的 DeepSeek API Key），配置后重试。";
  } else if (errLower.includes("timeout") || errLower.includes("etimedout")) {
    friendlyError = `任务执行超时（${timeoutMs / 1000}秒）。可在执行时增加 timeout 参数。`;
  } else if (errLower.includes("not found") || errLower.includes("enoent")) {
    friendlyError = "未找到 hermes 可执行文件，请确认已安装 hermes-agent（pip install hermes-agent）";
  } else if (errLower.includes("no inference provider")) {
    friendlyError =
      "Hermes 未配置推理提供者。请运行 `hermes model` 选择模型，或确保 DeepSeek API Key 已写入 Hermes 配置。\n" +
      "可点击「一键配置模型」按钮自动配置。";
  } else {
    friendlyError = result.error || result.stderr || "任务执行失败";
  }

  return {
    success: false,
    output: "",
    error: friendlyError,
    durationMs: Date.now() - start,
  };
}

/**
 * 获取 Hermes Skills Hub 技能列表
 * 通过 `hermes skills list` 命令获取已安装技能
 */
export async function listHermesSkills(
  config: HermesConfig,
  category?: string
): Promise<{ skills: HermesSkill[]; error?: string }> {
  // 1. 先尝试 HTTP API
  try {
    const path = category
      ? `/api/skills?category=${encodeURIComponent(category)}`
      : "/api/skills";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await hermesFetch(config, path, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const skills = (data.skills || data.data || []) as HermesSkill[];
      if (skills.length > 0) return { skills };
    }
  } catch {
    // HTTP 不可用，回退到命令行
  }

  // 2. 回退：通过 `hermes skills list` 命令
  const result = await execHermes(["skills", "list"], 15000);
  if (result.success) {
    // 解析命令行输出为技能列表
    const skills = parseSkillsListOutput(result.stdout);
    return { skills };
  }

  return {
    skills: [],
    error: result.error || "无法获取技能列表，请确认 Hermes Agent 已安装",
  };
}

/** 解析 `hermes skills list` 命令输出为技能数组 */
function parseSkillsListOutput(stdout: string): HermesSkill[] {
  const skills: HermesSkill[] = [];
  const lines = stdout.split("\n");
  for (const line of lines) {
    // 尝试匹配常见格式：技能名 - 描述
    const match = line.match(/^\s*[-•*]?\s*(.+?)\s*[-—:]\s*(.+)$/);
    if (match) {
      skills.push({
        id: match[1].trim().toLowerCase().replace(/\s+/g, "_"),
        name: match[1].trim(),
        description: match[2].trim(),
        category: "installed",
      });
    }
  }
  return skills;
}

/**
 * 执行 Hermes Skills Hub 中的指定技能
 */
export async function executeHermesSkill(
  config: HermesConfig,
  skillId: string,
  parameters: Record<string, unknown>
): Promise<HermesTaskResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);
    const res = await hermesFetch(config, `/api/skills/${skillId}/execute`, {
      method: "POST",
      body: JSON.stringify({ parameters }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        output: "",
        error: data.error || data.message || `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    return {
      success: true,
      output: data.output || data.result || "",
      steps: data.steps,
      durationMs: data.durationMs || Date.now() - start,
    };
  } catch (e) {
    return {
      success: false,
      output: "",
      error: (e as Error).name === "AbortError" ? "技能执行超时" : (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

// ============ 模型配置管理 ============

/** 获取 Hermes 的 .env 文件路径（跨平台） */
function getHermesEnvPath(): string {
  const path = require("path");
  const os = require("os");
  // Hermes 使用 LOCALAPPDATA（Windows）/ XDG_DATA_HOME 或 ~/.local/share（Linux/macOS）
  const base =
    process.env.LOCALAPPDATA ||
    process.env.XDG_DATA_HOME ||
    path.join(os.homedir(), ".local", "share");
  return path.join(base, "hermes", ".env");
}

/** 获取 Hermes 的 config.yaml 路径 */
function getHermesConfigPath(): string {
  const path = require("path");
  const os = require("os");
  const base =
    process.env.LOCALAPPDATA ||
    process.env.XDG_DATA_HOME ||
    path.join(os.homedir(), ".local", "share");
  return path.join(base, "hermes", "config.yaml");
}

/**
 * 自动配置 Hermes 的 LLM 模型（复用 LynnHub 的 DeepSeek API Key）
 *
 * 根因修复：Hermes 安装后默认未配置任何 LLM provider/model，
 * 执行 `-z` 任务时会因 "no model" 产生 "no final response was produced"。
 *
 * 本函数：
 * 1. 从 LynnHub 的 process.env.DEEPSEEK_API_KEY 或 AISetting.deepseekApiKey 读取密钥
 * 2. 写入 Hermes 的 .env 文件（DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL）
 * 3. 通过 `hermes config set model deepseek-chat` 设置默认模型
 */
export async function configureHermesModel(): Promise<{
  success: boolean;
  configured?: { provider: string; model: string; baseUrl: string };
  error?: string;
}> {
  const fs = require("fs").promises;
  const path = require("path");

  try {
    // 1. 获取 DeepSeek API Key（优先环境变量，回退数据库）
    let apiKey = process.env.DEEPSEEK_API_KEY || "";
    let baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
    let modelName = process.env.DEEPSEEK_MODEL || "deepseek-chat";

    if (!apiKey) {
      // 回退：从数据库 AISetting 读取
      try {
        const setting = await prisma.aISetting.findFirst();
        if (setting?.deepseekApiKey) {
          apiKey = setting.deepseekApiKey;
          baseUrl = setting.deepseekBaseUrl || baseUrl;
          modelName = setting.deepseekModel || modelName;
        }
      } catch {
        // 数据库读取失败，继续
      }
    }

    if (!apiKey) {
      return {
        success: false,
        error:
          "未找到 DeepSeek API Key。请在 LynnHub 根目录 .env 设置 DEEPSEEK_API_KEY，或在 AI 助理设置中配置 DeepSeek 密钥。",
      };
    }

    // 2. 写入 Hermes .env 文件
    const envPath = getHermesEnvPath();
    const envDir = path.dirname(envPath);
    await fs.mkdir(envDir, { recursive: true });

    // 读取现有 .env（如有），保留其它键，仅更新 DeepSeek 相关
    let existingLines: string[] = [];
    try {
      const existing = await fs.readFile(envPath, "utf-8");
      existingLines = existing.split(/\r?\n/).filter((l: string) => l.trim());
    } catch {
      // 文件不存在，忽略
    }

    // 移除旧的 DeepSeek 相关行
    const kept = existingLines.filter(
      (l: string) =>
        !l.startsWith("DEEPSEEK_API_KEY=") &&
        !l.startsWith("DEEPSEEK_BASE_URL=") &&
        !l.startsWith("DEEPSEEK_MODEL=")
    );

    const newEnvContent = [
      ...kept,
      `DEEPSEEK_API_KEY=${apiKey}`,
      `DEEPSEEK_BASE_URL=${baseUrl}`,
      `DEEPSEEK_MODEL=${modelName}`,
      "",
    ].join("\n");

    await fs.writeFile(envPath, newEnvContent, "utf-8");
    logger.info({ envPath }, "已写入 Hermes .env (DeepSeek 配置)");

    // 3. 通过 `hermes config set model <name>` 设置默认模型（非交互）
    // 注意：DeepSeek 模型在 Hermes 中通常以 "deepseek/<model>" 或 "<model>" 形式引用
    // 尝试两种格式
    const modelCandidates = [
      modelName,
      `deepseek/${modelName}`,
      "deepseek-chat",
    ];
    let modelSet = false;
    for (const candidate of modelCandidates) {
      const setResult = await execHermes(
        ["config", "set", "model", candidate],
        15_000
      );
      if (setResult.success) {
        modelSet = true;
        logger.info({ model: candidate }, "已设置 Hermes 默认模型");
        break;
      }
    }
    if (!modelSet) {
      // config set 失败不致命，.env 已写入，hermes 会自动检测 DEEPSEEK_API_KEY
      logger.warn("hermes config set model 失败，但 .env 已写入，将依赖自动检测");
    }

    return {
      success: true,
      configured: { provider: "deepseek", model: modelName, baseUrl },
    };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 检测 Hermes 是否已配置 LLM 模型
 * 通过 `hermes config show` 检查 Model 字段是否为空
 */
export async function isHermesModelConfigured(): Promise<{
  configured: boolean;
  model?: string;
  hasApiKey: boolean;
}> {
  // 1. 检查 .env 文件中是否有 DEEPSEEK_API_KEY
  let hasApiKey = false;
  try {
    const fs = require("fs").promises;
    const envPath = getHermesEnvPath();
    const envContent = await fs.readFile(envPath, "utf-8");
    hasApiKey = /^DEEPSEEK_API_KEY=.+/m.test(envContent);
  } catch {
    hasApiKey = false;
  }

  // 2. 检查 config 中的 model
  const result = await execHermes(["config", "show"], 10_000);
  if (result.success) {
    const modelMatch = result.stdout.match(/Model:\s*(.+)/i);
    const model = modelMatch?.[1]?.trim();
    const configured = !!model && !model.includes("not set") && model.length > 0;
    return { configured, model, hasApiKey };
  }

  return { configured: false, hasApiKey };
}

// ============ 安装管理 ============

/**
 * 查找 hermes 可执行文件路径
 * Windows: 优先检查 Scripts 目录（pip --user 安装时不在系统 PATH）
 * Linux/macOS: 直接使用 "hermes"（通常在 PATH 中）
 */
export async function findHermesExe(): Promise<string | null> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  // 1. 先尝试直接调用 hermes（如果在 PATH 中）
  try {
    const testCmd = process.platform === "win32" ? "where hermes" : "which hermes";
    const { stdout } = await execAsync(testCmd, { timeout: 5000 });
    const firstLine = stdout.trim().split("\n")[0].trim();
    if (firstLine) return firstLine;
  } catch {
    // 不在 PATH 中，继续查找
  }

  // 2. Windows: 检查常见 Scripts 目录
  if (process.platform === "win32") {
    const path = require("path");
    const fs = require("fs").promises;
    const candidates = [
      path.join(process.env.APPDATA || "", "Python", "Python313", "Scripts", "hermes.exe"),
      path.join(process.env.APPDATA || "", "Python", "Python312", "Scripts", "hermes.exe"),
      path.join(process.env.APPDATA || "", "Python", "Python311", "Scripts", "hermes.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python313", "Scripts", "hermes.exe"),
      path.join(process.env.LOCALAPPDATA || "", "Programs", "Python", "Python312", "Scripts", "hermes.exe"),
    ];
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // 继续检查下一个
      }
    }
  }

  return null;
}

/**
 * 检测系统是否已安装 hermes-agent（检查 pip 包）
 * 通过 `pip show hermes-agent` 命令
 *
 * 性能优化：pip show 会启动 Python 子进程，较慢（~1-2s）。
 * 安装状态很少变化，缓存 5 分钟避免频繁轮询导致系统卡顿。
 */
let _detectCache: { result: { installed: boolean; version?: string; path?: string }; ts: number } | null = null;
const DETECT_CACHE_MS = 5 * 60 * 1000; // 5 分钟

export async function detectHermesInstall(): Promise<{
  installed: boolean;
  version?: string;
  path?: string;
}> {
  // 命中缓存直接返回
  if (_detectCache && Date.now() - _detectCache.ts < DETECT_CACHE_MS) {
    return _detectCache.result;
  }

  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    // Windows 优先用 pip，回退 pip3
    const cmd = process.platform === "win32" ? "pip show hermes-agent" : "pip3 show hermes-agent";
    const { stdout } = await execAsync(cmd, { timeout: 15000 });
    const versionMatch = stdout.match(/Version:\s*(.+)/);
    const locationMatch = stdout.match(/Location:\s*(.+)/);
    const result = {
      installed: true,
      version: versionMatch?.[1]?.trim(),
      path: locationMatch?.[1]?.trim(),
    };
    _detectCache = { result, ts: Date.now() };
    return result;
  } catch {
    const result = { installed: false };
    _detectCache = { result, ts: Date.now() };
    return result;
  }
}

/** 清除安装检测缓存（手动安装/卸载后调用） */
export function clearHermesDetectCache(): void {
  _detectCache = null;
}

/**
 * 安装 hermes-agent（pip install hermes-agent）
 * 返回安装结果
 */
export async function installHermesAgent(): Promise<{
  success: boolean;
  output?: string;
  error?: string;
}> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    logger.info("开始安装 hermes-agent...");
    const cmd = process.platform === "win32"
      ? "pip install hermes-agent"
      : "pip3 install hermes-agent";
    const { stdout, stderr } = await execAsync(cmd, { timeout: 300_000 }); // 5 分钟超时
    logger.info({ stdout: stdout.slice(0, 500) }, "hermes-agent 安装完成");
    return {
      success: true,
      output: stdout + (stderr ? `\n${stderr}` : ""),
    };
  } catch (e) {
    logger.error({ err: e }, "hermes-agent 安装失败");
    return {
      success: false,
      error: (e as Error).message,
    };
  }
}

/**
 * 启动 Hermes Agent Dashboard 服务（后台进程）
 * 使用 `hermes dashboard --port 9119 --no-open --skip-build`
 * 默认端口 9119（Hermes Dashboard 默认端口）
 */
export async function startHermesAgent(port: number = 9119): Promise<{
  success: boolean;
  pid?: number;
  error?: string;
}> {
  const { spawn } = await import("child_process");

  try {
    const hermesExe = await findHermesExe();
    if (!hermesExe) {
      return { success: false, error: "未找到 hermes 可执行文件，请确认已安装 hermes-agent" };
    }

    logger.info({ hermesExe, port }, "启动 Hermes Agent Dashboard...");

    const child = spawn(hermesExe, [
      "dashboard",
      "--port", String(port),
      "--no-open",
      "--skip-build", // 跳过 npm build（非交互环境）
    ], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      cwd: process.env.HOME || process.env.USERPROFILE || undefined,
    });

    // 等待短暂时间确认进程未立即退出
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (child.pid && !child.killed) {
      logger.info({ pid: child.pid, port }, "Hermes Agent Dashboard 已启动");
      child.unref();
      return { success: true, pid: child.pid };
    }

    // 检查进程是否已退出
    if (child.exitCode !== null) {
      return { success: false, error: `Hermes 进程立即退出（exit code ${child.exitCode}），可能缺少配置或依赖` };
    }

    return { success: false, error: "无法获取进程 PID，Hermes 可能未正确启动" };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 停止 Hermes Agent 服务
 * 通过端口查找并终止进程
 */
export async function stopHermesAgent(port: number = 9119): Promise<{
  success: boolean;
  error?: string;
}> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    if (process.platform === "win32") {
      // Windows: 通过端口查找 PID 并终止
      const { stdout } = await execAsync(
        `netstat -ano | findstr :${port}`,
        { timeout: 5000 }
      );
      const pids = new Set<string>();
      for (const line of stdout.trim().split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].endsWith(`:${port}`) && parts[3] === "LISTENING") {
          pids.add(parts[4]);
        }
      }
      for (const pid of pids) {
        await execAsync(`taskkill /PID ${pid} /F`, { timeout: 5000 });
      }
      return { success: true };
    } else {
      // Linux/macOS: 通过 lsof 查找并终止
      try {
        const { stdout } = await execAsync(`lsof -ti :${port}`, { timeout: 5000 });
        const pids = stdout.trim().split("\n").filter(Boolean);
        for (const pid of pids) {
          await execAsync(`kill -9 ${pid}`, { timeout: 5000 });
        }
      } catch {
        // 没有进程占用端口
      }
      return { success: true };
    }
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ============ /learn 回写：Hermes 自动学习成果同步到 LynnHub ============

/**
 * 扫描用户 profile/skills/ 目录，将 Hermes /learn 自动生成的 skill 回写到 LynnHub Skill 表
 *
 * Hermes 执行 `--learn` 后，会在 profile/skills/ 下生成 YAML/MD 格式的 skill 文件。
 * 本函数：
 * 1. 扫描 profile/skills/ 目录
 * 2. 解析每个 skill 文件（YAML front matter + MD 正文）
 * 3. 与 LynnHub Skill 表比对（按 name + userId 去重）
 * 4. 新增的 skill 写入数据库，source = "hermes-learned"
 *
 * @returns 新增的 skill 数量 + 详情
 */
export async function syncLearnedSkills(userId: string): Promise<{
  success: boolean;
  newCount: number;
  skills: Array<{ id: string; name: string; source: string }>;
  error?: string;
}> {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  try {
    const skillsDir = path.join(getUserHermesDir(userId), "skills");
    if (!fs.existsSync(skillsDir)) {
      return { success: true, newCount: 0, skills: [] };
    }

    // 扫描 skill 文件（.yaml/.yml/.md）
    const files = fs.readdirSync(skillsDir).filter((f: string) =>
      /\.(ya?ml|md)$/i.test(f)
    );

    const newSkills: Array<{ id: string; name: string; source: string }> = [];
    let newCount = 0;

    for (const file of files) {
      const filePath = path.join(skillsDir, file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const parsed = parseHermesSkillFile(content, file);
        if (!parsed.name) continue;

        // 去重：同名 + 同 userId 的 skill 不重复创建
        const existing = await prisma.skill.findFirst({
          where: { name: parsed.name, userId },
          select: { id: true },
        });
        if (existing) continue;

        // 写入 LynnHub Skill 表
        const skill = await prisma.skill.create({
          data: {
            name: parsed.name,
            description: parsed.description || `Hermes 自动学习技能（来源：${file}）`,
            category: parsed.category || "general",
            content: parsed.content,
            parameters: (parsed.parameters || []) as never,
            promptTemplate: parsed.promptTemplate || "",
            source: "hermes-learned",
            tags: parsed.tags || ["hermes", "auto-learned"],
            userId,
          },
        });
        newCount++;
        newSkills.push({ id: skill.id, name: skill.name, source: skill.source });
      } catch (e) {
        logger.warn({ err: e, file }, "解析 Hermes skill 文件失败，跳过");
      }
    }

    logger.info({ userId, newCount }, "Hermes learned skills 同步完成");
    return { success: true, newCount, skills: newSkills };
  } catch (e) {
    return { success: false, newCount: 0, skills: [], error: (e as Error).message };
  }
}

/**
 * 解析 Hermes skill 文件内容
 * 支持 YAML front matter（--- 包裹）+ Markdown 正文
 */
function parseHermesSkillFile(content: string, fileName: string): {
  name: string;
  description?: string;
  category?: string;
  content: string;
  parameters?: unknown[];
  promptTemplate?: string;
  tags?: string[];
} {
  // 简易 YAML front matter 解析
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (fmMatch) {
    const frontMatter = fmMatch[1];
    const body = fmMatch[2];
    const meta: Record<string, string> = {};
    for (const line of frontMatter.split("\n")) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) meta[m[1].trim()] = m[2].trim().replace(/^["'](.*)["']$/, "$1");
    }
    return {
      name: meta.name || fileName.replace(/\.\w+$/, ""),
      description: meta.description,
      category: meta.category,
      content: body.trim(),
      promptTemplate: meta.prompt || "",
      tags: meta.tags ? meta.tags.split(",").map((t) => t.trim()) : undefined,
    };
  }

  // 纯 Markdown：首行 # 作为 name，其余作为 content
  const lines = content.split("\n");
  const h1Line = lines.find((l) => l.startsWith("# "));
  return {
    name: h1Line ? h1Line.replace(/^#\s*/, "").trim() : fileName.replace(/\.\w+$/, ""),
    content: content.trim(),
  };
}

/**
 * 列出用户 profile 下的所有 learned skills（文件系统级别）
 */
export async function listLearnedSkills(userId: string): Promise<{
  success: boolean;
  skills: Array<{ fileName: string; name: string; size: number; mtime: Date }>;
}> {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  try {
    const skillsDir = path.join(getUserHermesDir(userId), "skills");
    if (!fs.existsSync(skillsDir)) {
      return { success: true, skills: [] };
    }

    const files = fs.readdirSync(skillsDir).filter((f: string) =>
      /\.(ya?ml|md)$/i.test(f)
    );

    const skills = files.map((file: string) => {
      const filePath = path.join(skillsDir, file);
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = parseHermesSkillFile(content, file);
      return {
        fileName: file,
        name: parsed.name || file,
        size: stat.size,
        mtime: stat.mtime,
      };
    });

    return { success: true, skills };
  } catch {
    return { success: false, skills: [] };
  }
}

// ============ Skills 双向同步：LynnHub ↔ Hermes skills 目录 ============

/**
 * 导出 LynnHub Skill 到 Hermes skills 目录（LynnHub → Hermes）
 *
 * 将 Skill 写为 YAML front matter + Markdown 格式，
 * 放入 profile/skills/<skill-name>.md
 *
 * @returns 导出的文件路径
 */
export async function exportSkillToHermes(
  skillId: string,
  userId: string
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  try {
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return { success: false, error: "Skill 不存在" };
    }

    const skillsDir = path.join(getUserHermesDir(userId), "skills");
    fs.mkdirSync(skillsDir, { recursive: true });

    // 文件名：skill name 转 kebab-case + .md
    const fileName = skill.name
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "") + ".md";

    const filePath = path.join(skillsDir, fileName);

    // YAML front matter + Markdown 正文
    const tags = Array.isArray(skill.tags) ? (skill.tags as string[]).join(", ") : "";
    const yaml = [
      "---",
      `name: "${skill.name.replace(/"/g, '\\"')}"`,
      `description: "${(skill.description || "").replace(/"/g, '\\"').replace(/\n/g, " ")}"`,
      `category: "${skill.category || "general"}"`,
      tags ? `tags: ${tags}` : null,
      skill.promptTemplate ? `prompt: "${skill.promptTemplate.replace(/"/g, '\\"').slice(0, 200)}"` : null,
      "---",
      "",
      skill.content || "",
      "",
    ].filter(Boolean).join("\n");

    fs.writeFileSync(filePath, yaml, "utf-8");
    logger.info({ skillId, userId, filePath }, "Skill 已导出到 Hermes");

    return { success: true, filePath };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 从 Hermes skills 目录导入 skill 到 LynnHub（Hermes → LynnHub）
 */
export async function importSkillFromHermes(
  fileName: string,
  userId: string
): Promise<{ success: boolean; skillId?: string; error?: string }> {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  try {
    const filePath = path.join(getUserHermesDir(userId), "skills", fileName);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "文件不存在" };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = parseHermesSkillFile(content, fileName);

    // 去重
    const existing = await prisma.skill.findFirst({
      where: { name: parsed.name, userId },
      select: { id: true },
    });
    if (existing) {
      return { success: true, skillId: existing.id };
    }

    const skill = await prisma.skill.create({
      data: {
        name: parsed.name,
        description: parsed.description || "从 Hermes 导入",
        category: parsed.category || "general",
        content: parsed.content,
        parameters: (parsed.parameters || []) as never,
        promptTemplate: parsed.promptTemplate || "",
        source: "hermes-imported",
        tags: parsed.tags || ["hermes"],
        userId,
      },
    });

    return { success: true, skillId: skill.id };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ============ Hermes Cron 自动化（接管 AI 巡检） ============

/**
 * 列出用户 profile 下的 Hermes cron jobs
 * 通过 `hermes cron list` 命令
 */
export async function listHermesCronJobs(userId: string): Promise<{
  success: boolean;
  jobs: Array<{ id?: string; schedule?: string; prompt?: string; enabled?: boolean }>;
  error?: string;
}> {
  const result = await execHermes(["cron", "list"], 15_000, userId);
  if (!result.success) {
    return { success: false, jobs: [], error: result.error };
  }

  // 解析 cron list 输出（每行一个 job）
  const jobs: Array<{ id?: string; schedule?: string; prompt?: string; enabled?: boolean }> = [];
  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("ID") || trimmed.startsWith("-")) continue;
    // 尝试解析表格行：ID | Schedule | Prompt | Enabled
    const parts = trimmed.split(/\s*\|\s*/);
    if (parts.length >= 2) {
      jobs.push({
        id: parts[0]?.trim(),
        schedule: parts[1]?.trim(),
        prompt: parts[2]?.trim(),
        enabled: parts[3]?.trim().toLowerCase() === "true",
      });
    }
  }

  return { success: true, jobs };
}

/**
 * 创建 Hermes cron job（用于 AI 巡检自动化）
 * 通过 `hermes cron add --schedule "<cron>" --prompt "<prompt>"`
 */
export async function createHermesCronJob(
  userId: string,
  schedule: string,
  prompt: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const result = await execHermes(
    ["cron", "add", "--schedule", schedule, "--prompt", prompt, "--yolo"],
    15_000,
    userId
  );
  if (!result.success) {
    return { success: false, error: result.error || result.stderr };
  }

  // 尝试从输出中提取 job ID
  const idMatch = result.stdout.match(/(?:job[_-]?id|id)[:\s]+([\w-]+)/i);
  return {
    success: true,
    jobId: idMatch?.[1]?.trim(),
  };
}

/**
 * 删除 Hermes cron job
 */
export async function deleteHermesCronJob(
  userId: string,
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await execHermes(["cron", "delete", jobId], 15_000, userId);
  if (!result.success) {
    return { success: false, error: result.error || result.stderr };
  }
  return { success: true };
}

// ============ 持久化记忆搜索 ============

/**
 * 搜索用户的 Hermes 持久化记忆
 *
 * Hermes CLI 的 memory 子命令不支持 search（仅 setup/status/off/reset），
 * 因此直接读取 profile/memory/ 目录下的文件，用关键词匹配实现简易搜索。
 * 返回与 query 最相关的记忆条目。
 */
export async function searchUserMemory(
  userId: string,
  query: string
): Promise<{
  success: boolean;
  results: Array<{ content: string; score?: number; createdAt?: string }>;
  error?: string;
}> {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const memoryDir = path.join(getUserHermesDir(userId), "memory");
  if (!fs.existsSync(memoryDir)) {
    return { success: true, results: [] };
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 1);
  const results: Array<{ content: string; score: number; createdAt?: string }> = [];

  try {
    const files = fs.readdirSync(memoryDir).filter((f: string) =>
      /\.(txt|md|json|yaml|yml)$/i.test(f)
    );

    for (const file of files) {
      const filePath = path.join(memoryDir, file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const contentLower = content.toLowerCase();

        // 计算关键词匹配分数
        let score = 0;
        for (const word of queryWords) {
          if (contentLower.includes(word)) score++;
        }
        // 整体 query 匹配额外加分
        if (queryLower && contentLower.includes(queryLower)) score += 5;

        if (score > 0) {
          const stat = fs.statSync(filePath);
          results.push({
            content: content.slice(0, 500),
            score,
            createdAt: stat.mtime.toISOString(),
          });
        }
      } catch {
        // 单个文件读取失败跳过
      }
    }
  } catch {
    return { success: false, results: [], error: "读取记忆目录失败" };
  }

  // 按分数降序排列，取前 10 条
  results.sort((a, b) => b.score - a.score);
  return { success: true, results: results.slice(0, 10) };
}

/**
 * 获取用户 profile 状态（记忆数、技能数、会话数等）
 */
export async function getUserProfileStatus(userId: string): Promise<{
  success: boolean;
  profileDir: string;
  memoryCount: number;
  skillsCount: number;
  sessionsCount: number;
  exists: boolean;
}> {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const profileDir = getUserHermesDir(userId);
  const exists = fs.existsSync(profileDir);

  if (!exists) {
    return {
      success: true,
      profileDir,
      memoryCount: 0,
      skillsCount: 0,
      sessionsCount: 0,
      exists: false,
    };
  }

  const countFiles = (subDir: string) => {
    const dir = path.join(profileDir, subDir);
    if (!fs.existsSync(dir)) return 0;
    try {
      return fs.readdirSync(dir).filter((f: string) => !f.startsWith(".")).length;
    } catch {
      return 0;
    }
  };

  return {
    success: true,
    profileDir,
    memoryCount: countFiles("memory"),
    skillsCount: countFiles("skills"),
    sessionsCount: countFiles("sessions"),
    exists: true,
  };
}

// ============ Hermes Agent 接管 AI 助理（模式 C） ============

/**
 * 构建带记忆上下文的 AI 助理 prompt
 *
 * 模式 C 核心能力：持久化记忆 + 跨会话上下文
 * - 从 Hermes profile 搜索相关记忆（FTS5 全文搜索）
 * - 从 LynnHub 数据库获取看板/灵感摘要
 * - 将上下文注入 prompt，让 Hermes 能引用之前的对话和任务
 */
export async function buildAssistantPrompt(
  userId: string,
  userMessage: string
): Promise<string> {
  const parts: string[] = [];

  // 1. 注入持久化记忆（从 Hermes profile 搜索相关上下文）
  try {
    const memoryResult = await searchUserMemory(userId, userMessage.slice(0, 100));
    if (memoryResult.success && memoryResult.results.length > 0) {
      const memoryText = memoryResult.results
        .slice(0, 5)
        .map((r, i) => `[${i + 1}] ${r.content}`)
        .join("\n");
      parts.push(`## 你之前的记忆（跨会话保留）\n${memoryText}`);
    }
  } catch {
    // 记忆搜索失败不阻塞
  }

  // 2. 注入 LynnHub 看板摘要（让 Hermes 知道用户当前的任务状态）
  try {
    const [activeTasks, recentIdeas] = await Promise.all([
      prisma.task.count({ where: { userId, status: "active" } }),
      prisma.idea.count({ where: { userId, status: "inbox" } }),
    ]);
    parts.push(`## 用户当前状态\n- 进行中任务：${activeTasks} 个\n- 收件箱灵感：${recentIdeas} 条`);
  } catch {
    // 数据库查询失败不阻塞
  }

  // 3. 注入用户已学会的技能数（体现自动成长）
  try {
    const profileStatus = await getUserProfileStatus(userId);
    if (profileStatus.exists) {
      parts.push(`## 你的成长状态\n- 已学习技能：${profileStatus.skillsCount} 个\n- 持久化记忆：${profileStatus.memoryCount} 条\n- 会话历史：${profileStatus.sessionsCount} 个`);
    }
  } catch {
    // 成长状态查询失败不阻塞
  }

  // 4. 用户消息
  parts.push(`## 用户请求\n${userMessage}`);

  // 5. 行为指令
  parts.push(`## 行为要求
- 你是 LynnHub 的 AI 超级助理，由 Hermes Agent 驱动，拥有持久化记忆和持续学习能力
- 基于你之前的记忆和上下文回应用户，能引用之前的对话内容
- 如果需要操作系统、执行命令、访问数据，直接使用你的工具能力完成
- 任务完成后会自动学习（--learn），将新技能保存到你的 profile
- 用中文回复，简洁友好`);

  return parts.join("\n\n");
}

/**
 * Hermes Agent 接管 AI 助理：执行用户消息
 *
 * 这是模式 C 的核心入口：
 * - 使用持久化 profile（记忆跨会话保留）
 * - 注入记忆上下文（让 Hermes 能引用之前的内容）
 * - 启用 --learn（任务完成后自动学习新技能）
 * - 失败时返回 error，由调用方回退到 LLM 模式
 */
export async function executeAssistantViaHermes(
  userId: string,
  userMessage: string,
  timeoutSeconds: number = 120
): Promise<{
  success: boolean;
  output: string;
  error?: string;
  durationMs?: number;
  learned: boolean;
}> {
  const start = Date.now();

  // 1. 获取 Hermes 配置
  const config = await getHermesConfig(userId);
  if (!config || !config.enabled) {
    return {
      success: false,
      output: "",
      error: "Hermes Agent 未启用",
      durationMs: Date.now() - start,
      learned: false,
    };
  }
  if (config.status !== "running") {
    return {
      success: false,
      output: "",
      error: `Hermes Agent 状态为 ${config.status}，请先启动`,
      durationMs: Date.now() - start,
      learned: false,
    };
  }

  // 2. 构建带记忆上下文的 prompt
  const fullPrompt = await buildAssistantPrompt(userId, userMessage);

  // 3. 通过 Hermes 执行（带持久化 profile + --learn 自动学习）
  const result = await executeHermesTask(
    config,
    {
      prompt: fullPrompt,
      mode: "auto",
      timeout: timeoutSeconds,
    },
    userId
  );

  // 4. 任务成功后异步同步 learned skills（不阻塞响应）
  if (result.success) {
    syncLearnedSkills(userId).catch((e) => {
      logger.warn({ err: e }, "AI 助理 Hermes 模式：同步 learned skills 失败（非阻塞）");
    });
  }

  return {
    success: result.success,
    output: result.output,
    error: result.error,
    durationMs: result.durationMs,
    learned: result.success,
  };
}

/**
 * 生成主动汇报（模式 C：持续工作 / 主动汇报 / 跨平台响应）
 *
 * Hermes Cron 定时触发，让 Hermes 主动分析用户数据并生成汇报
 * 汇报内容存入 HermesReport 表，并通过 Web Push 跨平台推送
 */
export async function generateProactiveReport(
  userId: string,
  type: "daily" | "weekly" | "patrol" = "daily"
): Promise<{
  success: boolean;
  reportId?: string;
  title?: string;
  content?: string;
  pushed?: boolean;
  error?: string;
  durationMs?: number;
}> {
  const start = Date.now();

  const config = await getHermesConfig(userId);
  if (!config || !config.enabled || config.status !== "running") {
    return {
      success: false,
      error: "Hermes Agent 未启用或未运行",
      durationMs: Date.now() - start,
    };
  }

  // 1. 收集用户数据摘要
  let dataSummary = "";
  try {
    const [activeTasks, doneTasks, inboxIdeas, cognitions] = await Promise.all([
      prisma.task.findMany({
        where: { userId, status: "active" },
        select: { content: true, column: true },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.count({ where: { userId, status: "done" } }),
      prisma.idea.findMany({
        where: { userId, status: "inbox" },
        select: { content: true, createdAt: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.cognition.findMany({
        where: { userId },
        select: { content: true, type: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    dataSummary = `## 用户当前数据
### 进行中任务（${activeTasks.length} 个）
${activeTasks.map((t, i) => `${i + 1}. [${t.column}] ${t.content.slice(0, 80)}`).join("\n") || "无"}

### 已完成任务：${doneTasks} 个

### 最近灵感（${inboxIdeas.length} 条）
${inboxIdeas.map((t, i) => `${i + 1}. ${t.content.slice(0, 80)}`).join("\n") || "无"}

### 最近认知（${cognitions.length} 条）
${cognitions.map((c, i) => `${i + 1}. [${c.type}] ${c.content.slice(0, 80)}`).join("\n") || "无"}`;
  } catch {
    dataSummary = "（用户数据获取失败）";
  }

  // 2. 构建 Hermes prompt
  const typeDesc =
    type === "daily" ? "每日" : type === "weekly" ? "每周" : "巡检";
  const prompt = `## 任务：生成${typeDesc}主动汇报

${dataSummary}

## 要求
请基于以上用户数据，生成一份${typeDesc}主动汇报，包括：
1. 当前进度总结（任务、灵感、认知的变化）
2. 需要关注的事项（即将到期、积压、异常）
3. 建议的下一步行动（2-3 条具体建议）
4. 鼓励和反思（基于认知库中的经验）

用 Markdown 格式输出，简洁有力。`;

  // 3. 通过 Hermes 执行（带持久化记忆 + 学习）
  const result = await executeHermesTask(
    config,
    { prompt, mode: "auto", timeout: 120 },
    userId
  );

  // 4. 存储汇报到数据库
  const title = `${typeDesc}汇报 - ${new Date().toLocaleString("zh-CN", { dateStyle: "short" })}`;
  let reportId: string | undefined;
  let pushed = false;

  try {
    const report = await prisma.hermesReport.create({
      data: {
        userId,
        type,
        title,
        content: result.success ? result.output : "生成失败",
        rawOutput: result.output,
        trigger: type === "patrol" ? "patrol" : "cron",
        pushed: false,
        durationMs: Date.now() - start,
        error: result.error,
      },
    });
    reportId = report.id;
  } catch (e) {
    logger.warn({ err: e }, "存储 HermesReport 失败（非阻塞）");
  }

  // 5. 通过 Web Push 跨平台推送
  if (result.success && reportId) {
    try {
      const pushModule = await import("@/lib/push");
      const sendPushNotification = pushModule.sendPushNotification;
      const subs = await prisma.pushSubscription.findMany({ where: { userId } });
      let sentCount = 0;
      const preview = result.output.slice(0, 200).replace(/[#*`\n]/g, " ").trim();
      for (const sub of subs) {
        const subscription = {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        };
        const pushResult = await sendPushNotification(subscription, {
          title: `🤖 ${title}`,
          body: preview || "Hermes 已生成新的汇报，请查看",
        });
        if (pushResult.success) sentCount++;
      }
      pushed = sentCount > 0;
      if (pushed) {
        await prisma.hermesReport.update({
          where: { id: reportId },
          data: { pushed: true, pushChannel: "web_push" },
        });
      }
    } catch {
      // 推送失败不影响汇报存储
    }
  }

  // 6. 异步同步 learned skills
  if (result.success) {
    syncLearnedSkills(userId).catch(() => {});
  }

  return {
    success: result.success,
    reportId,
    title,
    content: result.output,
    pushed,
    error: result.error,
    durationMs: Date.now() - start,
  };
}

/**
 * Hermes Cron 接管 AI 巡检
 *
 * 将 LynnHub 的 PatrolRule 转换为 Hermes Cron 任务
 * Hermes 会按照 cron 表达式自动执行巡检，并主动汇报结果
 */
export async function takeoverPatrolWithHermes(
  userId: string
): Promise<{
  success: boolean;
  migratedCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let migratedCount = 0;

  // 1. 获取用户所有启用的巡检规则
  const rules = await prisma.patrolRule.findMany({
    where: { userId, enabled: true },
  });

  if (rules.length === 0) {
    return { success: true, migratedCount: 0, errors: ["没有启用的巡检规则"] };
  }

  // 2. 将每条规则转换为 Hermes Cron 任务
  for (const rule of rules) {
    // 解析 triggerTime（支持 "HH:mm" 或 cron 表达式）
    let schedule = rule.triggerTime || "0 9 * * *";
    if (/^\d{1,2}:\d{2}$/.test(schedule)) {
      const [h, m] = schedule.split(":");
      schedule = `${m} ${h} * * *`;
    }

    const prompt = `## AI 巡检任务：${rule.name}

${rule.description || ""}

### 巡检提示词
${rule.prompt}

### 要求
1. 按照巡检提示词分析相关数据
2. 如果发现问题，生成详细报告
3. 用 Markdown 格式输出巡检结果
4. 如果有紧急事项，明确标注「⚠️ 需要立即处理」`;

    const result = await createHermesCronJob(userId, schedule, prompt);
    if (result.success) {
      migratedCount++;
    } else {
      errors.push(`规则「${rule.name}」迁移失败：${result.error}`);
    }
  }

  return {
    success: migratedCount > 0,
    migratedCount,
    errors,
  };
}

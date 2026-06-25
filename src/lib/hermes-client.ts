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

/**
 * 构建 hermes CLI 调用所需的安全环境
 *
 * 根因：TRAE 沙箱限制了对 C:\Users\...\AppData\Local\hermes\logs\ 的写入，
 * 导致 hermes 启动时 concurrent_log_handler 抛出 OSError: Bad file descriptor。
 *
 * 方案：将 LOCALAPPDATA 重定向到临时目录，并复制 hermes 配置文件过去，
 * 使 hermes 能在临时目录中读写日志，同时保留原有的模型/API Key 配置。
 */
function buildHermesEnv(): NodeJS.ProcessEnv {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const os = require("os") as typeof import("os");

  const origLocal = process.env.LOCALAPPDATA || "";
  const origHermesDir = path.join(origLocal, "hermes");
  const tmpLocal = path.join(os.tmpdir(), "hermes_local_run");
  const tmpHermesDir = path.join(tmpLocal, "hermes");

  // 确保临时目录结构存在
  fs.mkdirSync(path.join(tmpHermesDir, "logs"), { recursive: true });

  // 复制配置文件（.env 含 API Key，config.yaml 含模型设置，auth.json 含认证）
  if (fs.existsSync(origHermesDir)) {
    for (const file of [".env", "config.yaml", "auth.json"]) {
      const src = path.join(origHermesDir, file);
      const dst = path.join(tmpHermesDir, file);
      if (fs.existsSync(src)) {
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
    LOCALAPPDATA: tmpLocal,
  };
}

/** 执行 hermes 命令并返回 stdout */
async function execHermes(args: string[], timeoutMs: number = 30_000): Promise<{
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
      env: buildHermesEnv(),
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
 * 执行 Hermes 任务（通过 CLI）
 *
 * 架构说明：
 * Hermes Dashboard 是管理界面（查看 sessions/config/skills），没有通用 prompt 执行 API。
 * 任务执行统一通过 CLI `hermes -z "prompt" --yolo`，hermes 内部会自动调用工具完成任务。
 *
 * 执行流程：
 * 1. 预检 LLM 模型是否已配置（未配置时自动配置）
 * 2. 通过 CLI 执行任务（execHermes 内部会设置安全环境绕过沙箱限制）
 */
export async function executeHermesTask(
  config: HermesConfig,
  request: HermesTaskRequest
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

  // 2. 通过 CLI 执行任务
  const args = ["-z", request.prompt, "--yolo"];

  const result = await execHermes(args, timeoutMs);
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

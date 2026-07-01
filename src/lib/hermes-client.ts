// Hermes Agent 客户端
// 封装与本地 Hermes Agent HTTP API 的交互
// Hermes Agent 是 NousResearch 开发的开源本地 AI 代理框架，支持：
// - Computer Use（桌面控制，通过 trycua 支持 Windows/Linux/macOS）
// - Shell 命令执行
// - MCP 工具集成
// - Skills Hub（17 类 672+ 技能）
// - 自我进化

import { createHmac } from "crypto";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { embedText, float32ToBuffer } from "@/lib/embedding";

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

// ============ WS 远程指令分发（共享函数）============
//
// 架构（2026-07-01 彻底修正）：
// - 服务器禁止执行任何 CLI / agent / pip install（安全架构）
// - 所有 HermesAgent 任务必须通过 WS 网关下发到用户本地设备执行
//   （桌面端 Rust ws_client.rs 或 Web 端 use-device-ws.ts 均可接收）
// - 接收端调用本地 HermesAgent Dashboard HTTP API (127.0.0.1:9119/api/execute)
//
// 本函数被以下调用方共享：
// - tool-executor.ts executeHermesExecute / executeHermesListSkills
// - hermes-client.ts executeHermesTask（被 flow-engine / 主动汇报等调用）
export async function dispatchRemoteCommand(
  userId: string,
  command: string,
  timeoutSec: number = 120
): Promise<{
  success: boolean;
  output: string;
  error?: string;
  durationMs?: number;
  route?: string;
}> {
  const { randomUUID } = await import("crypto");
  const WS_GATEWAY_URL = process.env.WS_GATEWAY_URL || "http://localhost:3001";
  const commandId = randomUUID();

  // 1. 写入 RemoteCommand 记录
  const record = await prisma.remoteCommand.create({
    data: {
      commandId,
      userId,
      command,
      source: "assistant",
      status: "pending",
      route: "pending",
    },
  });

  // 2. 通过 WS 网关下发到用户在线设备（桌面端或 Web 端）
  let dispatched = false;
  let dispatchReason = "";
  try {
    const resp = await fetch(`${WS_GATEWAY_URL}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, command, commandId }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await resp.json().catch(() => ({}));
    dispatched = !!data.dispatched;
    dispatchReason = data.reason || "";
  } catch (e) {
    dispatchReason = "WS 网关不可达：" + (e as Error).message;
  }

  if (!dispatched) {
    await prisma.remoteCommand.update({
      where: { id: record.id },
      data: { status: "failed", error: dispatchReason || "无在线设备" },
    });
    return {
      success: false,
      output: "",
      error: dispatchReason || "未检测到在线设备。请在您的电脑上打开 Lynx 桌面端或 Web 端并登录，确保至少一台设备在线。",
    };
  }

  // 3. 轮询等待设备回传结果
  const deadline = Date.now() + timeoutSec * 1000;
  const pollInterval = 1500;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollInterval));
    const cmd = await prisma.remoteCommand.findUnique({ where: { commandId } });
    if (!cmd) break;
    if (cmd.status === "completed") {
      const resultData = (cmd.result as Record<string, unknown> | null) || {};
      const output = typeof resultData.output === "string"
        ? resultData.output
        : (typeof cmd.result === "string" ? cmd.result : JSON.stringify(resultData));
      return {
        success: true,
        output,
        durationMs: cmd.durationMs || 0,
        route: cmd.route || undefined,
      };
    }
    if (cmd.status === "failed" || cmd.status === "timeout") {
      return {
        success: false,
        output: "",
        error: cmd.error || "远程执行失败",
        durationMs: cmd.durationMs || 0,
        route: cmd.route || undefined,
      };
    }
  }

  // 超时
  try {
    await prisma.remoteCommand.update({
      where: { id: record.id },
      data: { status: "timeout", error: `执行超时（${timeoutSec}秒）`, completedAt: new Date() },
    });
  } catch {}
  return { success: false, output: "", error: `远程执行超时（${timeoutSec}秒），指令已下发但未收到结果` };
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
  // 强制使用项目目录下的 .lynnhub，避免占用 C 盘
  // 项目根目录 = 当前文件向上 3 层（src/lib/hermes-client.ts → src/lib → src → 项目根）
  const projectRoot = path.resolve(__dirname, "..", "..", "..");
  return path.join(projectRoot, ".lynnhub", "hermes-profiles", userId);
}

/**
 * 获取用户 profile 下的 hermes 数据目录
 */
export function getUserHermesDir(userId: string): string {
  const path = require("path") as typeof import("path");
  return path.join(getUserProfileDir(userId), "hermes");
}

/**
 * 检测系统中的 bash.exe 所在目录（Windows）
 * Hermes 执行 shell 命令时需要 bash，PATH 中找不到会报"Git Bash 未安装"
 * 检测顺序：D:\Git\bin → C:\Program Files\Git\bin → C:\Program Files (x86)\Git\bin
 * 结果缓存 10 分钟避免频繁文件系统访问
 */
let _bashDirCache: { dir: string | null; ts: number } | null = null;
const BASH_DIR_CACHE_MS = 10 * 60 * 1000;

function findBashDir(): string | null {
  if (process.platform !== "win32") return null;
  // 命中缓存直接返回
  if (_bashDirCache && Date.now() - _bashDirCache.ts < BASH_DIR_CACHE_MS) {
    return _bashDirCache.dir;
  }
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const candidates = [
    "D:\\Git\\bin", // PortableGit（用户配置）
    "C:\\Program Files\\Git\\bin",
    "C:\\Program Files (x86)\\Git\\bin",
  ];
  let found: string | null = null;
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, "bash.exe"))) {
        found = dir;
        break;
      }
    } catch {
      // 继续检查下一个
    }
  }
  _bashDirCache = { dir: found, ts: Date.now() };
  return found;
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
 * - Windows: 把 Git Bash 所在目录 prepend 到 PATH，避免 Hermes 报"Git Bash 未安装"
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

  // Windows: 把 Git Bash 所在目录 prepend 到 PATH，让 Hermes shell 模式能找到 bash.exe
  let finalPath = process.env.PATH || "";
  const bashDir = findBashDir();
  if (bashDir && finalPath && !finalPath.split(path.delimiter).includes(bashDir)) {
    finalPath = bashDir + path.delimiter + finalPath;
  }

  return {
    ...process.env,
    LOCALAPPDATA: profileLocal,
    ...(finalPath ? { PATH: finalPath } : {}),
  };
}

/**
 * execHermes — 服务器禁止执行 CLI（安全架构）
 *
 * HermesAgent 的所有 CLI 操作（hermes status / hermes -z / hermes skills list 等）
 * 必须在用户本地电脑执行，通过 WS 网关远程下发。
 * 服务器调用此函数时直接返回错误，避免任何子进程 spawn。
 */
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
      maxBuffer: 1024 * 1024 * 10,
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
 * 测试与 Hermes Agent Dashboard 的连接
 * 仅通过 HTTP API 检测（服务器不执行 CLI）
 */
export async function testHermesConnection(
  config: HermesConfig
): Promise<{ connected: boolean; version?: string; capabilities?: string[]; error?: string }> {
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
    return {
      connected: false,
      error: `Dashboard 返回 HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      connected: false,
      error: "无法连接 HermesAgent Dashboard。请确认用户电脑上 HermesAgent Dashboard 已启动（端口 9119），且 Web 端或桌面端已登录并在线。",
    };
  }
}



/**
 * 执行 Hermes 任务
 *
 * 架构（2026-07-01 彻底修正）：
 * 服务器禁止执行任何 CLI / agent / spawn（安全架构）。
 * 所有任务通过 WS 网关下发到用户本地设备执行：
 *   - 桌面端（Rust ws_client.rs）或 Web 端（use-device-ws.ts）均可接收
 *   - 接收端调用本地 HermesAgent Dashboard HTTP API (127.0.0.1:9119/api/execute)
 *
 * 这样无论 Web 端还是桌面端，只要用户电脑上运行着 HermesAgent Dashboard，
 * AI 助理 / 工作流 / 主动汇报都能通过在线设备真正执行本地操作（如打开浏览器）。
 */
export async function executeHermesTask(
  config: HermesConfig,
  request: HermesTaskRequest,
  userId?: string
): Promise<HermesTaskResult> {
  const start = Date.now();

  if (!userId) {
    return {
      success: false,
      output: "",
      error: "无用户上下文，无法通过 WS 远程执行",
      durationMs: 0,
    };
  }

  // 通过 WS 网关远程下发到用户在线设备（桌面端或 Web 端均可接收）
  const remoteResult = await dispatchRemoteCommand(
    userId,
    request.prompt,
    request.timeout ?? 120
  );

  return {
    success: remoteResult.success,
    output: remoteResult.output,
    error: remoteResult.error,
    durationMs: remoteResult.durationMs || Date.now() - start,
  };
}

/**
 * 获取 Hermes Skills Hub 技能列表
 * 仅通过 HTTP API 获取（服务器不执行 CLI）
 */
export async function listHermesSkills(
  config: HermesConfig,
  category?: string
): Promise<{ skills: HermesSkill[]; error?: string }> {
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
      return { skills };
    }
    return {
      skills: [],
      error: `Dashboard 返回 HTTP ${res.status}。请确认用户电脑上 HermesAgent Dashboard 已启动。`,
    };
  } catch {
    return {
      skills: [],
      error: "无法连接 HermesAgent Dashboard。技能列表需通过用户在线设备的 Dashboard HTTP API 获取。",
    };
  }
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
 * 自动配置 Hermes 的 LLM 模型（复用 Lynx 的 DeepSeek / MiMo API Key）
 *
 * 根因修复：Hermes 安装后默认未配置任何 LLM provider/model，
 * 执行 `-z` 任务时会因 "no model" 产生 "no final response was produced"。
 *
 * 本函数：
 * 1. 根据 provider 参数决定使用 DeepSeek 还是 MiMo（auto 时读 AISetting.defaultProvider）
 * 2. 从 process.env 或 AISetting 读取对应密钥 / Base URL / 模型名
 * 3. 写入 Hermes 的 .env 文件（<PROVIDER>_API_KEY / <PROVIDER>_BASE_URL / <PROVIDER>_MODEL）
 * 4. 通过 `hermes config set model <name>` 设置默认模型
 *
 * @param provider "deepseek" | "mimo" | "auto"（默认 "auto"）
 */
export async function configureHermesModel(
  provider: "deepseek" | "mimo" | "auto" = "auto"
): Promise<{
  success: boolean;
  configured?: { provider: string; model: string; baseUrl: string };
  error?: string;
}> {
  const fs = require("fs").promises;
  const path = require("path");

  try {
    // 1. 读取数据库 AISetting（用于 auto 模式决策与回退取值）
    let setting: Awaited<ReturnType<typeof prisma.aISetting.findFirst>> = null;
    try {
      setting = await prisma.aISetting.findFirst();
    } catch {
      // 数据库读取失败，继续（仅依赖环境变量）
    }

    // 2. 决定实际使用的 provider
    let actualProvider: "deepseek" | "mimo";
    if (provider === "auto") {
      const dbProvider = setting?.defaultProvider;
      if (dbProvider === "mimo") {
        actualProvider = "mimo";
      } else if (dbProvider === "deepseek") {
        actualProvider = "deepseek";
      } else {
        // 未显式配置：按可用 API Key 自动选择（优先 DeepSeek，回退 MiMo）
        const hasDeepseek = process.env.DEEPSEEK_API_KEY || setting?.deepseekApiKey;
        const hasMimo = process.env.MIMO_API_KEY || setting?.mimoApiKey;
        if (hasMimo && !hasDeepseek) {
          actualProvider = "mimo";
        } else {
          actualProvider = "deepseek";
        }
      }
    } else {
      actualProvider = provider;
    }

    // 3. 根据 provider 读取 API Key / Base URL / 模型名（优先环境变量，回退数据库）
    const envPrefix = actualProvider.toUpperCase(); // DEEPSEEK | MIMO
    let apiKey = "";
    let baseUrl = "";
    let modelName = "";

    if (actualProvider === "deepseek") {
      apiKey = process.env.DEEPSEEK_API_KEY || setting?.deepseekApiKey || "";
      baseUrl =
        process.env.DEEPSEEK_BASE_URL ||
        setting?.deepseekBaseUrl ||
        "https://api.deepseek.com/v1";
      modelName =
        process.env.DEEPSEEK_MODEL || setting?.deepseekModel || "deepseek-chat";
    } else {
      apiKey = process.env.MIMO_API_KEY || setting?.mimoApiKey || "";
      baseUrl =
        process.env.MIMO_BASE_URL ||
        setting?.mimoBaseUrl ||
        "https://api.mimo.com/v1";
      modelName = process.env.MIMO_MODEL || setting?.mimoModel || "mimo-chat";
    }

    if (!apiKey) {
      const providerName = actualProvider === "deepseek" ? "DeepSeek" : "MiMo";
      return {
        success: false,
        error: `未找到 ${providerName} API Key。请在 Lynx 根目录 .env 设置 ${envPrefix}_API_KEY，或在 AI 助理设置中配置 ${providerName} 密钥。`,
      };
    }

    // 4. 写入 Hermes .env 文件
    const envPath = getHermesEnvPath();
    const envDir = path.dirname(envPath);
    await fs.mkdir(envDir, { recursive: true });

    // 读取现有 .env（如有），保留其它键，仅更新当前 provider 相关行
    let existingLines: string[] = [];
    try {
      const existing = await fs.readFile(envPath, "utf-8");
      existingLines = existing.split(/\r?\n/).filter((l: string) => l.trim());
    } catch {
      // 文件不存在，忽略
    }

    // 移除旧的当前 provider 相关行
    const kept = existingLines.filter(
      (l: string) =>
        !l.startsWith(`${envPrefix}_API_KEY=`) &&
        !l.startsWith(`${envPrefix}_BASE_URL=`) &&
        !l.startsWith(`${envPrefix}_MODEL=`)
    );

    const newEnvContent = [
      ...kept,
      `${envPrefix}_API_KEY=${apiKey}`,
      `${envPrefix}_BASE_URL=${baseUrl}`,
      `${envPrefix}_MODEL=${modelName}`,
      "",
    ].join("\n");

    await fs.writeFile(envPath, newEnvContent, "utf-8");
    logger.info({ envPath, provider: actualProvider }, "已写入 Hermes .env (模型配置)");

    // 5. 通过 `hermes config set model <name>` 设置默认模型（非交互）
    // 注意：模型在 Hermes 中通常以 "<provider>/<model>" 或 "<model>" 形式引用
    const fallbackModel = actualProvider === "deepseek" ? "deepseek-chat" : "mimo-chat";
    const modelCandidates = [modelName, `${actualProvider}/${modelName}`, fallbackModel];
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
      // config set 失败不致命，.env 已写入，hermes 会自动检测 <PROVIDER>_API_KEY
      logger.warn("hermes config set model 失败，但 .env 已写入，将依赖自动检测");
    }

    return {
      success: true,
      configured: { provider: actualProvider, model: modelName, baseUrl },
    };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 检测 Hermes 是否已配置 LLM 模型
 * 通过 `hermes config show` 检查 Model 字段是否为空
 *
 * .env 中存在 DEEPSEEK_API_KEY 或 MIMO_API_KEY 即视为已配置 API Key。
 */
export async function isHermesModelConfigured(): Promise<{
  configured: boolean;
  model?: string;
  hasApiKey: boolean;
  provider?: string;
}> {
  // 1. 检查 .env 文件中是否有 DEEPSEEK_API_KEY 或 MIMO_API_KEY
  let hasApiKey = false;
  let provider: string | undefined;
  try {
    const fs = require("fs").promises;
    const envPath = getHermesEnvPath();
    const envContent = await fs.readFile(envPath, "utf-8");
    if (/^MIMO_API_KEY=.+/m.test(envContent)) {
      hasApiKey = true;
      provider = "mimo";
    }
    if (/^DEEPSEEK_API_KEY=.+/m.test(envContent)) {
      hasApiKey = true;
      // 优先保留已检测到的 mimo，否则记为 deepseek
      if (!provider) provider = "deepseek";
    }
  } catch {
    hasApiKey = false;
  }

  // 2. 检查 config 中的 model
  const result = await execHermes(["config", "show"], 10_000);
  if (result.success) {
    const modelMatch = result.stdout.match(/Model:\s*(.+)/i);
    const model = modelMatch?.[1]?.trim();
    const configured = !!model && !model.includes("not set") && model.length > 0;
    return { configured, model, hasApiKey, provider };
  }

  return { configured: false, hasApiKey, provider };
}

// ============ 安装管理（服务器端：仅返回状态，不执行任何本地操作）============
//
// 架构（2026-07-01 彻底修正）：
// - 服务器禁止 spawn 子进程 / pip install / CLI 执行（安全架构）
// - install / start / stop 必须在用户本地电脑执行：
//   - 桌面端：通过 Tauri command（Rust 调用本地 Python/pip/hermes）
//   - Web 端：浏览器无法 spawn 进程，需用户手动命令行启动或安装桌面端
// - 服务器仅保留 getHermesConfig（数据库状态查询）

/**
 * findHermesExe — 服务器不查找本地可执行文件
 * 返回 null，服务器不执行任何 CLI
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

let _detectCache: { result: { installed: boolean; version?: string; path?: string }; ts: number } | null = null;
const DETECT_CACHE_MS = 5 * 60 * 1000;

export async function detectHermesInstall(): Promise<{
  installed: boolean;
  version?: string;
  path?: string;
}> {
  if (_detectCache && Date.now() - _detectCache.ts < DETECT_CACHE_MS) {
    return _detectCache.result;
  }

  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    const hermesExe = await findHermesExe();
    if (hermesExe) {
      const { stdout } = await execAsync(`"${hermesExe}" --version`, { timeout: 10000 });
      const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
      const result = {
        installed: true,
        version: versionMatch?.[1]?.trim() || "unknown",
        path: hermesExe,
      };
      _detectCache = { result, ts: Date.now() };
      return result;
    }
  } catch {
    // hermes --version 失败，继续尝试 pip show
  }

  try {
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

export function clearHermesDetectCache(): void {
  _detectCache = null;
}

export async function installHermesAgent(): Promise<{
  success: boolean;
  output?: string;
  error?: string;
}> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  logger.info("HermesAgent 安装请求：pip install hermes-agent");

  const pipCmd = process.platform === "win32" ? "pip" : "pip3";

  const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
  delete cleanEnv.PIP_INDEX_URL;
  delete cleanEnv.PIP_EXTRA_INDEX_URL;

  const mirrors = [
    "https://pypi.tuna.tsinghua.edu.cn/simple",
    "https://mirrors.aliyun.com/pypi/simple/",
    "https://mirrors.cloud.tencent.com/pypi/simple",
    "https://pypi.org/simple",
  ];

  const verifyInstall = async (): Promise<boolean> => {
    const hermesExe = await findHermesExe();
    if (hermesExe) {
      try {
        await execAsync(`"${hermesExe}" --version`, { timeout: 10000, env: cleanEnv });
        return true;
      } catch {
        // 可执行文件存在但 --version 失败，继续检查 pip
      }
    }
    try {
      const verifyCmd = process.platform === "win32" ? "pip show hermes-agent" : "pip3 show hermes-agent";
      await execAsync(verifyCmd, { timeout: 15000, env: cleanEnv });
      return true;
    } catch {
      return false;
    }
  };

  let lastError = "";
  let lastOutput = "";

  for (const mirror of mirrors) {
    const installCmd = `${pipCmd} install --disable-pip-version-check -i ${mirror} hermes-agent`;
    logger.info({ mirror }, "尝试安装 HermesAgent");
    try {
      const { stdout, stderr } = await execAsync(installCmd, {
        timeout: 180000,
        maxBuffer: 10 * 1024 * 1024,
        env: cleanEnv,
      });
      const output = (stdout || "") + (stderr ? `\n${stderr}` : "");
      lastOutput = output;

      if (await verifyInstall()) {
        clearHermesDetectCache();
        logger.info({ mirror }, "HermesAgent 安装成功");
        return { success: true, output };
      }
      lastError = `镜像 ${mirror} 安装执行但验证失败`;
    } catch (e) {
      const err = e as { stderr?: string; message?: string };
      lastError = `镜像 ${mirror} 失败：${err.stderr || err.message || "未知错误"}`;
      logger.warn({ mirror, err: lastError }, "HermesAgent 安装失败，尝试下一个镜像");
    }
  }

  return {
    success: false,
    output: lastOutput,
    error: lastError || "所有镜像源安装均失败，请检查 Python 版本（需 3.11+）或网络连接",
  };
}

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

    let stderrBuf = "";
    const child = spawn(hermesExe, [
      "dashboard",
      "--port", String(port),
      "--no-open",
    ], {
      detached: true,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: false,
      cwd: process.env.HOME || process.env.USERPROFILE || undefined,
      env: buildHermesEnv(),
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderrBuf += text;
      if (stderrBuf.length > 8192) {
        stderrBuf = stderrBuf.slice(-8192);
      }
    });

    if (child.exitCode !== null) {
      return {
        success: false,
        error: `Hermes 进程立即退出（exit code ${child.exitCode}）。stderr: ${stderrBuf.slice(-500)}`,
      };
    }
    if (!child.pid) {
      return { success: false, error: "无法获取进程 PID，Hermes 可能未正确启动" };
    }

    const endpoint = `http://localhost:${port}`;
    const startedAt = Date.now();
    const timeoutMs = 30_000;
    let ready = false;
    while (Date.now() - startedAt < timeoutMs) {
      if (child.exitCode !== null) {
        return {
          success: false,
          error: `Hermes 进程在启动过程中退出（exit code ${child.exitCode}）。stderr: ${stderrBuf.slice(-500)}`,
        };
      }
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1500);
        const res = await fetch(endpoint, { signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok || res.status === 404) {
          ready = true;
          break;
        }
      } catch {
        // 还没就绪，继续等
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!ready) {
      logger.warn({ pid: child.pid, port, stderr: stderrBuf.slice(-500) }, "Hermes Dashboard 30s 内未就绪");
      child.unref();
      return {
        success: false,
        pid: child.pid,
        error: `Hermes Dashboard 在 30 秒内未就绪（端口 ${port}）。进程仍在运行（PID ${child.pid}），可能需要更长启动时间。stderr: ${stderrBuf.slice(-300)}`,
      };
    }

    logger.info({ pid: child.pid, port, readyMs: Date.now() - startedAt }, "Hermes Agent Dashboard 已就绪");
    child.unref();
    return { success: true, pid: child.pid };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function stopHermesAgent(port: number = 9119): Promise<{
  success: boolean;
  error?: string;
}> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    if (process.platform === "win32") {
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

// ============ /learn 回写：Hermes 自动学习成果同步到 Lynx ============

/**
 * 扫描用户 profile/skills/ 目录，将 Hermes /learn 自动生成的 skill 回写到 Lynx Skill 表
 *
 * Hermes 执行 `--learn` 后，会在 profile/skills/ 下生成 YAML/MD 格式的 skill 文件。
 * 本函数：
 * 1. 扫描 profile/skills/ 目录
 * 2. 解析每个 skill 文件（YAML front matter + MD 正文）
 * 3. 与 Lynx Skill 表比对（按 name + userId 去重）
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

        // 写入 Lynx Skill 表
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

// ============ Skills 双向同步：Lynx ↔ Hermes skills 目录 ============

/**
 * 导出 Lynx Skill 到 Hermes skills 目录（Lynx → Hermes）
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
 * 从 Hermes skills 目录导入 skill 到 Lynx（Hermes → Lynx）
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

/**
 * 预置默认技能到用户 Hermes profile 的 skills 目录
 *
 * 路径：~/.lynnhub/hermes-profiles/<userId>/hermes/skills/
 *
 * 这些是 YAML front matter + Markdown 文件，Hermes 可直接加载使用，
 * 让 Agent 一上线就具备 Lynx 核心操作能力（任务管理、灵感捕获、记忆搜索等）。
 *
 * 已存在的同名文件会被覆盖（保持最新）。
 */
const DEFAULT_SKILLS: Array<{
  fileName: string;
  name: string;
  description: string;
  tags: string[];
  prompt: string;
  body: string;
}> = [
  {
    fileName: "lynnhub-overview.md",
    name: "Lynx 概览",
    description: "Lynx 系统结构总览：灵感、任务、记忆、认知、技能五大模块",
    tags: ["lynnhub", "概览"],
    prompt: `你是 Lynx 系统的智能助手。Lynx 由五大模块组成：
1. 灵感（Ideas）：捕获、归类、孵化想法
2. 任务（Tasks）：创建、跟踪、完成任务
3. 记忆（Memory）：持久化存储跨会话上下文
4. 认知（Cognition）：AI 巡检、主动汇报、风格蒸馏
5. 技能（Skills）：可复用的提示词模板与自动化能力

当用户询问系统功能时，按此结构介绍；当用户需求不明确时，先判断属于哪个模块再行动。`,
    body: `# Lynx 概览

Lynx 是一个个人智能中台，融合「灵感管理 + 任务执行 + 持久化记忆 + AI 巡检」。

## 五大模块

### 1. 灵感（Ideas）
- 收件箱（Inbox）：未分类想法暂存区
- 看板（Board）：按状态流转的想法
- 墓地（Graveyard）：被淘汰或搁置的想法

### 2. 任务（Tasks）
- 待办、进行中、已完成三态流转
- 支持子任务、标签、截止时间
- 可与灵感关联

### 3. 记忆（Memory）
- 基于 Hermes profile 的 FTS5 全文索引
- 跨会话保留，自动检索相关上下文
- 每个 userId 独立隔离

### 4. 认知（Cognition）
- AI 巡检：按规则定时分析灵感/任务
- 主动汇报：定时生成每日总结
- 风格蒸馏：从聊天记录提取真人说话风格

### 5. 技能（Skills）
- 提示词模板库
- 双向同步 Lynx ↔ Hermes skills 目录
- /learn 自动生成新技能

## 典型工作流
1. 捕获灵感 → 2. 转化为任务 → 3. 执行（可能调用技能）→ 4. 结果写入记忆 → 5. 巡检复盘
`,
  },
  {
    fileName: "task-management.md",
    name: "任务管理",
    description: "创建、完成、查询任务的标准化流程",
    tags: ["lynnhub", "任务管理"],
    prompt: `当用户提到任务相关需求时，按以下流程操作：
1. 创建任务：提取任务标题、描述、优先级、截止时间
2. 查询任务：按状态（todo/doing/done）、标签、关键词检索
3. 完成任务：标记完成并记录完成备注
4. 拆分任务：复杂任务拆为子任务

任务数据通过 Lynx API（/api/tasks）管理，返回 JSON。`,
    body: `# 任务管理技能

## 创建任务
调用 \`POST /api/tasks\`，body 示例：
\`\`\`json
{ "title": "完成季度报告", "description": "...", "priority": "high", "tags": ["工作"] }
\`\`\`

## 查询任务
- \`GET /api/tasks?status=todo\` 查看待办
- \`GET /api/tasks?tag=工作\` 按标签筛选
- \`GET /api/tasks?q=报告\` 关键词搜索

## 完成任务
\`PATCH /api/tasks/<id>\` body \`{ "status": "done", "completionNote": "已完成..." }\`

## 拆分子任务
\`POST /api/tasks/<parentId>/subtasks\` 创建子任务。

## 最佳实践
- 每个任务必须有明确可验证的完成标准
- 优先级 high 的任务要在每日汇报中重点提及
- 长期任务定期更新进度备注
`,
  },
  {
    fileName: "idea-capture.md",
    name: "灵感捕获",
    description: "捕获、归类、孵化灵感的流程与方法",
    tags: ["lynnhub", "灵感"],
    prompt: `当用户表达新想法时，立即捕获到收件箱：
1. 提取核心想法（一句话描述）
2. 补充背景（为什么此刻想到）
3. 标注初步分类标签
4. 存入 Inbox 待后续孵化

灵感先入箱再分类，不要在捕获阶段过度评判。`,
    body: `# 灵感捕获技能

## 捕获到收件箱
\`POST /api/ideas\` body：
\`\`\`json
{ "content": "想法内容", "source": "chat", "tags": ["产品"] }
\`\`\`

## 流转状态
- Inbox → Board：\`PATCH /api/ideas/<id>\` body \`{ "status": "board" }\`
- Board → Graveyard：标记淘汰
- Board → Task：转化为任务执行

## 孵化建议
- 收件箱每周清理一次，避免堆积
- 看板上的想法定期评估，决定是否转任务
- 墓地不是删除，是冷存储，可随时复活

## 与任务联动
灵感转化为任务时，保留关联 \`relatedIdeaId\`，便于追溯。
`,
  },
  {
    fileName: "memory-search.md",
    name: "记忆搜索",
    description: "搜索用户持久化记忆，获取跨会话上下文",
    tags: ["lynnhub", "记忆"],
    prompt: `回答用户问题前，先搜索记忆中是否有相关上下文：
1. 提取问题关键词
2. 调用记忆搜索（FTS5 全文匹配）
3. 将命中的记忆注入 prompt 作为背景
4. 若无相关记忆，正常回答并提示"这是新话题"

记忆搜索让助手具备"记住之前对话"的能力。`,
    body: `# 记忆搜索技能

## 搜索接口
\`GET /api/hermes/memory/search?q=<关键词>&limit=5\`

返回最近命中的记忆片段，按相关度排序。

## 记忆结构
每条记忆包含：
- content：记忆内容
- createdAt：创建时间
- tags：分类标签
- sessionId：来源会话

## 使用场景
- 用户提到"之前说的..."：搜索历史记忆
- 延续上次对话：按时间倒序取最近记忆
- 决策参考：搜索相关主题的所有历史记录

## 写入记忆
重要对话结论会自动写入记忆，也可手动触发：
\`POST /api/hermes/memory\` body \`{ "content": "...", "tags": [...] }\`

## 隔离
记忆按 userId 完全隔离，不同用户互不可见。
`,
  },
  {
    fileName: "daily-report.md",
    name: "每日汇报",
    description: "生成每日总结汇报的流程与格式",
    tags: ["lynnhub", "汇报"],
    prompt: `生成每日汇报时，收集以下数据并结构化输出：
1. 今日完成任务（status=done, updatedToday）
2. 进行中任务（status=doing）
3. 新捕获灵感
4. 巡检发现的问题
5. 明日建议

输出 Markdown 格式，按"完成 / 进行中 / 灵感 / 问题 / 建议"五段式。`,
    body: `# 每日汇报技能

## 数据收集
- \`GET /api/tasks?status=done&updatedToday=true\` 今日完成
- \`GET /api/tasks?status=doing\` 进行中
- \`GET /api/ideas?createdToday=true\` 今日新灵感
- \`GET /api/patrol-logs?today=true\` 今日巡检结果

## 汇报模板
\`\`\`markdown
# 每日汇报 - {{date}}

## ✅ 今日完成
- [任务1] 完成备注
- [任务2] ...

## 🔄 进行中
- [任务3] 进度 50%，预计明天完成

## 💡 今日灵感
- 想法1（待评估）

## ⚠️ 巡检问题
- 问题1：建议处理方式

## 📋 明日建议
1. 优先处理...
2. 关注...
\`\`\`

## 触发方式
- Hermes Cron 定时（默认每天 9:00）
- 手动 \`POST /api/hermes/proactive-report\`

## 推送渠道
- 飞书通知（若开启 feishuNotify）
- 应用内通知
- 仪表盘待办
`,
  },
  {
    fileName: "patrol-check.md",
    name: "巡检检查",
    description: "运行系统巡检，发现并报告异常",
    tags: ["lynnhub", "巡检"],
    prompt: `执行巡检时：
1. 读取启用的巡检规则
2. 按规则 scope（inbox/board/graveyard/all）拉取数据
3. 用规则 prompt 分析数据，发现异常或机会
4. 命中阈值（默认 0.75）的记录写入巡检日志
5. 按配置的 notifyChannels 推送通知

巡检是 Lynx 的"主动认知"能力，让系统自驱发现问题。`,
    body: `# 巡检检查技能

## 巡检规则
\`GET /api/patrol-rules?enabled=true\` 获取启用规则。

每条规则包含：
- scope：巡检对象（inbox/board/graveyard/all）
- triggerTime：触发时间（HH:mm 或 cron）
- prompt：分析提示词
- threshold：命中阈值（0-1）

## 执行巡检
\`POST /api/hermes/patrol-takeover\` 将规则转为 Hermes Cron。
或手动 \`POST /api/patrol/run\` 立即执行。

## 巡检日志
\`GET /api/patrol-logs?today=true\` 查看今日结果。
每条日志含：ruleName、hitCount、results（命中的具体项）、durationMs。

## 通知渠道
- toast：应用内弹窗
- notification：系统通知中心
- push：移动端推送
- feishu：飞书消息（紧急）

## 典型场景
- 收件箱堆积超过 7 天未清理 → 提醒处理
- 看板想法停滞 30 天 → 建议淘汰或推进
- 墓地复活机会 → 提示重新评估
- 任务逾期 → 紧急通知
`,
  },
];

export async function preloadDefaultSkills(
  userId: string
): Promise<{ success: boolean; count: number; files: string[]; error?: string }> {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  try {
    const skillsDir = path.join(getUserHermesDir(userId), "skills");
    fs.mkdirSync(skillsDir, { recursive: true });

    const files: string[] = [];
    for (const skill of DEFAULT_SKILLS) {
      const tagsYaml = skill.tags.join(", ");
      const content = [
        "---",
        `name: ${skill.name}`,
        `description: ${skill.description}`,
        "category: lynnhub",
        `tags: [${tagsYaml}]`,
        "prompt: |",
        ...skill.prompt.split(/\r?\n/).map((line) => `  ${line}`),
        "---",
        "",
        skill.body,
        "",
      ].join("\n");

      const filePath = path.join(skillsDir, skill.fileName);
      fs.writeFileSync(filePath, content, "utf-8");
      files.push(skill.fileName);
    }

    logger.info({ userId, count: files.length, skillsDir }, "已预置默认技能到 Hermes profile");
    return { success: true, count: files.length, files };
  } catch (e) {
    return { success: false, count: 0, files: [], error: (e as Error).message };
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
 * - 从 Lynx 数据库获取看板/灵感摘要
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

  // 2. 注入 Lynx 看板摘要（让 Hermes 知道用户当前的任务状态）
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
- 你是 Lynx 的 AI 超级助理，由 Hermes Agent 驱动，拥有持久化记忆和持续学习能力
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
 * 通过飞书自定义机器人 Webhook 推送文本消息
 *
 * 从数据库 AISetting 读取 larkWebhookUrl / larkWebhookToken。
 * 若未配置 Webhook URL，跳过推送并记录日志。
 *
 * @param text   要推送的纯文本消息
 * @returns      { ok, skipped, error } skipped=true 表示因未配置而跳过
 */
async function pushToLarkWebhook(text: string): Promise<{
  ok: boolean;
  skipped: boolean;
  error?: string;
}> {
  let webhookUrl = "";
  let webhookToken = "";
  try {
    const settings = await prisma.aISetting.findFirst();
    webhookUrl = (settings?.larkWebhookUrl || "").trim();
    webhookToken = (settings?.larkWebhookToken || "").trim();
  } catch (e) {
    logger.warn({ err: e }, "飞书 Webhook 推送：读取 AISetting 失败，跳过");
    return { ok: false, skipped: true, error: (e as Error).message };
  }

  if (!webhookUrl) {
    logger.info("飞书 Webhook 推送：未配置 larkWebhookUrl，跳过推送");
    return { ok: false, skipped: true };
  }

  try {
    const payload: Record<string, unknown> = {
      msg_type: "text",
      content: { text },
    };
    if (webhookToken) {
      const timestamp = Math.floor(Date.now() / 1000);
      const stringToSign = `${timestamp}\n${webhookToken}`;
      const hmac = createHmac("sha256", stringToSign);
      hmac.update("");
      payload.timestamp = String(timestamp);
      payload.sign = hmac.digest("base64");
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "飞书 Webhook 推送：HTTP 状态码异常");
      return { ok: false, skipped: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json().catch(() => null);
    const code =
      (data as { code?: number; StatusCode?: number } | null)?.code ??
      (data as { StatusCode?: number } | null)?.StatusCode;
    if (code !== undefined && code !== 0) {
      logger.warn({ code, data }, "飞书 Webhook 推送：业务错误码");
      return { ok: false, skipped: false, error: `飞书错误码 ${code}` };
    }

    return { ok: true, skipped: false };
  } catch (e) {
    logger.warn({ err: e }, "飞书 Webhook 推送异常（非阻塞）");
    return { ok: false, skipped: false, error: (e as Error).message };
  }
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

  // 6. 通过飞书机器人 Webhook 推送（如果 feishuNotify 开启且配置了 Webhook）
  if (result.success && reportId) {
    try {
      const aiSettings = await prisma.aISetting.findFirst();
      if (aiSettings?.feishuNotify) {
        const preview = result.output.slice(0, 500).replace(/[#*`]/g, "");
        await pushToLarkWebhook(`🤖 ${title}\n\n${preview}`);
      }
    } catch (e) {
      logger.warn({ err: e }, "飞书推送失败（非阻塞）");
    }
  }

  // 7. 异步同步 learned skills
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
 * 将 Lynx 的 PatrolRule 转换为 Hermes Cron 任务
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

// ============ Hermes Cron 与 AI 助理集成（Task 3） ============

/**
 * 通过 AI 助理路径执行 Cron 任务
 *
 * 将 Cron 任务的 prompt 通过 `executeAssistantViaHermes` 走 AI 助理路径执行，
 * 利用持久化记忆 + 跨会话上下文 + 自动学习能力。
 *
 * 流程：
 * 1. 调用 executeAssistantViaHermes 执行 prompt（带记忆上下文）
 * 2. 任务完成后生成简要报告
 * 3. 若 AISetting.feishuNotify 为 true，通过飞书推送报告
 * 4. 返回 { success, output, reported }
 *
 * 该函数目前可由 `POST /api/hermes/cron/execute` 手动触发，
 * 未来接入 cron scheduler 后将由调度器自动调用。
 */
export async function executeCronJobViaAssistant(
  userId: string,
  prompt: string
): Promise<{
  success: boolean;
  output: string;
  reported: boolean;
  error?: string;
  durationMs?: number;
}> {
  const start = Date.now();

  // 1. 通过 AI 助理路径执行（复用持久化记忆 + --learn）
  const result = await executeAssistantViaHermes(userId, prompt, 180);

  if (!result.success) {
    return {
      success: false,
      output: result.output || "",
      reported: false,
      error: result.error,
      durationMs: Date.now() - start,
    };
  }

  // 2. 任务完成 → 生成简要报告
  // 截取前 800 字作为报告正文，过长内容截断避免飞书消息超长
  const truncatedOutput = result.output.length > 800
    ? result.output.slice(0, 800) + "\n...(内容已截断)"
    : result.output;

  const timestamp = new Date().toLocaleString("zh-CN", { hour12: false });
  const report = `🤖【Hermes Cron 任务执行报告】
时间：${timestamp}
任务：${prompt.slice(0, 120)}${prompt.length > 120 ? "..." : ""}

执行结果：
${truncatedOutput}`;

  // 3. 若启用 feishuNotify，通过飞书 Webhook 推送
  let reported = false;
  try {
    const settings = await prisma.aISetting.findFirst();
    if (settings?.feishuNotify) {
      const pushResult = await pushToLarkWebhook(report);
      reported = pushResult.ok;
      if (!pushResult.ok && !pushResult.skipped) {
        logger.warn(
          { error: pushResult.error },
          "Cron 任务报告飞书 Webhook 推送失败"
        );
      }
    }
  } catch (e) {
    // 飞书推送失败不影响任务成功状态
    logger.warn({ err: e }, "Cron 任务报告飞书推送异常（非阻塞）");
  }

  return {
    success: true,
    output: result.output,
    reported,
    durationMs: Date.now() - start,
  };
}

// ============ Lynx ↔ Hermes 记忆双向同步 ============

/**
 * 将 Hermes profile/memory/ 目录下的记忆文件同步到 Lynx Memory 表（Hermes → Lynx）
 *
 * 读取 ~/.lynnhub/hermes-profiles/<userId>/hermes/memory/ 下的所有文本文件，
 * 为每个文件创建一条 Memory 记录（type: "hermes"），并生成 embedding。
 * 按 content 前 200 字符去重（与所有已存在记忆比对，避免循环导入），已存在的跳过。
 *
 * @returns { success, synced, skipped }
 */
export async function syncHermesMemoryToLynx(userId: string): Promise<{
  success: boolean;
  synced: number;
  skipped: number;
  error?: string;
}> {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  try {
    const memoryDir = path.join(getUserHermesDir(userId), "memory");
    if (!fs.existsSync(memoryDir)) {
      return { success: true, synced: 0, skipped: 0 };
    }

    // 扫描 memory 目录下的所有文本文件
    const files = fs.readdirSync(memoryDir).filter((f: string) =>
      /\.(txt|md|json|yaml|yml)$/i.test(f)
    );

    if (files.length === 0) {
      return { success: true, synced: 0, skipped: 0 };
    }

    // 预取已存在的所有记忆（按 content 前 200 字符去重，覆盖所有类型避免循环导入）
    const existingMemories = await prisma.memory.findMany({
      where: { userId },
      select: { content: true },
    });
    const existingKeys = new Set<string>();
    for (const m of existingMemories) {
      existingKeys.add(m.content.slice(0, 200));
    }

    let synced = 0;
    let skipped = 0;
    const pendingCreates: Array<{
      type: string;
      content: string;
      embedding: Buffer;
      userId: string;
    }> = [];

    for (const file of files) {
      const filePath = path.join(memoryDir, file);
      try {
        const rawContent = fs.readFileSync(filePath, "utf-8");
        // 截断到 8000 字符（与 embedText 的截断一致）
        const content = rawContent.slice(0, 8000);
        if (!content.trim()) {
          skipped++;
          continue;
        }

        // 去重：按 content 前 200 字符（与所有已存在记忆比对）
        const dedupKey = content.slice(0, 200);
        if (existingKeys.has(dedupKey)) {
          skipped++;
          continue;
        }
        existingKeys.add(dedupKey);

        // 生成 embedding
        const vec = await embedText(content);
        const embeddingBuffer = float32ToBuffer(vec);

        pendingCreates.push({
          type: "hermes",
          content,
          embedding: embeddingBuffer,
          userId,
        });
        synced++;
      } catch (e) {
        logger.warn({ err: e, file }, "读取 Hermes memory 文件失败，跳过");
        skipped++;
      }
    }

    // 批量创建
    if (pendingCreates.length > 0) {
      await prisma.$transaction(
        pendingCreates.map((data) => prisma.memory.create({ data }))
      );
    }

    logger.info({ userId, synced, skipped }, "Hermes 记忆同步到 Lynx 完成");
    return { success: true, synced, skipped };
  } catch (e) {
    return { success: false, synced: 0, skipped: 0, error: (e as Error).message };
  }
}

/**
 * 将 Lynx Memory 表中的记忆导出到 Hermes profile/memory/ 目录（Lynx → Hermes）
 *
 * 读取所有 type 为 idea/conversation/cognition 的 Memory 记录，
 * 为每条记录写入一个文本文件 lynnhub-{type}-{id}.txt 到 Hermes memory 目录。
 * 这让 Hermes Agent 在执行任务时能访问 Lynx 的记忆。
 *
 * @returns { success, exported }
 */
export async function exportMemoryToHermes(userId: string): Promise<{
  success: boolean;
  exported: number;
  error?: string;
}> {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  try {
    const memories = await prisma.memory.findMany({
      where: {
        userId,
        type: { in: ["idea", "conversation", "cognition"] },
      },
      select: { id: true, type: true, content: true },
    });

    if (memories.length === 0) {
      return { success: true, exported: 0 };
    }

    const memoryDir = path.join(getUserHermesDir(userId), "memory");
    fs.mkdirSync(memoryDir, { recursive: true });

    let exported = 0;
    for (const m of memories) {
      const fileName = `lynnhub-${m.type}-${m.id}.txt`;
      const filePath = path.join(memoryDir, fileName);
      try {
        fs.writeFileSync(filePath, m.content, "utf-8");
        exported++;
      } catch (e) {
        logger.warn({ err: e, fileName }, "写入 Lynx 记忆到 Hermes 失败，跳过");
      }
    }

    logger.info({ userId, exported }, "Lynx 记忆导出到 Hermes 完成");
    return { success: true, exported };
  } catch (e) {
    return { success: false, exported: 0, error: (e as Error).message };
  }
}

// ============ 任务模式学习（Task 7：auto-work） ============

/** 中文停用词与噪声词，提取关键词时过滤 */
const STOP_WORDS = new Set([
  "的", "了", "是", "在", "我", "有", "和", "就", "不", "人", "都", "一", "一个",
  "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好",
  "这", "那", "它", "他", "她", "我们", "你们", "他们", "吧", "吗", "呢", "啊",
  "帮", "帮我", "帮忙", "请", "一下", "麻烦", "可以", "能够", "需要", "想",
  "the", "a", "an", "to", "of", "in", "on", "for", "is", "are", "be", "with",
  "and", "or", "not", "this", "that", "it", "i", "you", "we", "they",
]);

/**
 * 从任务描述中提取关键词
 * 简易分词：按空格、标点切分，过滤停用词与过短词
 */
function extractKeywords(text: string): string[] {
  if (!text || typeof text !== "string") return [];
  // 按空格、标点、中英文边界切分
  const tokens = text
    .toLowerCase()
    .split(/[\s,，。.;；:：!！?？'""()\[\]{}【】<>《》\-_=+*&^%$#@~`|\\/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  // 去重并保留顺序
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      result.push(t);
    }
  }
  return result.slice(0, 10);
}

/**
 * 生成模式 Key
 * 取前 3 个关键词用 "|" 连接，作为模式的唯一标识
 */
function buildPatternKey(keywords: string[]): string {
  return keywords.slice(0, 3).join("|") || "default";
}

/**
 * 构建 Hermes 执行 prompt
 * 基于任务描述生成可直接交给 Hermes 的 prompt
 */
function buildHermesPrompt(taskDescription: string, taskResult: string): string {
  return `## 任务模式学习

用户之前执行过该任务，请基于以下模式自动完成类似任务。

### 任务描述
${taskDescription}

### 上次执行的结果
${taskResult.slice(0, 2000)}

### 要求
1. 按照相同的模式完成本次任务
2. 如有参数变化，根据上下文调整
3. 完成后简要汇报结果`;
}

/**
 * 学习任务模式
 *
 * 当用户手动完成一个任务后调用：
 * - 提取任务关键词
 * - 检查是否已存在相同 patternKey 的模式
 * - 已存在：executionCount + 1，更新 lastExecutedAt
 * - 不存在：创建新模式
 * - 同一模式手动执行 2 次以上时，自动启用 autoExecute
 *
 * @returns { success, patternId, autoExecute }
 */
export async function learnTaskPattern(
  userId: string,
  taskDescription: string,
  taskResult: string
): Promise<{
  success: boolean;
  patternId?: string;
  autoExecute?: boolean;
  error?: string;
}> {
  try {
    if (!taskDescription || taskDescription.trim().length < 2) {
      return { success: false, error: "任务描述过短，无法学习" };
    }

    const keywords = extractKeywords(taskDescription);
    if (keywords.length === 0) {
      return { success: false, error: "未能从任务描述中提取到有效关键词" };
    }

    const patternKey = buildPatternKey(keywords);
    const hermesPrompt = buildHermesPrompt(taskDescription, taskResult);

    // 检查是否已存在相同 patternKey 的模式
    const existing = await prisma.taskPattern.findFirst({
      where: { userId, patternKey },
    });

    if (existing) {
      // 已存在：累加执行次数，合并关键词，可能启用自动执行
      const mergedKeywords = Array.from(
        new Set([
          ...(Array.isArray(existing.matchKeywords)
            ? (existing.matchKeywords as string[])
            : []),
          ...keywords,
        ])
      ).slice(0, 20);

      const newExecutionCount = existing.executionCount + 1;
      // 手动执行 2 次以上时自动启用 autoExecute
      const shouldAutoExecute = newExecutionCount >= 2;

      const updated = await prisma.taskPattern.update({
        where: { id: existing.id },
        data: {
          executionCount: newExecutionCount,
          lastExecutedAt: new Date(),
          matchKeywords: mergedKeywords as never,
          // 仅当尚未启用时才自动启用（已启用保持不变）
          autoExecute: existing.autoExecute || shouldAutoExecute,
          // 更新 hermesPrompt（保留最新的执行结果作为参考）
          hermesPrompt,
          // 更新 taskTemplate（保留最新描述）
          taskTemplate: taskDescription.slice(0, 1000),
        },
      });

      logger.info(
        { userId, patternId: updated.id, patternKey, executionCount: newExecutionCount, autoExecute: updated.autoExecute },
        "任务模式学习：已存在模式，累加执行次数"
      );

      return {
        success: true,
        patternId: updated.id,
        autoExecute: updated.autoExecute,
      };
    }

    // 新模式：创建
    const created = await prisma.taskPattern.create({
      data: {
        userId,
        patternKey,
        taskTemplate: taskDescription.slice(0, 1000),
        steps: [] as never,
        hermesPrompt,
        matchKeywords: keywords as never,
        executionCount: 1,
        autoExecutedCount: 0,
        autoExecute: false,
        lastExecutedAt: new Date(),
      },
    });

    logger.info(
      { userId, patternId: created.id, patternKey, keywords },
      "任务模式学习：创建新模式"
    );

    return {
      success: true,
      patternId: created.id,
      autoExecute: false,
    };
  } catch (e) {
    logger.error({ err: e, userId }, "学习任务模式失败");
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 查找匹配的任务模式
 *
 * 在所有 autoExecute = true 的模式中，按关键词匹配度评分，
 * 返回得分超过阈值的最佳匹配。
 *
 * @returns { pattern, score } score 为 0 时表示未匹配
 */
export async function findMatchingPattern(
  userId: string,
  taskDescription: string
): Promise<{
  pattern: Awaited<ReturnType<typeof prisma.taskPattern.findFirst>> | null;
  score: number;
}> {
  try {
    if (!taskDescription || taskDescription.trim().length < 2) {
      return { pattern: null, score: 0 };
    }

    const taskKeywords = extractKeywords(taskDescription);
    if (taskKeywords.length === 0) {
      return { pattern: null, score: 0 };
    }

    // 查询所有已启用自动执行的模式
    const patterns = await prisma.taskPattern.findMany({
      where: { userId, autoExecute: true },
    });

    if (patterns.length === 0) {
      return { pattern: null, score: 0 };
    }

    let bestPattern: Awaited<ReturnType<typeof prisma.taskPattern.findFirst>> | null = null;
    let bestScore = 0;
    const MATCH_THRESHOLD = 1; // 至少匹配 1 个关键词

    for (const p of patterns) {
      const patternKeywords = Array.isArray(p.matchKeywords)
        ? (p.matchKeywords as string[])
        : [];
      if (patternKeywords.length === 0) continue;

      // 统计关键词命中数
      let hitCount = 0;
      for (const kw of taskKeywords) {
        if (patternKeywords.includes(kw)) hitCount++;
      }

      // 归一化分数：命中关键词数 / 较小的一方（任务关键词数 vs 模式关键词数）
      const minLen = Math.min(taskKeywords.length, patternKeywords.length);
      const score = minLen > 0 ? hitCount / minLen : 0;

      if (score > bestScore) {
        bestScore = score;
        bestPattern = p;
      }
    }

    if (bestPattern && bestScore >= MATCH_THRESHOLD) {
      logger.info(
        { userId, patternId: bestPattern.id, patternKey: bestPattern.patternKey, score: bestScore },
        "找到匹配的任务模式"
      );
      return { pattern: bestPattern, score: bestScore };
    }

    return { pattern: null, score: bestScore };
  } catch (e) {
    logger.error({ err: e, userId }, "查找匹配任务模式失败");
    return { pattern: null, score: 0 };
  }
}

/**
 * 自动执行任务模式
 *
 * 通过 executeAssistantViaHermes 执行模式的 hermesPrompt，
 * 更新执行统计与结果。
 *
 * @returns { success, output, error }
 */
export async function executePatternAutomatically(
  userId: string,
  pattern: NonNullable<Awaited<ReturnType<typeof prisma.taskPattern.findFirst>>>
): Promise<{
  success: boolean;
  output: string;
  error?: string;
  durationMs?: number;
}> {
  const start = Date.now();

  try {
    // 通过 Hermes 执行模式的 prompt
    const result = await executeAssistantViaHermes(
      userId,
      pattern.hermesPrompt,
      120
    );

    // 更新模式执行统计
    try {
      await prisma.taskPattern.update({
        where: { id: pattern.id },
        data: {
          executionCount: { increment: 1 },
          autoExecutedCount: { increment: 1 },
          lastExecutedAt: new Date(),
          lastAutoResult: result.success ? "success" : "failed",
        },
      });
    } catch (e) {
      logger.warn({ err: e, patternId: pattern.id }, "更新任务模式执行统计失败（非阻塞）");
    }

    return {
      success: result.success,
      output: result.output,
      error: result.error,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    // 即使异常也尝试记录失败结果
    try {
      await prisma.taskPattern.update({
        where: { id: pattern.id },
        data: {
          autoExecutedCount: { increment: 1 },
          lastExecutedAt: new Date(),
          lastAutoResult: "failed",
        },
      });
    } catch {
      // 忽略
    }

    return {
      success: false,
      output: "",
      error: (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

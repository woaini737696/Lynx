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
      endpoint: data.endpoint ?? "http://localhost:7432",
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

// ============ Hermes Agent 操作 ============

/**
 * 测试与 Hermes Agent 的连接
 * 返回 { connected, version, capabilities }
 */
export async function testHermesConnection(
  config: HermesConfig
): Promise<{ connected: boolean; version?: string; capabilities?: string[]; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await hermesFetch(config, "/api/status", {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { connected: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return {
      connected: true,
      version: data.version || data.data?.version,
      capabilities: data.capabilities || data.data?.capabilities || [],
    };
  } catch (e) {
    return {
      connected: false,
      error: (e as Error).name === "AbortError" ? "连接超时（5秒）" : (e as Error).message,
    };
  }
}

/**
 * 执行 Hermes 任务
 */
export async function executeHermesTask(
  config: HermesConfig,
  request: HermesTaskRequest
): Promise<HermesTaskResult> {
  const start = Date.now();
  try {
    const timeoutMs = (request.timeout ?? 120) * 1000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await hermesFetch(config, "/api/task", {
      method: "POST",
      body: JSON.stringify({
        prompt: request.prompt,
        mode: request.mode || "auto",
        work_dir: request.workDir,
        options: request.options,
      }),
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
      screenshots: data.screenshots,
      durationMs: data.durationMs || Date.now() - start,
    };
  } catch (e) {
    return {
      success: false,
      output: "",
      error: (e as Error).name === "AbortError"
        ? `任务执行超时（${request.timeout ?? 120}秒）`
        : (e as Error).message,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 获取 Hermes Skills Hub 技能列表
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

    if (!res.ok) {
      return { skills: [], error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const skills = (data.skills || data.data || []) as HermesSkill[];
    return { skills };
  } catch (e) {
    return {
      skills: [],
      error: (e as Error).name === "AbortError" ? "请求超时" : (e as Error).message,
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

// ============ 安装管理 ============

/**
 * 检测系统是否已安装 hermes-agent（检查 pip 包）
 * 通过 `pip show hermes-agent` 命令
 */
export async function detectHermesInstall(): Promise<{
  installed: boolean;
  version?: string;
  path?: string;
}> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    // Windows 优先用 pip，回退 pip3
    const cmd = process.platform === "win32" ? "pip show hermes-agent" : "pip3 show hermes-agent";
    const { stdout } = await execAsync(cmd, { timeout: 15000 });
    const versionMatch = stdout.match(/Version:\s*(.+)/);
    const locationMatch = stdout.match(/Location:\s*(.+)/);
    return {
      installed: true,
      version: versionMatch?.[1]?.trim(),
      path: locationMatch?.[1]?.trim(),
    };
  } catch {
    return { installed: false };
  }
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
 * 启动 Hermes Agent 服务（后台进程）
 * 使用 hermes serve --port 7432
 */
export async function startHermesAgent(port: number = 7432): Promise<{
  success: boolean;
  pid?: number;
  error?: string;
}> {
  const { spawn } = await import("child_process");

  try {
    const cmd = process.platform === "win32" ? "hermes" : "hermes3";
    const child = spawn(cmd, ["serve", "--port", String(port)], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();

    if (child.pid) {
      logger.info({ pid: child.pid, port }, "Hermes Agent 已启动");
      return { success: true, pid: child.pid };
    }
    return { success: false, error: "无法获取进程 PID" };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

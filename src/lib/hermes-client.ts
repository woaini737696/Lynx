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
 * 执行 Hermes 任务
 * 优先通过 HTTP API（如果 dashboard 在运行），回退到命令行 `hermes -z "prompt"`
 */
export async function executeHermesTask(
  config: HermesConfig,
  request: HermesTaskRequest
): Promise<HermesTaskResult> {
  const start = Date.now();
  const timeoutMs = (request.timeout ?? 120) * 1000;

  // 1. 先尝试 HTTP API（如果 dashboard 服务在运行）
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(timeoutMs, 30000));
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

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        output: data.output || data.result || "",
        steps: data.steps,
        screenshots: data.screenshots,
        durationMs: data.durationMs || Date.now() - start,
      };
    }
    // HTTP 失败则回退到命令行
  } catch {
    // HTTP 不可用，回退到命令行
  }

  // 2. 回退：通过命令行 `hermes -z "prompt" --cli` 执行
  const args = ["-z", request.prompt, "--cli", "--yolo"];
  if (request.workDir) {
    // hermes 不直接支持 workDir 参数，通过 cwd 选项设置
  }

  const result = await execHermes(args, timeoutMs);
  if (result.success) {
    return {
      success: true,
      output: result.stdout.trim() || "(任务已完成，无输出)",
      durationMs: Date.now() - start,
    };
  }

  return {
    success: false,
    output: "",
    error: result.error || result.stderr || "任务执行失败",
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

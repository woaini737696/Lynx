// 健康监控模块
// 提供：
// 1. 内存中的 404 访问日志（最近 N 条，循环覆盖）
// 2. 应用启动时间记录（用于计算 uptime）
// 3. 健康检查辅助函数（数据库 ping、内存占用、版本信息）

import { prisma } from "@/lib/db";

// ===== 启动时间 =====
const STARTED_AT = Date.now();

// ===== 404 日志环形缓冲区 =====
const MAX_404_LOGS = 200;

export interface NotFoundLogEntry {
  id: string;
  path: string;
  method: string;
  referer: string | null;
  userAgent: string | null;
  ip: string | null;
  timestamp: number; // ms since epoch
}

const notFoundLogs: NotFoundLogEntry[] = [];
let notFoundCounter = 0;

/**
 * 记录一次 404 访问
 */
export function logNotFound(params: {
  path: string;
  method?: string;
  referer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): void {
  notFoundCounter++;
  const entry: NotFoundLogEntry = {
    id: `nf-${notFoundCounter}`,
    path: params.path,
    method: params.method || "GET",
    referer: params.referer || null,
    userAgent: params.userAgent || null,
    ip: params.ip || null,
    timestamp: Date.now(),
  };
  notFoundLogs.push(entry);
  // 保持长度不超过上限
  if (notFoundLogs.length > MAX_404_LOGS) {
    notFoundLogs.splice(0, notFoundLogs.length - MAX_404_LOGS);
  }
}

/**
 * 获取最近的 404 日志（默认最近 50 条，按时间倒序）
 */
export function getRecentNotFoundLogs(limit = 50): NotFoundLogEntry[] {
  return [...notFoundLogs].reverse().slice(0, Math.max(1, Math.min(limit, MAX_404_LOGS)));
}

/**
 * 获取 404 统计：总命中数 + 按 path 聚合的 Top N
 */
export function getNotFoundStats(topN = 10): {
  total: number;
  uniquePaths: number;
  topPaths: Array<{ path: string; count: number; lastSeen: number }>;
} {
  const byPath = new Map<string, { count: number; lastSeen: number }>();
  for (const log of notFoundLogs) {
    const existing = byPath.get(log.path);
    if (existing) {
      existing.count++;
      if (log.timestamp > existing.lastSeen) existing.lastSeen = log.timestamp;
    } else {
      byPath.set(log.path, { count: 1, lastSeen: log.timestamp });
    }
  }
  const topPaths = [...byPath.entries()]
    .map(([path, v]) => ({ path, count: v.count, lastSeen: v.lastSeen }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
  return {
    total: notFoundLogs.length,
    uniquePaths: byPath.size,
    topPaths,
  };
}

/**
 * 清空 404 日志
 */
export function clearNotFoundLogs(): number {
  const cleared = notFoundLogs.length;
  notFoundLogs.length = 0;
  return cleared;
}

// ===== 健康检查 =====

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  uptime: number; // seconds
  uptimeHuman: string;
  timestamp: string;
  nodeVersion: string;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
    heapUsedMB: number;
    heapTotalMB: number;
  };
  db: "connected" | "disconnected";
  notFound: {
    total: number;
    uniquePaths: number;
  };
  version: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

/**
 * 执行健康检查
 * - 检查数据库连接
 * - 收集内存占用
 * - 计算 uptime
 * - 汇总 404 统计
 */
export async function checkHealth(): Promise<HealthStatus> {
  let dbStatus: "connected" | "disconnected" = "disconnected";
  try {
    // 简单的 ping 查询
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  const mem = process.memoryUsage();
  const uptimeSeconds = (Date.now() - STARTED_AT) / 1000;
  const nfStats = getNotFoundStats(0);

  const status: HealthStatus["status"] =
    dbStatus === "connected" ? "ok" : "degraded";

  return {
    status,
    uptime: Math.floor(uptimeSeconds),
    uptimeHuman: formatUptime(Math.floor(uptimeSeconds)),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    memory: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
    },
    db: dbStatus,
    notFound: {
      total: nfStats.total,
      uniquePaths: nfStats.uniquePaths,
    },
    version: process.env.npm_package_version || "0.0.0",
  };
}

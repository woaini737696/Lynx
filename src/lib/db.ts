import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 连接池配置（从环境变量读取，便于不同部署环境调优）：
// - DATABASE_CONNECTION_LIMIT：连接池上限，默认 20
// - DATABASE_POOL_TIMEOUT：连接获取超时（秒），默认 10
function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL || "";
  if (!base) return base;
  // 避免重复追加参数
  if (base.includes("connection_limit=")) return base;
  const sep = base.includes("?") ? "&" : "?";
  const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT || "20";
  const poolTimeout = process.env.DATABASE_POOL_TIMEOUT || "10";
  return `${base}${sep}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
    datasources: {
      db: { url: buildDatabaseUrl() },
    },
  });

// 生产环境也缓存到 global，避免 HMR/模块边界创建多实例
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

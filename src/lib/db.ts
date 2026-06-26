import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 连接池配置：
// - connection_limit=20：开发/中等并发场景足够（默认 num_cpus*2+1）
// - pool_timeout=10：避免连接耗尽时长时间挂起
function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL || "";
  if (!base) return base;
  // 避免重复追加参数
  if (base.includes("connection_limit=")) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}connection_limit=20&pool_timeout=10`;
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

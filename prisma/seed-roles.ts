import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLES, PERMISSION_CATALOG } from "../src/lib/permissions";

const prisma = new PrismaClient();

/**
 * Seed 脚本：初始化 3 个默认角色（admin / editor / viewer）及其权限配置。
 * 使用 upsert，可重复运行不会产生重复数据。
 *
 * 权限目录和默认角色定义统一从 src/lib/permissions.ts 导入，避免重复定义。
 * 当前权限目录共 PERMISSION_CATALOG.length 项，按模块分组。
 */

async function main() {
  console.log("🌱 初始化默认角色...");

  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        profession: role.profession || null,
      },
      create: {
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
        profession: role.profession || null,
      },
    });
    console.log(`  ✓ 角色就绪: ${role.name} (${role.displayName}) — ${role.permissions.length} 项权限`);
  }

  console.log(`✅ 角色初始化完成（权限目录共 ${PERMISSION_CATALOG.length} 项）`);
}

main()
  .catch((e) => {
    console.error("❌ 角色初始化失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

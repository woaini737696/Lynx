import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed 脚本：初始化 3 个默认角色（admin / editor / viewer）及其权限配置。
 * 使用 upsert，可重复运行不会产生重复数据。
 *
 * 权限目录（10 项）：
 *   idea:create / idea:delete / task:manage / memory:write / cognition:manage
 *   skill:execute / flow:execute / user:manage / role:manage / system:config
 *
 * 默认权限：
 *   admin  —— 全部权限
 *   editor —— 除 user:manage / role:manage / system:config 外全部
 *   viewer —— idea:create + skill:execute
 */

const ALL_PERMISSIONS = [
  "idea:create",
  "idea:delete",
  "task:manage",
  "memory:write",
  "cognition:manage",
  "skill:execute",
  "flow:execute",
  "user:manage",
  "role:manage",
  "system:config",
];

const EDITOR_PERMISSIONS = ALL_PERMISSIONS.filter(
  (k) => k !== "user:manage" && k !== "role:manage" && k !== "system:config"
);

const DEFAULT_ROLES = [
  {
    name: "admin",
    displayName: "管理员",
    description: "拥有系统全部权限，可管理用户、角色与系统配置",
    permissions: ALL_PERMISSIONS,
    isSystem: true,
  },
  {
    name: "editor",
    displayName: "编辑者",
    description: "可创建内容、管理任务与知识资产，但不能管理用户/角色/系统配置",
    permissions: EDITOR_PERMISSIONS,
    isSystem: true,
  },
  {
    name: "viewer",
    displayName: "访客",
    description: "只读访问 + 有限操作（创建灵感、执行技能）",
    permissions: ["idea:create", "skill:execute"],
    isSystem: true,
  },
];

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
      },
      create: {
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
      },
    });
    console.log(`  ✓ 角色就绪: ${role.name} (${role.displayName}) — ${role.permissions.length} 项权限`);
  }

  console.log("✅ 角色初始化完成");
}

main()
  .catch((e) => {
    console.error("❌ 角色初始化失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

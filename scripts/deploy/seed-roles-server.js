/**
 * 服务器端角色权限同步脚本（纯 JS 版本，无需 tsx）
 * 在服务器上用 node 运行：node seed-roles-server.js
 *
 * 同步 admin/editor/viewer 三个系统角色的 permissions 字段
 * 与 src/lib/permissions.ts 中的 DEFAULT_ROLES 保持一致
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ============ 权限目录（75 项，与 permissions.ts 同步） ============
const PERMISSION_CATALOG = [
  // 灵感
  "idea:create", "idea:delete", "idea:edit", "idea:export", "idea:revive",
  // 任务
  "task:manage", "task:create", "task:complete", "task:delete",
  // 记忆
  "memory:write", "memory:update", "memory:read", "memory:delete", "memory:rebuild",
  // 认知
  "cognition:read", "cognition:manage", "cognition:extract", "cognition:delete",
  // 技能
  "skill:execute", "skill:generate", "skill:import", "skill:export", "skill:manage",
  // 工作流
  "flow:execute", "flow:manage", "flow:read",
  // AI
  "ai:chat", "ai:voice", "ai:settings", "ai:tool:use", "ai:distill:read", "ai:distill:manage", "ai:workspace:read", "ai:workspace:manage",
  // 对话
  "conversation:read", "conversation:capture", "conversation:delete",
  // 巡检
  "patrol:execute", "patrol:manage", "patrol:read",
  // 备份
  "backup:export", "backup:import", "backup:verify",
  // Hermes
  "hermes:execute", "hermes:install", "hermes:skill:manage", "hermes:memory:manage", "hermes:cron:manage", "hermes:remote-command", "hermes:config", "hermes:report:read", "hermes:pattern:manage",
  // 飞书
  "lark:task:manage", "lark:bot:test",
  // 会员/钱包
  "membership:read", "membership:manage", "wallet:read", "wallet:manage",
  // 推送
  "push:subscribe", "push:test",
  // 搜索
  "search:use",
  // PC会话
  "pc-session:manage",
  // Agent审计
  "agent-audit:read",
  // 上传
  "upload:use",
  // 其他
  "dev-log:read", "graveyard:manage", "focus:manage",
  // 用户自助
  "user:profile:edit", "user:ai-keys:manage",
  // 系统
  "user:manage", "role:manage", "system:config", "token:stats", "system:diagnostics", "profession:manage",
];

const ALL_PERMISSION_KEYS = PERMISSION_CATALOG;

// admin 仅限权限
const ADMIN_ONLY = new Set([
  "user:manage", "role:manage", "system:config", "token:stats", "system:diagnostics", "profession:manage",
  "backup:import", "ai:settings", "ai:workspace:manage", "membership:manage", "wallet:manage",
  "hermes:install", "hermes:remote-command", "hermes:pattern:manage", "lark:bot:test",
  "flow:manage", "ai:distill:manage", "graveyard:manage",
]);

// viewer 权限（C 端用户默认）
const VIEWER_PERMISSIONS = [
  "idea:create", "idea:edit",
  "task:create", "task:complete",
  "memory:read", "cognition:read", "cognition:extract",
  "skill:execute",
  "flow:execute", "flow:read",
  "ai:chat", "ai:voice", "ai:tool:use", "ai:distill:read", "ai:workspace:read",
  "conversation:read", "conversation:capture",
  "patrol:read", "patrol:execute",
  "backup:export", "backup:verify",
  "hermes:execute", "hermes:report:read", "hermes:memory:manage",
  "lark:task:manage",
  "membership:read", "wallet:read",
  "push:subscribe",
  "search:use", "upload:use",
  "focus:manage",
  "user:profile:edit", "user:ai-keys:manage",
];

// editor 权限（除 ADMIN_ONLY 外全部）
const EDITOR_PERMISSIONS = ALL_PERMISSION_KEYS.filter((k) => !ADMIN_ONLY.has(k));

const DEFAULT_ROLES = [
  {
    name: "admin",
    displayName: "管理员",
    description: "拥有系统全部权限，可管理用户、角色与系统配置",
    permissions: ALL_PERMISSION_KEYS,
    isSystem: true,
    profession: "founder",
  },
  {
    name: "editor",
    displayName: "编辑者",
    description: "可创建内容、管理任务与知识资产，但不能管理用户/角色/系统配置",
    permissions: EDITOR_PERMISSIONS,
    isSystem: true,
    profession: "pm",
  },
  {
    name: "viewer",
    displayName: "访客",
    description: "C 端用户默认角色：可对话/搜索/上传/管理自己资料，仅有限创作",
    permissions: VIEWER_PERMISSIONS,
    isSystem: true,
    profession: null,
  },
];

async function main() {
  console.log("🌱 初始化默认角色（服务器端同步）...");
  console.log(`权限目录共 ${PERMISSION_CATALOG.length} 项`);

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

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seed 脚本：仅创建/修复 admin 用户，不注入任何假数据。
 * 所有业务数据（Idea/Task/Memory/Conversation/Cognition/Skill 等）
 * 必须由用户真实操作产生，确保数据干净、可追溯。
 *
 * 安全守卫：仅在 NODE_ENV=development 下运行，防止生产环境误执行。
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("⚠️ 生产环境禁止运行 seed，已跳过");
    return;
  }

  console.log("🌱 初始化 admin 用户（不注入假数据）...");

  const adminPasswordHash = await bcrypt.hash("admin123", 10);

  // upsert：存在则更新密码，不存在则创建
  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash: adminPasswordHash },
    create: {
      username: "admin",
      passwordHash: adminPasswordHash,
      email: "admin@lynnhub.local",
      displayName: "管理员",
      role: "admin",
    },
  });

  console.log(`  ✓ admin 用户就绪 (admin/admin123)，id=${adminUser.id}`);
  console.log("✅ Seed 完成（仅 admin 用户，无假数据）");
}

main()
  .catch((e) => {
    console.error("❌ Seed 失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

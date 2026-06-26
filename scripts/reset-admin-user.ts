import "dotenv/config";
import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, active: true, displayName: true },
  });
  console.log("当前用户列表：", JSON.stringify(users, null, 2));
  console.log("用户总数：", users.length);

  // 删除旧 admin（如果存在）
  const deleted = await prisma.user.deleteMany({ where: { username: "admin" } });
  console.log(`删除旧 admin 用户：${deleted.count} 条`);

  // 创建 lynn 超级管理员
  const passwordHash = await bcrypt.hash("ee9527ff", 10);
  const lynn = await prisma.user.upsert({
    where: { username: "lynn" },
    update: {
      passwordHash,
      role: "admin",
      active: true,
      displayName: "Lynn",
    },
    create: {
      username: "lynn",
      passwordHash,
      role: "admin",
      active: true,
      displayName: "Lynn",
    },
  });
  console.log("超级管理员已创建/更新：", { id: lynn.id, username: lynn.username, role: lynn.role });

  // 确认最终用户列表
  const finalUsers = await prisma.user.findMany({
    select: { username: true, role: true, active: true },
  });
  console.log("最终用户列表：", JSON.stringify(finalUsers, null, 2));
}

main()
  .catch((e) => {
    console.error("错误：", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

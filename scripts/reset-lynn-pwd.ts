/**
 * 重置 lynn 用户密码为 lynn123（仅开发测试用）
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";

async function main() {
  const hash = await bcrypt.hash("lynn123", 10);
  const u = await prisma.user.update({
    where: { username: "lynn" },
    data: { passwordHash: hash },
    select: { id: true, username: true, role: true },
  });
  console.log("✅ 密码已重置:", JSON.stringify(u));
  await prisma.$disconnect();
}
main().catch(console.error);

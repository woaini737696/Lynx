// 检查 admin 用户状态
import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const admin = await prisma.user.findUnique({
    where: { username: "lynn" },
    select: { id: true, username: true, role: true, active: true, passwordHash: true, displayName: true },
  });
  console.log("lynn 用户:", { ...admin, passwordHash: admin?.passwordHash ? "[REDACTED len=" + admin.passwordHash.length + "]" : null });

  if (admin?.passwordHash) {
    for (const pwd of ["admin123", "lynn123", "123456", "Lynn@123", "lynn"]) {
      const match = await bcrypt.compare(pwd, admin.passwordHash);
      console.log(`密码 ${pwd} 匹配:`, match);
    }
  }

  // 列出所有用户
  const allUsers = await prisma.user.findMany({ select: { id: true, username: true, role: true, active: true } });
  console.log("所有用户:", allUsers);
}

main().catch(console.error).finally(() => prisma.$disconnect());

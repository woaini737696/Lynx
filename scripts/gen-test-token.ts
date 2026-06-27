// 签发测试用 JWT token（用于端到端验证，不修改密码）
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { signToken } from "../src/lib/jwt";

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: "lynn" },
    select: { id: true, username: true, role: true },
  });
  if (!user) {
    console.error("用户 lynn 不存在");
    process.exit(1);
  }
  const token = await signToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  console.log(token);
}

main().catch(console.error).finally(() => prisma.$disconnect());

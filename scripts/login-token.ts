/**
 * 通过 /api/auth/token 登录获取 JWT token（用 dev server 端的 SECRET 签发）
 */
import "dotenv/config";

const BASE = "http://localhost:5176";

async function main() {
  // 先列出所有用户
  const { prisma } = await import("./../src/lib/db");
  const users = await prisma.user.findMany({ select: { id: true, username: true, role: true, active: true } });
  console.log("users:", JSON.stringify(users, null, 2));

  // 用 admin/admin123 登录
  const resp = await fetch(`${BASE}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  const text = await resp.text();
  console.log("status:", resp.status);
  console.log("body:", text);
  await prisma.$disconnect();
}
main().catch(console.error);

/**
 * 清理自测产生的脏数据
 * - 认知：content 包含 "[自测]"
 * - 对话：title="自测对话" 或 rawContent 包含 "[自测]"
 * - 看板：content 包含 "[自测]" 的任务（含软删除 dropped）
 * - 灵感：content 包含 "[自测]"
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  console.log("=== 清理自测脏数据 ===");

  const cog = await prisma.cognition.deleteMany({ where: { content: { contains: "[自测]" } } });
  console.log(`认知: 删除 ${cog.count} 条`);

  const conv = await prisma.conversation.deleteMany({
    where: { OR: [{ title: "自测对话" }, { rawContent: { contains: "[自测]" } }] },
  });
  console.log(`对话: 删除 ${conv.count} 条`);

  const task = await prisma.task.deleteMany({ where: { content: { contains: "[自测]" } } });
  console.log(`任务: 删除 ${task.count} 条（含软删除）`);

  const idea = await prisma.idea.deleteMany({ where: { content: { contains: "[自测]" } } });
  console.log(`灵感: 删除 ${idea.count} 条`);

  console.log("✅ 清理完成");
}

main().catch(console.error).finally(() => prisma.$disconnect());

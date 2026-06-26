/**
 * E2E 测试脏数据清理脚本
 * 删除 content 以 `E2E` / `E2E测试` / `测试灵感` 开头的测试数据，
 * 同时清理关联的 Memory 记录（通过 ideaId/conversationId/cognitionId 关联）。
 *
 * 清理范围：
 *   - Idea 表（content 字段）
 *   - Task 表（content 字段）
 *   - Memory 表（content 字段）
 *   - Cognition 表（content 字段）
 *   - 关联 Memory：引用了上述 E2E Idea/Cognition/Conversation 的 Memory 节点
 *
 * 运行方式：npx tsx scripts/cleanup-e2e-data.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// E2E 测试数据内容前缀（匹配 content.startsWith(prefix)）
const E2E_PREFIXES = ["E2E", "E2E测试", "测试灵感"];

(async () => {
  console.log("🧹 开始清理 E2E 测试脏数据...");
  console.log(`   前缀匹配：${E2E_PREFIXES.join(" / ")}\n`);

  const stats: Record<string, number> = {
    memoryRelated: 0,
    memory: 0,
    cognition: 0,
    task: 0,
    idea: 0,
  };

  // ============ 1. 收集 E2E Idea / Cognition / Conversation 的 ID ============
  // 用于清理引用它们的 Memory 节点（ideaId/conversationId/cognitionId）
  const e2eIdeas = await prisma.idea.findMany({
    where: { OR: E2E_PREFIXES.map((p) => ({ content: { startsWith: p } })) },
    select: { id: true },
  });
  const e2eCognitions = await prisma.cognition.findMany({
    where: { OR: E2E_PREFIXES.map((p) => ({ content: { startsWith: p } })) },
    select: { id: true },
  });
  // Conversation 表无 content 字段，按 title 前缀匹配（E2E 测试创建的对话标题通常带前缀）
  const e2eConversations = await prisma.conversation.findMany({
    where: { OR: E2E_PREFIXES.map((p) => ({ title: { startsWith: p } })) },
    select: { id: true },
  });

  const e2eIdeaIds = e2eIdeas.map((i) => i.id);
  const e2eCognitionIds = e2eCognitions.map((c) => c.id);
  const e2eConversationIds = e2eConversations.map((c) => c.id);

  // ============ 2. Memory — 先删（引用 Idea/Conversation/Cognition） ============
  // 2a. 删除引用了 E2E 源实体的 Memory 节点
  if (e2eIdeaIds.length > 0 || e2eCognitionIds.length > 0 || e2eConversationIds.length > 0) {
    const relMem = await prisma.memory.deleteMany({
      where: {
        OR: [
          { ideaId: { in: e2eIdeaIds } },
          { cognitionId: { in: e2eCognitionIds } },
          { conversationId: { in: e2eConversationIds } },
        ],
      },
    });
    stats.memoryRelated = relMem.count;
    console.log(`✓ Memory（关联 E2E 源实体）删除 ${relMem.count} 条`);
  }

  // 2b. 删除自身 content 以 E2E 前缀开头的 Memory 节点
  const memDel = await prisma.memory.deleteMany({
    where: { OR: E2E_PREFIXES.map((p) => ({ content: { startsWith: p } })) },
  });
  stats.memory = memDel.count;
  console.log(`✓ Memory（content 前缀匹配）删除 ${memDel.count} 条`);

  // ============ 3. Cognition — 删（被 Memory 引用已释放） ============
  const cogDel = await prisma.cognition.deleteMany({
    where: { OR: E2E_PREFIXES.map((p) => ({ content: { startsWith: p } })) },
  });
  stats.cognition = cogDel.count;
  console.log(`✓ Cognition 删除 ${cogDel.count} 条`);

  // ============ 4. Task — 删（可能引用 Idea.sourceId） ============
  const taskDel = await prisma.task.deleteMany({
    where: { OR: E2E_PREFIXES.map((p) => ({ content: { startsWith: p } })) },
  });
  stats.task = taskDel.count;
  console.log(`✓ Task 删除 ${taskDel.count} 条`);

  // ============ 5. Idea — 最后删（被 Task/Graveyard/Cognition/Memory 引用） ============
  // 注意：Graveyard 通过 originalIdeaId 引用 Idea，需先清理对应 Graveyard 记录
  if (e2eIdeaIds.length > 0) {
    const graveDel = await prisma.graveyard.deleteMany({
      where: { originalIdeaId: { in: e2eIdeaIds } },
    });
    if (graveDel.count > 0) {
      console.log(`✓ Graveyard（关联 E2E Idea）删除 ${graveDel.count} 条`);
    }
  }
  const ideaDel = await prisma.idea.deleteMany({
    where: { OR: E2E_PREFIXES.map((p) => ({ content: { startsWith: p } })) },
  });
  stats.idea = ideaDel.count;
  console.log(`✓ Idea 删除 ${ideaDel.count} 条`);

  // ============ 6. Conversation — 删（被 Memory/Cognition 引用已释放） ============
  if (e2eConversationIds.length > 0) {
    const convDel = await prisma.conversation.deleteMany({
      where: { id: { in: e2eConversationIds } },
    });
    if (convDel.count > 0) {
      console.log(`✓ Conversation（标题前缀匹配）删除 ${convDel.count} 条`);
    }
  }

  // ============ 输出清理统计 ============
  const total = Object.values(stats).reduce((s, n) => s + n, 0);
  console.log("\n--- 清理统计 ---");
  console.log(`  Memory（关联清理）：${stats.memoryRelated}`);
  console.log(`  Memory（前缀匹配）：${stats.memory}`);
  console.log(`  Cognition：${stats.cognition}`);
  console.log(`  Task：${stats.task}`);
  console.log(`  Idea：${stats.idea}`);
  console.log(`  合计：${total} 条`);

  console.log("\n✅ E2E 脏数据清理完成");
  await prisma.$disconnect();
})().catch((e) => {
  console.error("❌ 清理失败:", e);
  process.exit(1);
});

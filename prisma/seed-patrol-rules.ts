/**
 * Seed 默认巡检规则
 * 为新用户/空数据库注入 2 条开箱即用的巡检规则：
 * 1. 灵感去重检查：检查 inbox 中的重复/相似灵感
 * 2. Graveyard 复活检查：检查 graveyard 中是否有值得复活的灵感
 *
 * 运行：npx tsx prisma/seed-patrol-rules.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

const DEFAULT_RULES = [
  {
    name: "灵感去重检查",
    description: "检查收件箱中是否存在内容重复或高度相似的灵感，建议合并",
    scope: "inbox",
    triggerTime: "10:00",
    prompt: `你是一个灵感管理助手。请检查以下灵感列表，找出内容重复或高度相似的灵感对。

分析要点：
1. 语义重复：表达相同核心意思的不同表述
2. 主题重叠：针对同一主题/问题的多个灵感
3. 可合并：能够整合为一条更完整灵感的多个灵感

对每对重复/相似灵感，请输出：
- matched: true/false（是否发现重复）
- reason: 重复原因说明
- suggestion: 合并/处理建议

请以 JSON 数组格式输出结果，每项对应一个被检查的灵感。`,
    threshold: 0.75,
    notifyChannels: ["toast", "notification"],
    enabled: true,
  },
  {
    name: "Graveyard 复活检查",
    description: "定期检查已归档的灵感，识别是否有值得重新激活的内容",
    scope: "graveyard",
    triggerTime: "manual",
    prompt: `你是一个灵感管理助手。请检查以下已归档（graveyard）的灵感，评估是否有值得"复活"的内容。

评估标准：
1. 时效性：当前是否有新的条件/资源使该灵感重新可行
2. 价值：该灵感如果实现，仍有较高价值
3. 关联性：与当前活跃灵感/任务有关联

对每个被检查的灵感，请输出：
- matched: true/false（是否建议复活）
- reason: 评估理由
- suggestion: 复活建议（直接复活/修改后复活/保持归档）

请以 JSON 数组格式输出结果。`,
    threshold: 0.7,
    notifyChannels: ["toast", "notification"],
    enabled: true,
  },
];

async function main() {
  console.log("🌱 注入默认巡检规则...");

  // 查找 admin 用户（将规则挂到 admin 名下作为系统默认规则）
  const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  if (!admin) {
    console.log("⚠️ 未找到 admin 用户，跳过");
    return;
  }

  let created = 0;
  let skipped = 0;
  for (const rule of DEFAULT_RULES) {
    // 检查是否已存在同名规则（避免重复注入）
    const existing = await prisma.patrolRule.findFirst({
      where: { name: rule.name, userId: admin.id },
      select: { id: true },
    });
    if (existing) {
      console.log(`  ⏭️  跳过（已存在）: ${rule.name}`);
      skipped++;
      continue;
    }

    await prisma.patrolRule.create({
      data: {
        ...rule,
        notifyChannels: rule.notifyChannels,
        userId: admin.id,
      },
    });
    console.log(`  ✓ 已注入: ${rule.name}`);
    created++;
  }

  console.log(`\n✅ 完成：注入 ${created} 条，跳过 ${skipped} 条`);
}

main()
  .catch((e) => {
    console.error("❌ Seed 巡检规则失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

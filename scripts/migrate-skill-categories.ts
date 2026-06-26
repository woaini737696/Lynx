import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// 旧分类 → 新分类映射
const MIGRATION_MAP: Record<string, string> = {
  general: "custom",      // 通用 → 自定义
  finance: "finance",     // 财务保持
  report: "pm",           // 报告 → 产品经理
  review: "pm",           // 审查 → 产品经理
  knowledge: "creator",   // 知识 → 内容创作者
  meeting: "project",     // 会议 → 项目经理
  product: "pm",          // 产品 → 产品经理
  // hermes/custom 保持不变
};

async function main() {
  for (const [oldCat, newCat] of Object.entries(MIGRATION_MAP)) {
    const result = await prisma.skill.updateMany({
      where: { category: oldCat },
      data: { category: newCat },
    });
    console.log(`${oldCat} → ${newCat}: 更新 ${result.count} 条`);
  }
  // 统计迁移后各分类数量
  const stats = await prisma.skill.groupBy({ by: ["category"], _count: true });
  console.log("\n迁移后分类统计:");
  stats.forEach(s => console.log(`  ${s.category}: ${s._count}`));
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });

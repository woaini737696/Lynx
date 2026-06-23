import { prisma } from "@/lib/db";

// 最大保留版本数
export const MAX_VERSIONS = 20;

/**
 * 清理超出上限的旧版本，保留最新 MAX_VERSIONS 个。
 * 在 PATCH（自动快照）和 POST（回滚备份）后调用。
 */
export async function pruneOldVersions(skillId: string): Promise<void> {
  const count = await prisma.skillVersion.count({
    where: { skillId },
  });

  if (count <= MAX_VERSIONS) return;

  const toDelete = count - MAX_VERSIONS;
  const oldVersions = await prisma.skillVersion.findMany({
    where: { skillId },
    orderBy: { version: "asc" },
    take: toDelete,
    select: { id: true },
  });

  if (oldVersions.length > 0) {
    await prisma.skillVersion.deleteMany({
      where: { id: { in: oldVersions.map((v) => v.id) } },
    });
  }
}

/**
 * 为 Skill 创建版本快照（在更新前调用）。
 * 返回创建的版本号。
 */
export async function createSkillVersionSnapshot(skillId: string): Promise<number> {
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
  if (!skill) return 0;

  const latestVersion = await prisma.skillVersion.findFirst({
    where: { skillId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latestVersion?.version || 0) + 1;

  const { Prisma } = await import("@prisma/client");
  await prisma.skillVersion.create({
    data: {
      skillId,
      version: nextVersion,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      content: skill.content,
      parameters: skill.parameters as unknown as import("@prisma/client").Prisma.InputJsonValue,
      promptTemplate: skill.promptTemplate,
      tags: skill.tags as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  await pruneOldVersions(skillId);
  return nextVersion;
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import {
  getHermesConfig,
  listHermesSkills,
  listLearnedSkills,
} from "@/lib/hermes-client";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/skills?category=xxx - 获取 Hermes Skills Hub 技能列表
// 优先从 Hermes Agent 获取；若未运行或返回空，回退到数据库与文件系统
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;

    const config = await getHermesConfig(auth.user.id);
    const hermesRunning =
      !!config && config.enabled && config.status === "running";

    // 1. 优先尝试 Hermes Agent（已启用且运行中）
    if (hermesRunning && config) {
      try {
        const result = await listHermesSkills(config, category);
        if (result.skills.length > 0) {
          return NextResponse.json({
            skills: result.skills,
            source: "hermes",
            hermesRunning: true,
          });
        }
      } catch (e) {
        logger.warn(
          { err: e },
          "Hermes Agent 运行中但获取技能失败，回退到数据库"
        );
      }
    }

    // 2. 数据库回退：查询 hermes-learned / hermes-imported 来源的技能
    const dbSkills = await prisma.skill.findMany({
      where: {
        source: { in: ["hermes-learned", "hermes-imported"] },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    if (dbSkills.length > 0) {
      // 转换为与 Hermes skill 一致的返回格式
      const skills = dbSkills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description || "",
        category: s.category || "hermes",
        tags: Array.isArray(s.tags) ? (s.tags as string[]) : [],
        usageCount: s.usageCount,
        parameters: Array.isArray(s.parameters)
          ? (
              s.parameters as Array<{
                key?: string;
                label?: string;
                name?: string;
                type?: string;
                required?: boolean;
                placeholder?: string;
                description?: string;
                defaultValue?: string;
                default?: string;
              }>
            ).map((p) => ({
              name: p.label || p.name || p.key || "",
              type: p.type || "text",
              description: p.placeholder || p.description || "",
              required: p.required || false,
              default:
                typeof (p.defaultValue ?? p.default) === "string"
                  ? (p.defaultValue ?? p.default) ?? ""
                  : "",
            }))
          : [],
      }));
      return NextResponse.json({
        skills,
        source: "database",
        hermesRunning,
      });
    }

    // 3. 文件系统回退：从 Hermes profile skills 目录读取已学习的技能文件
    try {
      const learned = await listLearnedSkills(auth.user.id);
      if (learned.success && learned.skills.length > 0) {
        const skills = learned.skills.map((s) => ({
          id: s.fileName,
          name: s.name,
          description: `文件: ${s.fileName}`,
          category: "hermes-learned",
          tags: [],
          parameters: [],
          usageCount: 0,
        }));
        return NextResponse.json({
          skills,
          source: "filesystem",
          hermesRunning,
        });
      }
    } catch (e) {
      logger.warn({ err: e }, "读取文件系统已学习技能失败");
    }

    // 4. 全部为空，返回空数组（始终 HTTP 200）
    return NextResponse.json({
      skills: [],
      source: hermesRunning ? "hermes" : "database",
      hermesRunning,
    });
  } catch (e) {
    logger.error({ err: e }, "获取 Hermes 技能列表失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

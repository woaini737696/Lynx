import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, buildUserFilter } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("backup-verify-api");

// 使用 request.url 读取查询参数，必须动态渲染
export const dynamic = "force-dynamic";

// GET /api/backup/verify
// 返回当前数据库各核心数据类型的记录数，用于导出前/导入后校验
// 普通用户只能看到自己的数据计数，admin 可看到全部
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.user === null) return auth.error;

    const userFilter = buildUserFilter(auth.user);

    // 并行查询各类型计数
    const [
      ideasCount,
      tasksCount,
      conversationsCount,
      cognitionsCount,
      memoriesCount,
      skillsCount,
      flowsCount,
    ] = await Promise.all([
      prisma.idea.count({ where: userFilter }),
      prisma.task.count({ where: userFilter }),
      prisma.conversation.count({ where: userFilter }),
      prisma.cognition.count({ where: userFilter }),
      prisma.memory.count({ where: userFilter }),
      prisma.skill.count({ where: userFilter }),
      prisma.flow.count({ where: userFilter }),
    ]);

    const counts = {
      ideas: ideasCount,
      tasks: tasksCount,
      conversations: conversationsCount,
      cognitions: cognitionsCount,
      memories: memoriesCount,
      skills: skillsCount,
      flows: flowsCount,
    };

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return NextResponse.json({
      success: true,
      counts,
      total,
      verifiedAt: new Date().toISOString(),
      scope: auth.user.role === "admin" ? "all" : "own",
    });
  } catch (e) {
    logger.error({ err: e }, "数据备份校验失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, requirePermission } from "@/lib/auth-utils";
import { chat } from "@/lib/ai-provider";
import { COGNITION_EXTRACT_PROMPT } from "@/lib/ai";
import { getLogger } from "@/lib/logger";

const logger = getLogger("tasks-api");

// 更新任务状态/位置
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission("task:manage");
    if (error) return error;

    const { id } = params;

    // 验证任务归属权
    const existing = await prisma.task.findUnique({
      where: { id },
      include: { idea: { select: { content: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const { status, column, position } = await req.json();

    // 跨列移动 - 检查目标列满额
    if (column) {
      const col = column as "northstar" | "campaign" | "task";
      const limits = { northstar: 3, campaign: 5, task: 10 };
      const current = await prisma.task.findUnique({ where: { id } });
      if (current && current.column !== col) {
        const count = await prisma.task.count({
          where: { column: col, status: "active" },
        });
        if (count >= limits[col]) {
          return NextResponse.json(
            { error: `${col} 列已满，无法移入` },
            { status: 409 }
          );
        }
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(column && { column }),
        ...(position !== undefined && { position }),
      },
    });

    // 当状态变为 done 时，异步触发 AI 认知提取（不阻塞 PATCH 响应）
    // 提取完成后直接写入 Cognition 表，前端通过认知列表刷新查看
    if (status === "done" && existing.status !== "done") {
      // 异步执行，不 await，失败仅记日志
      extractCognitionsForTask(id, existing.content, existing.idea?.content || "", user.id).catch((e) => {
        logger.error({ err: e, taskId: id }, "异步认知提取失败");
      });
      logger.info({ taskId: id }, "任务已完成，认知提取已异步触发");
    }

    return NextResponse.json({
      task,
      success: true,
      cognitionExtracted: false,
      extractedCognitions: [],
      cognitionPending: status === "done" && existing.status !== "done",
    });
  } catch (e) {
    console.error("更新任务失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/**
 * 异步认知提取：从任务内容中提取认知并直接写入 Cognition 表
 * 失败不阻断任务完成操作，仅记录错误日志
 */
async function extractCognitionsForTask(
  taskId: string,
  taskContent: string,
  ideaContent: string,
  userId: string
): Promise<void> {
  const { writeMemoryForCognition } = await import("@/lib/memory-sync");
  const combinedContent = ideaContent
    ? `${taskContent}\n\n[关联灵感]\n${ideaContent}`
    : taskContent;

  const aiResp = await chat(
    [{ role: "user", content: combinedContent }],
    {
      system: COGNITION_EXTRACT_PROMPT,
      reasoningMode: "fast",
      temperature: 0.3,
    }
  );

  // 解析 AI 返回的 JSON
  const jsonMatch = aiResp.content.match(/\{[\s\S]*\}/);
  const parsed = jsonMatch
    ? JSON.parse(jsonMatch[0])
    : { method: [], experience: [], prompt: [] };

  const items: Array<{ type: "method" | "experience" | "prompt"; content: string }> = [];
  for (const item of parsed.method || []) {
    if (item?.content) items.push({ type: "method", content: item.content });
  }
  for (const item of parsed.experience || []) {
    if (item?.content) items.push({ type: "experience", content: item.content });
  }
  for (const item of parsed.prompt || []) {
    if (item?.content) items.push({ type: "prompt", content: item.content });
  }

  // 批量写入 Cognition 表
  for (const item of items) {
    const c = await prisma.cognition.create({
      data: {
        type: item.type,
        content: item.content,
        source: "auto-extract",
        tags: [],
        userId,
      },
    });
    // 异步写入 Memory
    writeMemoryForCognition(c.id, c.content).catch(() => {});
  }

  logger.info({ taskId, count: items.length }, "异步认知提取完成，已写入 Cognition 表");
}

// 删除任务
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission("task:delete");
    if (error) return error;

    const { id } = params;

    // 验证任务归属权
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "未找到" }, { status: 404 });
    }
    if (user.role !== "admin" && existing.userId !== user.id) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    await prisma.task.update({
      where: { id },
      data: { status: "dropped" },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("删除任务失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

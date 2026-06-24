import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
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
    const { user, error } = await requireAuth();
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

    // 当状态变为 done 时，触发 AI 认知提取（失败不阻断完成操作）
    // 注意：此处只提取认知数据返回给前端，由用户确认后再写入 Cognition 表
    let cognitionExtracted = false;
    let extractedCognitions: Array<{
      type: "method" | "experience" | "prompt";
      content: string;
    }> = [];
    if (status === "done" && existing.status !== "done") {
      try {
        // 拼接任务内容 + 关联 Idea 内容（如果有）作为补充
        const ideaContent = existing.idea?.content || "";
        const combinedContent = ideaContent
          ? `${existing.content}\n\n[关联灵感]\n${ideaContent}`
          : existing.content;

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

        // 收集提取的认知数据（不立即写入 Cognition 表，等用户确认）
        for (const item of parsed.method || []) {
          if (item?.content) {
            extractedCognitions.push({ type: "method", content: item.content });
          }
        }
        for (const item of parsed.experience || []) {
          if (item?.content) {
            extractedCognitions.push({ type: "experience", content: item.content });
          }
        }
        for (const item of parsed.prompt || []) {
          if (item?.content) {
            extractedCognitions.push({ type: "prompt", content: item.content });
          }
        }

        cognitionExtracted = extractedCognitions.length > 0;
        logger.info(
          { taskId: id, count: extractedCognitions.length },
          "AI 认知提取成功（待用户确认入库）"
        );
      } catch (e) {
        // AI 调用失败不阻断完成操作，只记录错误
        console.error("AI 认知提取失败:", e);
        logger.error({ err: e, taskId: id }, "AI 认知提取失败");
      }
    }

    return NextResponse.json({
      task,
      success: true,
      cognitionExtracted,
      extractedCognitions,
    });
  } catch (e) {
    console.error("更新任务失败:", e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 删除任务
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireAuth();
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

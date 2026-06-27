// 异步认知提取：从任务内容中提取认知并直接写入 Cognition 表
// 提取到独立模块，供 tasks/[id] PATCH 和 focus PATCH 共用，避免代码重复
// 失败不阻断任务完成操作，仅记录错误日志
import { prisma } from "./db";
import { chat } from "./ai-provider";
import { COGNITION_EXTRACT_PROMPT } from "./ai";
import { getLogger } from "./logger";

const logger = getLogger("cognition-extract");

/**
 * 异步认知提取：从任务内容中提取认知并直接写入 Cognition 表
 * 失败不阻断任务完成操作，仅记录错误日志
 */
export async function extractCognitionsForTask(
  taskId: string,
  taskContent: string,
  ideaContent: string,
  userId: string
): Promise<void> {
  const { writeMemoryForCognition } = await import("./memory-sync");
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
    writeMemoryForCognition(c.id, c.content).catch((e) => {
      logger.error({ err: e, cognitionId: c.id }, "writeMemory 异步失败");
    });
  }

  logger.info({ taskId, count: items.length }, "异步认知提取完成，已写入 Cognition 表");
}

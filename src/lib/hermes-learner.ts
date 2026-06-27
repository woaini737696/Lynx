import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-learner");

// 从 HermesReport 表读取 bad 标注，生成学习内容
// 将 bad case 注入 Hermes profile 的 JSONL 历史，供下次对话参考
export async function processFeedbackReports(): Promise<number> {
  try {
    // 读取最近 24 小时内的 feedback-correction 类型报告
    const reports = await prisma.hermesReport.findMany({
      where: {
        type: "custom",
        title: { contains: "消息标注纠正" },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      take: 50,
    });

    if (reports.length === 0) return 0;

    // 读取现有 Hermes profile 的内容
    // Hermes profile 存储在 .lynnhub/hermes-profiles/ 目录
    const fs = await import("fs/promises");
    const path = await import("path");
    const profileDir = path.join(process.cwd(), ".lynnhub", "hermes-profiles");

    // 确保目录存在
    await fs.mkdir(profileDir, { recursive: true }).catch(() => {});

    // 将 bad case 追加到 learning-log.jsonl
    const logFile = path.join(profileDir, "feedback-learning.jsonl");
    const lines = reports.map(r => JSON.stringify({
      timestamp: new Date().toISOString(),
      reportId: r.id,
      content: r.content,
      learned: true,
    })).join("\n") + "\n";

    await fs.appendFile(logFile, lines, "utf-8");

    // 标记这些报告已处理（更新 content 添加 processed 标记）
    for (const r of reports) {
      try {
        const content = JSON.parse(r.content);
        await prisma.hermesReport.update({
          where: { id: r.id },
          data: { content: JSON.stringify({ ...content, processed: true, processedAt: new Date().toISOString() }) },
        });
      } catch {}
    }

    logger.info({ count: reports.length }, "Hermes 反馈学习处理完成");
    return reports.length;
  } catch (e) {
    logger.error({ err: e }, "Hermes 反馈学习处理失败");
    return 0;
  }
}

// 获取已学习的 bad case，注入到 AI 助理的 system prompt
export async function getFeedbackContext(): Promise<string> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const logFile = path.join(process.cwd(), ".lynnhub", "hermes-profiles", "feedback-learning.jsonl");

    const content = await fs.readFile(logFile, "utf-8").catch(() => "");
    if (!content.trim()) return "";

    const lines = content.trim().split("\n").slice(-5); // 最近 5 条
    const cases = lines.map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);

    if (cases.length === 0) return "";

    const context = cases.map(c => {
      try {
        const data = JSON.parse(c.content);
        return `- 用户不满意回复："${data.badReply?.slice(0, 100) || ""}"，原因：${data.reason || "未提供"}`;
      } catch { return ""; }
    }).filter(Boolean).join("\n");

    return context ? `\n\n## 用户历史反馈（避免类似错误）\n${context}` : "";
  } catch {
    return "";
  }
}

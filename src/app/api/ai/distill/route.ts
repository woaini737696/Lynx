import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { chat, type LLMProvider } from "@/lib/ai-provider";
import { prisma } from "@/lib/db";
import { DISTILL_TEMPLATES } from "@/lib/distill-templates";
import {
  fillPromptTemplate,
  type SkillParameter,
} from "@/lib/skill-parser";
import { requireAuth } from "@/lib/auth-utils";

// 性能优化：内存 flag 缓存，避免每请求都查 DB
let skillsSeededFlag = false;

// 从 distill-templates.ts 同步默认 Skill（检查每个模板是否存在，不存在则创建）
async function ensureSkillsSeeded() {
  if (skillsSeededFlag) return; // 已 seed 过则跳过
  for (const tpl of DISTILL_TEMPLATES) {
    // 按名称检查是否已存在
    const existing = await prisma.skill.findFirst({
      where: { name: tpl.name },
      select: { id: true },
    });
    if (existing) continue;

    const content = `# ${tpl.name}\n\n${tpl.description}\n\n## 步骤\n${tpl.steps
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n")}\n\n## 提示词模板\n\n${tpl.promptTemplate}`;
    await prisma.skill.create({
      data: {
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        content,
        parameters: tpl.parameters as unknown as Prisma.InputJsonValue,
        promptTemplate: tpl.promptTemplate,
        source: "manual",
        tags: [],
      },
    });
  }
  skillsSeededFlag = true; // 标记已 seed 完成
}

// AI 蒸馏执行 API
// POST /api/ai/distill { templateId, parameters, provider? }
// templateId 可以是 Skill.id，也可以是旧版 distill-template id（向后兼容）
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  try {
    const { templateId, parameters, provider } = await req.json();

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId 不能为空" },
        { status: 400 }
      );
    }

    // 校验 provider 参数
    let resolvedProvider: LLMProvider | undefined;
    if (provider !== undefined && provider !== null) {
      if (provider !== "deepseek" && provider !== "mimo") {
        return NextResponse.json(
          { error: `不支持的 provider：${provider}` },
          { status: 400 }
        );
      }
      resolvedProvider = provider;
    }

    // 确保 Skill 表有默认数据
    await ensureSkillsSeeded();

    // 先按 Skill.id 查找
    let skill = await prisma.skill.findUnique({
      where: { id: templateId },
    });

    // 向后兼容：旧版 distill-template id → 按 name 查找
    if (!skill) {
      const legacy = DISTILL_TEMPLATES.find((t) => t.id === templateId);
      if (legacy) {
        skill = await prisma.skill.findFirst({
          where: { name: legacy.name },
        });
      }
    }

    if (!skill) {
      return NextResponse.json(
        { error: `未找到模板：${templateId}` },
        { status: 404 }
      );
    }

    const skillParams = (skill.parameters as unknown as SkillParameter[]) || [];

    // 校验必填参数
    const params = parameters || {};
    for (const param of skillParams) {
      if (param.required && !params[param.key]) {
        return NextResponse.json(
          { error: `参数 ${param.label} 为必填项` },
          { status: 400 }
        );
      }
    }

    // 填充提示词
    const prompt = fillPromptTemplate(skill.promptTemplate, params);

    // 从 content 中提取步骤（## 步骤 段落）
    const stepsMatch = skill.content.match(
      /##\s*步骤\s*\n([\s\S]*?)(?=\n##\s|$)/
    );
    const steps = stepsMatch
      ? stepsMatch[1]
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => /^\d+\./.test(l))
          .map((l) => l.replace(/^\d+\.\s*/, ""))
      : [];

    // 调用 AI，失败时返回提示信息而非报错
    let resultText: string;
    let isFallback = false;
    try {
      const result = await chat(
        [{ role: "user", content: prompt }],
        { provider: resolvedProvider }
      );
      resultText = result.content;
    } catch (e) {
      console.error("AI 蒸馏执行失败，降级返回提示词:", e);
      resultText =
        "⚠️ AI 调用失败，无法生成结果。\n\n以下为已组装的提示词，可复制到其他 AI 工具中执行：\n\n---\n\n" +
        prompt;
      isFallback = true;
    }

    // 增加 usageCount
    await prisma.skill.update({
      where: { id: skill.id },
      data: { usageCount: { increment: 1 } },
    });

    return NextResponse.json({
      result: resultText,
      steps,
      prompt,
      // 降级时返回 fallback: true（新字段）和 mock: true（向后兼容老前端）
      ...(isFallback ? { fallback: true, mock: true } : {}),
    });
  } catch (e) {
    console.error("AI 蒸馏执行失败:", e);
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

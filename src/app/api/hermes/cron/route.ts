import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { listHermesCronJobs, createHermesCronJob } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

/**
 * 校验 cron 表达式是否为标准 5 字段格式
 *
 * 标准 cron 5 字段：minute hour day-of-month month day-of-week
 * - minute: 0-59
 * - hour: 0-23
 * - day-of-month: 1-31
 * - month: 1-12 或 jan-dec
 * - day-of-week: 0-7（0 和 7 均为周日）或 sun-sat
 *
 * 支持的扩展语法：
 * - `*` 通配符
 * - `,` 列表（如 "1,2,3"）
 * - `-` 范围（如 "1-5"）
 * - `/` 步长（如 "*\/5" 或 "0-30/15"）
 *
 * @returns 校验通过返回 null，失败返回错误消息
 */
function validateCronExpression(expr: string): string | null {
  const trimmed = expr.trim();
  if (!trimmed) return "schedule 不能为空";

  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    return `cron 表达式必须是 5 字段格式（minute hour day month weekday），当前为 ${fields.length} 字段。示例："0 9 * * *" 表示每天 9:00`;
  }

  const ranges = [
    { name: "minute", min: 0, max: 59 },
    { name: "hour", min: 0, max: 23 },
    { name: "day-of-month", min: 1, max: 31 },
    { name: "month", min: 1, max: 12 },
    { name: "day-of-week", min: 0, max: 7 },
  ];

  const monthAliases = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const dowAliases = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  for (let i = 0; i < 5; i++) {
    const field = fields[i];
    const range = ranges[i];

    // 将字段按逗号拆分，逐项校验
    const items = field.split(",");
    for (const item of items) {
      // 处理步长：item 可能是 "*/N"、"range/N" 或 "value"
      const [basePart, stepPart] = item.split("/");
      if (stepPart !== undefined) {
        const step = Number(stepPart);
        if (!Number.isInteger(step) || step <= 0) {
          return `字段 ${range.name} 步长 "${stepPart}" 无效：必须为正整数`;
        }
      }

      // 校验 base 部分
      if (basePart === "*") continue;

      // 处理范围（如 "1-5" 或 "mon-fri"）
      const rangeMatch = basePart.match(/^(\w+)-(\w+)$/);
      if (rangeMatch) {
        const [, start, end] = rangeMatch;
        const startNum = Number(start);
        const endNum = Number(end);

        if (!isNaN(startNum) && !isNaN(endNum)) {
          if (startNum < range.min || startNum > range.max) {
            return `字段 ${range.name} 范围起始值 ${startNum} 超出允许范围 ${range.min}-${range.max}`;
          }
          if (endNum < range.min || endNum > range.max) {
            return `字段 ${range.name} 范围结束值 ${endNum} 超出允许范围 ${range.min}-${range.max}`;
          }
          continue;
        }

        // 别名范围（如 "mon-fri"）
        if (i === 3 && monthAliases.includes(start.toLowerCase()) && monthAliases.includes(end.toLowerCase())) continue;
        if (i === 4 && dowAliases.includes(start.toLowerCase()) && dowAliases.includes(end.toLowerCase())) continue;

        return `字段 ${range.name} 范围 "${basePart}" 无效`;
      }

      // 处理单值
      const num = Number(basePart);
      if (!isNaN(num)) {
        // day-of-week 允许 7 表示周日
        const effectiveMax = i === 4 ? 7 : range.max;
        if (num < range.min || num > effectiveMax) {
          return `字段 ${range.name} 值 ${num} 超出允许范围 ${range.min}-${effectiveMax}`;
        }
        continue;
      }

      // 别名单值
      if (i === 3 && monthAliases.includes(basePart.toLowerCase())) continue;
      if (i === 4 && dowAliases.includes(basePart.toLowerCase())) continue;

      return `字段 ${range.name} 值 "${basePart}" 无效`;
    }
  }

  return null;
}

// GET /api/hermes/cron - 列出用户的 Hermes cron jobs
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const result = await listHermesCronJobs(auth.user.id);
    return NextResponse.json(result);
  } catch (e) {
    logger.error({ err: e }, "列出 Hermes cron jobs 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/hermes/cron - 创建 Hermes cron job
// body: { schedule: string, prompt: string }
// schedule 为标准 5 字段 cron 表达式（如 "0 9 * * *"）
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { schedule, prompt } = body as { schedule?: string; prompt?: string };

    if (!schedule || !schedule.trim()) {
      return NextResponse.json(
        { error: "schedule 不能为空" },
        { status: 400 }
      );
    }

    // 校验 cron 表达式格式（标准 5 字段）
    const validationError = validateCronExpression(schedule);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "prompt 不能为空" },
        { status: 400 }
      );
    }

    const trimmedSchedule = schedule.trim();
    const trimmedPrompt = prompt.trim();

    const result = await createHermesCronJob(
      auth.user.id,
      trimmedSchedule,
      trimmedPrompt
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "创建 cron 任务失败",
        },
        { status: 500 }
      );
    }

    // 改进响应：返回创建的 job 详情，便于前端立即展示
    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      job: {
        id: result.jobId,
        schedule: trimmedSchedule,
        prompt: trimmedPrompt,
        enabled: true,
      },
      message: "Cron 任务已创建",
    });
  } catch (e) {
    logger.error({ err: e }, "创建 Hermes cron job 失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

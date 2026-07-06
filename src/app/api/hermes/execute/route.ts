import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getHermesConfig } from "@/lib/hermes-client";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// POST /api/hermes/execute - 通过 Hermes Agent 执行任务
//
// 架构说明（2026-07-01 修正，修复服务器执行 RPA 的安全漏洞）：
// - HermesAgent 只能安装在用户本地电脑（通过桌面端客户端）
// - 服务器禁止安装 hermes（多用户共用服务器，RPA 会操控服务器，是安全漏洞）
// - 该接口必须通过 WS 网关远程下发到用户桌面端执行
// - 桌面端 ws_client.rs 收到后调用本地 hermes dashboard HTTP API 真实执行 RPA
// - 服务器不执行任何 RPA 动作
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { prompt, mode, timeout, workDir, options } = body as {
      prompt?: string;
      mode?: "computer_use" | "shell" | "auto";
      timeout?: number;
      workDir?: string;
      options?: Record<string, unknown>;
    };

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "prompt 不能为空" },
        { status: 400 }
      );
    }

    const config = await getHermesConfig(auth.user.id);
    if (!config || !config.enabled) {
      return NextResponse.json(
        { error: "Hermes Agent 未启用，请先在设置中启用" },
        { status: 400 }
      );
    }

    const timeoutSec = timeout || 120;
    const startMs = Date.now();

    // 唯一路径：通过 WS 网关远程下发到用户桌面端执行
    // 服务器不安装 hermes，不执行任何 RPA 动作（安全架构）
    const { randomUUID } = await import("crypto");
    const commandId = randomUUID();
    const command = JSON.stringify({
      type: "hermes-execute",
      prompt: prompt.trim(),
      mode: mode || "auto",
      workDir,
      options,
    });

    // 写入 RemoteCommand 记录
    const record = await prisma.remoteCommand.create({
      data: {
        commandId,
        userId: auth.user.id,
        command,
        source: "hermes-api",
        status: "pending",
        route: "pending",
      },
    });

    // 通过 WS 网关下发到桌面端
    const WS_GATEWAY_URL = process.env.WS_GATEWAY_URL || "http://localhost:3001";
    let dispatched = false;
    let dispatchReason = "";
    try {
      const resp = await fetch(`${WS_GATEWAY_URL}/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": process.env.INTERNAL_API_KEY || "",
        },
        body: JSON.stringify({ userId: auth.user.id, command, commandId }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await resp.json().catch(() => ({}));
      dispatched = !!data.dispatched;
      dispatchReason = data.reason || "";
    } catch (e) {
      dispatchReason = "WS 网关不可达：" + (e as Error).message;
    }

    if (!dispatched) {
      await prisma.remoteCommand.update({
        where: { id: record.id },
        data: { status: "failed", error: dispatchReason || "无在线 PC" },
      });
      return NextResponse.json({
        success: false,
        output: "",
        error:
          "未检测到在线的桌面端。请在您的电脑上启动奇思桌面端客户端并登录，确保 HermesAgent 已启动。\n\n" +
          "AI 助理通过桌面端执行本地操作（如打开浏览器、操作文件等），服务器不执行 RPA 动作（安全架构）。\n" +
          "下载桌面端：https://gitee.com/shenzhens-emotions-are-booming_0/lynn-hub-release/releases",
        durationMs: Date.now() - startMs,
      });
    }

    // 轮询等待桌面端回传结果
    const deadline = Date.now() + timeoutSec * 1000;
    const pollInterval = 1500;
    let remoteResult: {
      success: boolean;
      output: string;
      error?: string;
      durationMs?: number;
      route?: string;
    } | null = null;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const cmd = await prisma.remoteCommand.findUnique({ where: { commandId } });
      if (!cmd) break;
      if (cmd.status === "completed") {
        const resultData = (cmd.result as Record<string, unknown> | null) || {};
        const output = typeof resultData.output === "string"
          ? resultData.output
          : (typeof cmd.result === "string" ? cmd.result : JSON.stringify(resultData));
        remoteResult = {
          success: true,
          output,
          durationMs: cmd.durationMs || Date.now() - startMs,
          route: cmd.route || undefined,
        };
        break;
      }
      if (cmd.status === "failed" || cmd.status === "timeout") {
        remoteResult = {
          success: false,
          output: "",
          error: cmd.error || "远程执行失败",
          durationMs: cmd.durationMs || Date.now() - startMs,
          route: cmd.route || undefined,
        };
        break;
      }
    }

    if (!remoteResult) {
      // 超时
      try {
        await prisma.remoteCommand.update({
          where: { id: record.id },
          data: { status: "timeout", error: `执行超时（${timeoutSec}秒）`, completedAt: new Date() },
        });
      } catch {}
      remoteResult = {
        success: false,
        output: "",
        error: `远程执行超时（${timeoutSec}秒），指令已下发但未收到结果。请确认桌面端在线且 HermesAgent 已启动。`,
        durationMs: Date.now() - startMs,
      };
    }

    // 记录执行历史到 SkillExecution 表
    try {
      await prisma.skillExecution.create({
        data: {
          userId: auth.user.id,
          skillId: "hermes-task",
          skillName: `Hermes 任务：${prompt.slice(0, 50)}`,
          source: "hermes",
          trigger: "api",
          parameters: { prompt, mode, workDir } as unknown as never,
          result: remoteResult.output,
          success: remoteResult.success,
          durationMs: remoteResult.durationMs || 0,
          error: remoteResult.error || null,
        },
      });
    } catch {
      // 记录失败不影响主流程
    }

    return NextResponse.json(remoteResult);
  } catch (e) {
    logger.error({ err: e }, "执行 Hermes 任务失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getHermesConfig, testHermesConnection } from "@/lib/hermes-client";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// POST /api/hermes/test - 测试与 Hermes Agent 的连接
// body: { endpoint?: string, apiKey?: string }（可选，覆盖数据库配置）
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const { endpoint, apiKey } = body as { endpoint?: string; apiKey?: string };

    // 获取配置，允许 body 参数覆盖
    let config = await getHermesConfig(auth.user.id);
    if (!config && !endpoint) {
      return NextResponse.json(
        { error: "未配置 Hermes Agent，请先安装" },
        { status: 400 }
      );
    }

    const testConfig = {
      id: config?.id || "",
      userId: auth.user.id,
      enabled: true,
      endpoint: endpoint || config?.endpoint || "http://localhost:9119",
      apiKey: apiKey !== undefined ? apiKey : config?.apiKey || null,
      autoStart: config?.autoStart ?? false,
      capabilities: config?.capabilities || [],
      installedAt: config?.installedAt || null,
      status: config?.status || "not_installed",
      lastCheckedAt: new Date(),
      lastError: null,
    };

    const result = await testHermesConnection(testConfig);

    // 测试连接只更新检查时间和错误信息，不修改 status
    // status 应该只由 install/start/stop 操作改变，避免"测试连接后状态变已启动"的误导
    await prisma.hermesConfig.upsert({
      where: { userId: auth.user.id },
      create: {
        userId: auth.user.id,
        endpoint: testConfig.endpoint,
        apiKey: testConfig.apiKey,
        status: "installed", // 首次测试时标记为已安装，不标为 running
        lastCheckedAt: new Date(),
        lastError: result.error || null,
      },
      update: {
        endpoint: testConfig.endpoint,
        ...(apiKey !== undefined && { apiKey }),
        lastCheckedAt: new Date(),
        lastError: result.error || null,
        // 注意：不更新 status 字段，保持原有 running/installed/error 状态
      },
    });

    return NextResponse.json({
      connected: result.connected,
      version: result.version,
      capabilities: result.capabilities,
      error: result.error,
    });
  } catch (e) {
    logger.error({ err: e }, "测试 Hermes 连接失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

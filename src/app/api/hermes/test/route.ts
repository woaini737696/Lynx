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
      endpoint: endpoint || config?.endpoint || "http://localhost:7432",
      apiKey: apiKey !== undefined ? apiKey : config?.apiKey || null,
      autoStart: config?.autoStart ?? false,
      capabilities: config?.capabilities || [],
      installedAt: config?.installedAt || null,
      status: config?.status || "not_installed",
      lastCheckedAt: new Date(),
      lastError: null,
    };

    const result = await testHermesConnection(testConfig);

    // 更新数据库中的最近检查时间和状态
    await prisma.hermesConfig.upsert({
      where: { userId: auth.user.id },
      create: {
        userId: auth.user.id,
        endpoint: testConfig.endpoint,
        apiKey: testConfig.apiKey,
        status: result.connected ? "running" : "error",
        lastCheckedAt: new Date(),
        lastError: result.error || null,
      },
      update: {
        endpoint: testConfig.endpoint,
        ...(apiKey !== undefined && { apiKey }),
        lastCheckedAt: new Date(),
        ...(result.connected
          ? { status: "running", lastError: null }
          : { lastError: result.error }),
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

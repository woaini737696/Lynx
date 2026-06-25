import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { getHermesConfig, upsertHermesConfig } from "@/lib/hermes-client";
import { getLogger } from "@/lib/logger";

const logger = getLogger("hermes-api");

// GET /api/hermes/config - 获取 Hermes 配置
export async function GET() {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const config = await getHermesConfig(auth.user.id);
    return NextResponse.json({ config });
  } catch (e) {
    logger.error({ err: e }, "获取 Hermes 配置失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

// PUT /api/hermes/config - 更新 Hermes 配置
// body: { enabled?, endpoint?, apiKey?, autoStart?, capabilities? }
export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.user === null) return auth.error;

  try {
    const body = await req.json();
    const { enabled, endpoint, apiKey, autoStart, capabilities } = body as {
      enabled?: boolean;
      endpoint?: string;
      apiKey?: string | null;
      autoStart?: boolean;
      capabilities?: string[];
    };

    const config = await upsertHermesConfig(auth.user.id, {
      ...(enabled !== undefined && { enabled }),
      ...(endpoint !== undefined && { endpoint }),
      ...(apiKey !== undefined && { apiKey }),
      ...(autoStart !== undefined && { autoStart }),
      ...(capabilities !== undefined && { capabilities }),
    });

    return NextResponse.json({ config });
  } catch (e) {
    logger.error({ err: e }, "更新 Hermes 配置失败");
    return NextResponse.json(
      { error: "服务器错误：" + (e as Error).message },
      { status: 500 }
    );
  }
}

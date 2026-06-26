import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import { getLogger } from "@/lib/logger";

const logger = getLogger("user-ai-keys-api");

/**
 * GET /api/user/ai-keys
 * 返回当前用户的 AI Key 配置状态（不返回完整 Key，只返回掩码）
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const user = auth.user!;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        userDeepseekApiKey: true,
        userMimoApiKey: true,
        userAiProvider: true,
        profession: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 检查职业工作空间是否限制了 allowedProviders
    let allowedProviders: string[] | null = null;
    if (dbUser.profession) {
      const ws = await prisma.professionWorkspace.findUnique({
        where: { profession: dbUser.profession },
        select: { allowedProviders: true, enabled: true },
      });
      if (ws?.enabled) {
        const ap = ws.allowedProviders as string[] | null;
        if (Array.isArray(ap) && ap.length > 0) {
          allowedProviders = ap;
        }
      }
    }

    return NextResponse.json({
      deepseekApiKey: maskKey(dbUser.userDeepseekApiKey),
      mimoApiKey: maskKey(dbUser.userMimoApiKey),
      preferredProvider: dbUser.userAiProvider || null,
      allowedProviders, // null = 不限制
      hasDeepseekKey: Boolean(dbUser.userDeepseekApiKey),
      hasMimoKey: Boolean(dbUser.userMimoApiKey),
    });
  } catch (e) {
    logger.error({ err: e }, "获取用户 AI Key 失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/**
 * PUT /api/user/ai-keys
 * 更新当前用户的 AI Key 配置
 * Body: { deepseekApiKey?, mimoApiKey?, preferredProvider? }
 * 传空字符串清除 Key；不传字段保持原值
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const user = auth.user!;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
    }

    const { deepseekApiKey, mimoApiKey, preferredProvider } = body as {
      deepseekApiKey?: string;
      mimoApiKey?: string;
      preferredProvider?: string | null;
    };

    // 校验 preferredProvider
    if (preferredProvider !== undefined && preferredProvider !== null) {
      if (preferredProvider !== "deepseek" && preferredProvider !== "mimo") {
        return NextResponse.json({ error: "preferredProvider 需为 deepseek 或 mimo" }, { status: 400 });
      }
    }

    // 检查职业工作空间的 allowedProviders 限制
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { profession: true },
    });
    if (dbUser?.profession) {
      const ws = await prisma.professionWorkspace.findUnique({
        where: { profession: dbUser.profession },
        select: { allowedProviders: true, enabled: true },
      });
      if (ws?.enabled) {
        const ap = ws.allowedProviders as string[] | null;
        if (Array.isArray(ap) && ap.length > 0) {
          // 校验用户配置的 provider 是否被允许
          const targetProvider = preferredProvider || "deepseek";
          if (!ap.includes(targetProvider)) {
            return NextResponse.json({
              error: `你的职业（${dbUser.profession}）仅允许使用以下 AI 大模型：${ap.join("、")}`,
            }, { status: 403 });
          }
        }
      }
    }

    // 构造更新数据（只更新传入的字段）
    const updateData: Record<string, unknown> = {};
    if (deepseekApiKey !== undefined) {
      updateData.userDeepseekApiKey = deepseekApiKey.trim() || null;
    }
    if (mimoApiKey !== undefined) {
      updateData.userMimoApiKey = mimoApiKey.trim() || null;
    }
    if (preferredProvider !== undefined) {
      updateData.userAiProvider = preferredProvider || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "未提供任何更新字段" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    logger.info({ userId: user.id }, "用户更新了 AI Key 配置");
    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error({ err: e }, "更新用户 AI Key 失败");
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

/** 掩码 Key：只显示前 4 位和后 4 位 */
function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

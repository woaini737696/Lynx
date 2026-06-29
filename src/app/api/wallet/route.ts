// GET /api/wallet - 查询钱包余额
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getBalance } from "@/lib/wallet";
import { getEffectivePlan } from "@/lib/membership";

export async function GET(_req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const balance = await getBalance(user.id);
    const plan = await getEffectivePlan(user.id);

    return successResponse({
      credits: balance.credits.toString(), // BigInt 序列化为字符串
      sCoins: balance.sCoins,
      frozenCredits: balance.frozenCredits.toString(),
      availableCredits: balance.availableCredits.toString(),
      membership: {
        tier: plan.tier,
        name: plan.name,
        features: plan.features,
      },
    });
  } catch (e) {
    console.error("查询钱包失败:", e);
    return errorResponse(500, "服务器错误");
  }
}

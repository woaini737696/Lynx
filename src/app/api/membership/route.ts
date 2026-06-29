// GET /api/membership - 查询当前会员状态
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getOrCreateMembership, getEffectivePlan, getEffectiveTier } from "@/lib/membership";

export async function GET(_req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const membership = await getOrCreateMembership(user.id);
    const tier = await getEffectiveTier(user.id);
    const plan = await getEffectivePlan(user.id);

    return successResponse({
      tier,
      name: plan.name,
      status: membership.status,
      startedAt: membership.startedAt,
      expiresAt: membership.expiresAt,
      autoRenew: membership.autoRenew,
      billingCycle: membership.billingCycle,
      plan: {
        tier: plan.tier,
        name: plan.name,
        price: plan.price,
        credits: plan.credits.toString(), // BigInt 序列化为字符串
        sCoins: plan.sCoins,
        features: plan.features,
        modelAccess: plan.modelAccess,
        apiCallsPerDay: plan.apiCallsPerDay,
        memoryLimit: plan.memoryLimit,
        cognitionLimit: plan.cognitionLimit,
        flowLimit: plan.flowLimit,
        skillLimit: plan.skillLimit,
        hermesAgent: plan.hermesAgent,
        adFree: plan.adFree,
        prioritySupport: plan.prioritySupport,
        monthlyReport: plan.monthlyReport,
      },
    });
  } catch (e) {
    console.error("查询会员状态失败:", e);
    return errorResponse(500, "服务器错误");
  }
}

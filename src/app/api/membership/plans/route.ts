// GET /api/membership/plans - 查询所有会员套餐
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-response";
import { MEMBERSHIP_PLANS, BILLING_CYCLE_DISCOUNT } from "@/lib/membership";

export async function GET(_req: NextRequest) {
  try {
    const { error } = await requireAuth();
    if (error) return error;

    // 过滤掉 ULTRA 档位（已下架，保留现有 ULTRA 会员权益但不再展示/售卖）
    const plans = Object.values(MEMBERSHIP_PLANS)
      .filter((p) => p.tier !== "ULTRA")
      .map((p) => ({
        tier: p.tier,
        name: p.name,
        price: p.price,
        credits: p.credits.toString(),
        sCoins: p.sCoins,
        features: p.features,
        modelAccess: p.modelAccess,
        apiCallsPerDay: p.apiCallsPerDay,
        memoryLimit: p.memoryLimit,
        cognitionLimit: p.cognitionLimit,
        flowLimit: p.flowLimit,
        skillLimit: p.skillLimit,
        hermesAgent: p.hermesAgent,
        adFree: p.adFree,
        prioritySupport: p.prioritySupport,
        monthlyReport: p.monthlyReport,
      }));

    return successResponse({
      plans,
      billingCycles: [
        { key: "monthly", label: "月付", discount: BILLING_CYCLE_DISCOUNT.monthly },
        { key: "quarterly", label: "季付", discount: BILLING_CYCLE_DISCOUNT.quarterly },
        { key: "yearly", label: "年付", discount: BILLING_CYCLE_DISCOUNT.yearly },
      ],
    });
  } catch (e) {
    console.error("查询套餐失败:", e);
    return errorResponse(500, "服务器错误");
  }
}

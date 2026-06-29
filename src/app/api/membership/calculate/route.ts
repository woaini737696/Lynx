// GET /api/membership/calculate - 预览订单金额（不下单）
// query: tier, cycle, sCoinOffset
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse, badRequest } from "@/lib/api-response";
import { calculateOrderAmount } from "@/lib/membership";
import { getBalance } from "@/lib/wallet";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier") ?? "";
    const cycle = searchParams.get("cycle") ?? "monthly";
    const sCoinOffset = Number(searchParams.get("sCoinOffset") ?? 0);

    if (!tier) return badRequest("tier 不能为空");
    if (!["LITE", "PRO", "MAX", "ULTRA"].includes(tier)) return badRequest("tier 不合法");

    const calc = calculateOrderAmount(tier, cycle, sCoinOffset);
    const balance = await getBalance(user.id);

    return successResponse({
      ...calc,
      sCoinBalance: balance.sCoins,
      sCoinEnough: balance.sCoins >= calc.sCoinUsed,
    });
  } catch (e) {
    console.error("计算订单金额失败:", e);
    return errorResponse(500, "服务器错误");
  }
}

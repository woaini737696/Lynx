// POST /api/membership/order - 创建会员订单
// body: { tier, cycle, sCoinOffset?, paymentMethod? }
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse, badRequest } from "@/lib/api-response";
import { createOrder, calculateOrderAmount } from "@/lib/membership";
import { getBalance } from "@/lib/wallet";

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await req.json();
    const { tier, cycle, sCoinOffset = 0, paymentMethod = "manual" } = body;

    if (!tier || !cycle) return badRequest("tier 和 cycle 不能为空");
    if (!["LITE", "PRO", "MAX", "ULTRA"].includes(tier)) return badRequest("tier 不合法");
    if (!["monthly", "quarterly", "yearly"].includes(cycle)) return badRequest("cycle 不合法");

    // 计算订单金额预览
    const calc = calculateOrderAmount(tier, cycle, sCoinOffset);

    // 查询当前余额
    const balance = await getBalance(user.id);
    if (calc.sCoinUsed > balance.sCoins) {
      return badRequest(`S币余额不足，需要 ${calc.sCoinUsed}，可用 ${balance.sCoins}`);
    }

    // 创建订单
    const order = await createOrder(user.id, tier, cycle, sCoinOffset, paymentMethod);

    // 如果 actualAmount = 0（纯 S币 抵扣），直接激活
    if (calc.actualAmount === 0) {
      const { handlePaymentSuccess } = await import("@/lib/membership");
      await handlePaymentSuccess(order.id);
      const updated = await import("@/lib/db").then((m) =>
        m.prisma.subscriptionOrder.findUnique({ where: { id: order.id } })
      );
      return successResponse({
        order: updated ?? order,
        paid: true,
        message: "S币全额抵扣，会员已激活",
      });
    }

    return successResponse({
      order,
      paid: false,
      message: "订单已创建，请完成支付",
      payment: {
        actualAmount: calc.actualAmount,
        sCoinUsed: calc.sCoinUsed,
      },
    });
  } catch (e) {
    console.error("创建订单失败:", e);
    return errorResponse(500, "服务器错误：" + (e as Error).message);
  }
}

// GET /api/wallet/transactions - 查询交易流水
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-response";
import { listCreditTransactions, listSCoinTransactions } from "@/lib/wallet";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? undefined;
    const currency = searchParams.get("currency") ?? "credits"; // credits | scoins
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);
    const cursor = searchParams.get("cursor") ?? undefined;

    if (currency === "scoins") {
      const result = await listSCoinTransactions(user.id, { limit, cursor, type });
      return successResponse(result);
    } else {
      const result = await listCreditTransactions(user.id, { limit, cursor, type });
      // BigInt 序列化
      const serialized = {
        ...result,
        data: result.data.map((t) => ({
          ...t,
          amount: t.amount.toString(),
          balanceAfter: t.balanceAfter.toString(),
        })),
      };
      return successResponse(serialized);
    }
  } catch (e) {
    console.error("查询流水失败:", e);
    return errorResponse(500, "服务器错误");
  }
}

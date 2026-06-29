/**
 * 货币体系公共工具函数
 * 供 WalletPage / MembershipPage 等复用，避免重复实现
 */

/** 1 亿（Credits 用 BigInt 存储，亿级数值常见） */
export const YI = 100_000_000;

/** 15 Credits = 1 基础 token（系统计费比例） */
export const CREDITS_PER_TOKEN = 15;

/** 1 元 = 50 S币（S币抵扣现金比例） */
export const SCOIN_PER_YUAN = 50;

/**
 * 格式化 Credits（BigInt 字符串）：超过 1 亿用「亿」为单位
 * 失败时返回原始字符串
 */
export function formatCredits(creditStr: string): string {
  try {
    const n = BigInt(creditStr);
    if (n >= BigInt(YI)) {
      const yi = Number(n) / YI;
      const rounded = Math.round(yi * 100) / 100;
      return Number.isInteger(rounded) ? `${rounded}亿` : `${rounded.toFixed(2)}亿`;
    }
    return Number(n).toLocaleString();
  } catch {
    return creditStr;
  }
}

/**
 * 格式化 Credits 带单位（用于卡片大字显示）
 * 返回 { value, unit }，unit 为 "亿" 或 ""
 */
export function formatCreditsDisplay(creditStr: string): { value: string; unit: string } {
  try {
    const n = BigInt(creditStr);
    if (n >= BigInt(YI)) {
      const yi = Number(n) / YI;
      const rounded = Math.round(yi * 100) / 100;
      return {
        value: Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2),
        unit: "亿",
      };
    }
    return { value: Number(n).toLocaleString(), unit: "" };
  } catch {
    return { value: creditStr, unit: "" };
  }
}

/** S币 元转换：1元 = 50 S币 */
export function yuanToSCoins(yuan: number): number {
  return Math.round(yuan * SCOIN_PER_YUAN);
}

/** S币 转元 */
export function sCoinsToYuan(sCoins: number): number {
  return sCoins / SCOIN_PER_YUAN;
}

/** 根据 token 数和模型倍率计算 Credits 消耗（参考 wallet.ts） */
export function calculateCreditsCost(tokens: number, multiplier = 1): bigint {
  return BigInt(Math.ceil(tokens * CREDITS_PER_TOKEN * multiplier));
}

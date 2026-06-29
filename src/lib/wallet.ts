// 钱包核心库：Credits 点数 + S币 管理
// Credits：15 Credits = 1 基础 token，按模型倍率叠加
// S币：1元 = 50 S币，可抵扣会员现金
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/** metadata 类型：兼容 Prisma InputJsonValue */
type WalletMetadata = Prisma.InputJsonValue | undefined;

// ============ 常量 ============

/** 基础消耗：15 Credits = 1 token */
export const CREDITS_PER_TOKEN = 15;

/** S币 → 元 汇率：1元 = 50 S币 */
export const SCOIN_PER_YUAN = 50;

/** 模型消耗倍率（1 token = X Credits） */
export const MODEL_MULTIPLIER: Record<string, number> = {
  // 基础模型（1x）
  "gpt-3.5-turbo": 1,
  "deepseek-chat": 1,
  "mimo-7b": 1,
  // 进阶模型（3x）
  "deepseek-v3": 3,
  "qwen-max": 3,
  // 高级模型（5x）
  "gpt-4o-mini": 5,
  "claude-3-haiku": 5,
  // 旗舰模型（15x）
  "gpt-4o": 15,
  "claude-3.5-sonnet": 15,
  "deepseek-r1": 15,
  // 顶级模型（50x）
  "gpt-4-turbo": 50,
  "claude-3-opus": 50,
  "o1": 50,
  "o1-preview": 50,
};

/** 获取模型倍率（默认 1x） */
export function getModelMultiplier(model: string | undefined | null): number {
  if (!model) return 1;
  // 精确匹配
  if (MODEL_MULTIPLIER[model]) return MODEL_MULTIPLIER[model];
  // 模糊匹配（前缀）
  const lower = model.toLowerCase();
  for (const key of Object.keys(MODEL_MULTIPLIER)) {
    if (lower.includes(key)) return MODEL_MULTIPLIER[key];
  }
  return 1;
}

/** 计算 token 消耗的 Credits 数 */
export function calculateCreditsCost(
  tokens: number,
  model: string | undefined | null
): bigint {
  const multiplier = getModelMultiplier(model);
  return BigInt(Math.ceil(tokens * CREDITS_PER_TOKEN * multiplier));
}

/** S币 → 元 换算 */
export function sCoinsToYuan(sCoins: number): number {
  return sCoins / SCOIN_PER_YUAN;
}

/** 元 → S币 换算 */
export function yuanToSCoins(yuan: number): number {
  return Math.floor(yuan * SCOIN_PER_YUAN);
}

// ============ 钱包操作 ============

/** 获取或创建用户钱包 */
export async function getOrCreateWallet(userId: string) {
  let wallet = await prisma.userWallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.userWallet.create({
      data: {
        userId,
        credits: 5_000_000n, // 免费版赠送 500万 Credits
        sCoins: 0,
      },
    });
  }
  return wallet;
}

/** 查询余额 */
export async function getBalance(userId: string) {
  const wallet = await getOrCreateWallet(userId);
  return {
    credits: wallet.credits,
    sCoins: wallet.sCoins,
    frozenCredits: wallet.frozenCredits,
    availableCredits: wallet.credits - wallet.frozenCredits,
  };
}

/** 检查 Credits 是否充足 */
export async function hasEnoughCredits(userId: string, amount: bigint): Promise<boolean> {
  const wallet = await getOrCreateWallet(userId);
  return wallet.credits - wallet.frozenCredits >= amount;
}

/** 检查 S币 是否充足 */
export async function hasEnoughSCoins(userId: string, amount: number): Promise<boolean> {
  const wallet = await getOrCreateWallet(userId);
  return wallet.sCoins >= amount;
}

/** 增加 Credits（赚取） */
export async function addCredits(
  userId: string,
  amount: bigint,
  reason: string,
  description?: string,
  metadata?: WalletMetadata
) {
  return await prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("钱包不存在");

    const newBalance = wallet.credits + amount;
    const updated = await tx.userWallet.update({
      where: { userId },
      data: {
        credits: newBalance,
        totalCreditsEarned: wallet.totalCreditsEarned + amount,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "earn",
        amount,
        balanceAfter: newBalance,
        reason,
        description,
        metadata,
      },
    });

    return updated;
  });
}

/** 增加 S币（赚取） */
export async function addSCoins(
  userId: string,
  amount: number,
  reason: string,
  description?: string,
  metadata?: WalletMetadata
) {
  return await prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("钱包不存在");

    const newBalance = wallet.sCoins + amount;
    const updated = await tx.userWallet.update({
      where: { userId },
      data: {
        sCoins: newBalance,
        totalSCoinsEarned: wallet.totalSCoinsEarned + amount,
      },
    });

    await tx.sCoinTransaction.create({
      data: {
        userId,
        type: "earn",
        amount,
        balanceAfter: newBalance,
        reason,
        description,
        metadata,
      },
    });

    return updated;
  });
}

/** 扣除 Credits（消费） */
export async function deductCredits(
  userId: string,
  amount: bigint,
  reason: string,
  description?: string,
  metadata?: WalletMetadata
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("钱包不存在");

    const available = wallet.credits - wallet.frozenCredits;
    if (available < amount) {
      throw new InsufficientCreditsError(amount, available);
    }

    const newBalance = wallet.credits - amount;
    await tx.userWallet.update({
      where: { userId },
      data: {
        credits: newBalance,
        totalCreditsSpent: wallet.totalCreditsSpent + amount,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "spend",
        amount,
        balanceAfter: newBalance,
        reason,
        description,
        metadata,
      },
    });
  });
}

/** 扣除 S币（消费） */
export async function deductSCoins(
  userId: string,
  amount: number,
  reason: string,
  description?: string,
  metadata?: WalletMetadata
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("钱包不存在");

    if (wallet.sCoins < amount) {
      throw new InsufficientSCoinsError(amount, wallet.sCoins);
    }

    const newBalance = wallet.sCoins - amount;
    await tx.userWallet.update({
      where: { userId },
      data: {
        sCoins: newBalance,
        totalSCoinsSpent: wallet.totalSCoinsSpent + amount,
      },
    });

    await tx.sCoinTransaction.create({
      data: {
        userId,
        type: "spend",
        amount,
        balanceAfter: newBalance,
        reason,
        description,
        metadata,
      },
    });
  });
}

/** 冻结 Credits（预扣，如 AI 对话开始前） */
export async function freezeCredits(
  userId: string,
  amount: bigint,
  reason: string,
  metadata?: WalletMetadata
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("钱包不存在");

    const available = wallet.credits - wallet.frozenCredits;
    if (available < amount) {
      throw new InsufficientCreditsError(amount, available);
    }

    await tx.userWallet.update({
      where: { userId },
      data: { frozenCredits: wallet.frozenCredits + amount },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "freeze",
        amount,
        balanceAfter: wallet.credits,
        reason,
        description: "预扣冻结",
        metadata,
      },
    });
  });
}

/** 解冻 Credits（对话取消或失败时退回） */
export async function unfreezeCredits(
  userId: string,
  amount: bigint,
  reason: string,
  metadata?: WalletMetadata
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("钱包不存在");

    const frozen = wallet.frozenCredits > amount ? amount : wallet.frozenCredits;
    await tx.userWallet.update({
      where: { userId },
      data: { frozenCredits: wallet.frozenCredits - frozen },
    });

    await tx.creditTransaction.create({
      data: {
        userId,
        type: "unfreeze",
        amount: frozen,
        balanceAfter: wallet.credits,
        reason,
        description: "解冻退回",
        metadata,
      },
    });
  });
}

/** 结算冻结的 Credits（对话完成后按实际消耗结算） */
export async function settleFrozenCredits(
  userId: string,
  frozenAmount: bigint,
  actualCost: bigint,
  reason: string,
  metadata?: WalletMetadata
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("钱包不存在");

    // 解冻全部冻结额度
    const frozen = wallet.frozenCredits > frozenAmount ? frozenAmount : wallet.frozenCredits;
    await tx.userWallet.update({
      where: { userId },
      data: { frozenCredits: wallet.frozenCredits - frozen },
    });

    // 实际消耗 ≤ 冻结量：扣 actualCost，退回 (frozen - actualCost)
    // 实际消耗 > 冻结量：扣 frozen，差额需额外扣（但这里只结算冻结部分）
    const cost = actualCost > frozen ? frozen : actualCost;
    if (cost > 0n) {
      const newBalance = wallet.credits - cost;
      await tx.userWallet.update({
        where: { userId },
        data: {
          credits: newBalance,
          totalCreditsSpent: wallet.totalCreditsSpent + cost,
        },
      });
      await tx.creditTransaction.create({
        data: {
          userId,
          type: "spend",
          amount: cost,
          balanceAfter: newBalance,
          reason,
          description: "AI对话实际消耗",
          metadata: metadata ?? undefined,
        },
      });
    }
    // 退回多余冻结
    const refund = frozen - cost;
    if (refund > 0n) {
      await tx.creditTransaction.create({
        data: {
          userId,
          type: "refund",
          amount: refund,
          balanceAfter: wallet.credits - cost,
          reason,
          description: "预扣退还",
          metadata: metadata ?? undefined,
        },
      });
    }
  });
}

// ============ 错误类型 ============

export class InsufficientCreditsError extends Error {
  constructor(public required: bigint, public available: bigint) {
    super(`Credits 不足：需要 ${required}，可用 ${available}`);
    this.name = "InsufficientCreditsError";
  }
}

export class InsufficientSCoinsError extends Error {
  constructor(public required: number, public available: number) {
    super(`S币不足：需要 ${required}，可用 ${available}`);
    this.name = "InsufficientSCoinsError";
  }
}

// ============ 查询流水 ============

export async function listCreditTransactions(
  userId: string,
  options: { limit?: number; cursor?: string; type?: string } = {}
) {
  const { limit = 50, cursor, type } = options;
  const where: Prisma.CreditTransactionWhereInput = { userId };
  if (type) where.type = type;

  const items = await prisma.creditTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor
      ? { cursor: { id: cursor }, skip: 1 }
      : {}),
  });

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  return { data, hasMore, nextCursor: hasMore ? data[data.length - 1].id : null };
}

export async function listSCoinTransactions(
  userId: string,
  options: { limit?: number; cursor?: string; type?: string } = {}
) {
  const { limit = 50, cursor, type } = options;
  const where: Prisma.SCoinTransactionWhereInput = { userId };
  if (type) where.type = type;

  const items = await prisma.sCoinTransaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  return { data, hasMore, nextCursor: hasMore ? data[data.length - 1].id : null };
}

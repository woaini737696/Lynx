// 会员机制核心库
// 4档会员：Lite / Pro / Max / Ultra
// Credits 按月发放，S币 按月发放
// S币可抵扣会员现金（1元 = 50 S币）
import { prisma } from "@/lib/db";
import { addCredits, addSCoins, SCOIN_PER_YUAN } from "@/lib/wallet";

// ============ 会员套餐配置 ============

export interface MembershipPlan {
  tier: "FREE" | "LITE" | "PRO" | "MAX" | "ULTRA";
  name: string;
  price: number; // 月费（元）
  credits: bigint; // 每月赠送 Credits
  sCoins: number; // 每月赠送 S币
  features: string[]; // 核心权益
  // 模型权限
  modelAccess: ("basic" | "advanced" | "pro" | "flagship" | "top")[];
  // API 调用/日
  apiCallsPerDay: number; // -1 = 无限
  // 记忆存储上限
  memoryLimit: number; // -1 = 无限
  // 认知库容量
  cognitionLimit: number;
  // AI 工作流数上限
  flowLimit: number;
  // 技能数上限
  skillLimit: number;
  // 是否可用 HermesAgent
  hermesAgent: boolean;
  // 去广告
  adFree: boolean;
  // 优先客服
  prioritySupport: boolean;
  // 月度报告
  monthlyReport: boolean;
}

/** BigInt 字面量辅助 */
const B = (n: number) => BigInt(n);

export const MEMBERSHIP_PLANS: Record<string, MembershipPlan> = {
  FREE: {
    tier: "FREE",
    name: "免费版",
    price: 0,
    credits: B(5_000_000), // 500万
    sCoins: 0,
    features: ["基础模型", "每日50次API调用", "100条记忆存储", "3个工作流"],
    modelAccess: ["basic"],
    apiCallsPerDay: 50,
    memoryLimit: 100,
    cognitionLimit: 50,
    flowLimit: 3,
    skillLimit: 10,
    hermesAgent: false,
    adFree: false,
    prioritySupport: false,
    monthlyReport: false,
  },
  LITE: {
    tier: "LITE",
    name: "Lite 会员",
    price: 29,
    credits: B(3_000_000_000), // 30亿
    sCoins: 300,
    features: ["30亿Credits/月", "300 S币/月", "进阶模型", "HermesAgent", "去广告"],
    modelAccess: ["basic", "advanced"],
    apiCallsPerDay: 500,
    memoryLimit: 1000,
    cognitionLimit: 500,
    flowLimit: 10,
    skillLimit: 50,
    hermesAgent: true,
    adFree: true,
    prioritySupport: false,
    monthlyReport: false,
  },
  PRO: {
    tier: "PRO",
    name: "Pro 会员",
    price: 129,
    credits: B(15_000_000_000), // 150亿
    sCoins: 1500,
    features: ["150亿Credits/月", "1500 S币/月", "高级模型", "月度报告", "HermesAgent"],
    modelAccess: ["basic", "advanced", "pro"],
    apiCallsPerDay: 2000,
    memoryLimit: 5000,
    cognitionLimit: 2000,
    flowLimit: 50,
    skillLimit: 200,
    hermesAgent: true,
    adFree: true,
    prioritySupport: false,
    monthlyReport: true,
  },
  MAX: {
    tier: "MAX",
    name: "Max 会员",
    price: 299,
    credits: B(40_000_000_000), // 400亿
    sCoins: 3800,
    features: ["400亿Credits/月", "3800 S币/月", "旗舰模型", "优先客服", "月度报告"],
    modelAccess: ["basic", "advanced", "pro", "flagship"],
    apiCallsPerDay: 10000,
    memoryLimit: 20000,
    cognitionLimit: 10000,
    flowLimit: 200,
    skillLimit: 500,
    hermesAgent: true,
    adFree: true,
    prioritySupport: true,
    monthlyReport: true,
  },
  ULTRA: {
    tier: "ULTRA",
    name: "Ultra 会员",
    price: 699,
    credits: B(100_000_000_000), // 1000亿
    sCoins: 12800,
    features: ["1000亿Credits/月", "12800 S币/月", "顶级模型", "无限API", "优先客服"],
    modelAccess: ["basic", "advanced", "pro", "flagship", "top"],
    apiCallsPerDay: -1,
    memoryLimit: -1,
    cognitionLimit: -1,
    flowLimit: -1,
    skillLimit: -1,
    hermesAgent: true,
    adFree: true,
    prioritySupport: true,
    monthlyReport: true,
  },
};

/** 计费周期折扣 */
export const BILLING_CYCLE_DISCOUNT: Record<string, number> = {
  monthly: 1.0,
  quarterly: 0.95,
  yearly: 0.88,
};

/** 计算订单金额 */
export function calculateOrderAmount(
  tier: string,
  cycle: string,
  sCoinOffset: number = 0
): {
  basePrice: number;
  discount: number;
  amountAfterDiscount: number;
  sCoinOffsetYuan: number;
  actualAmount: number;
  sCoinUsed: number;
} {
  const plan = MEMBERSHIP_PLANS[tier];
  if (!plan) throw new Error(`未知会员档位：${tier}`);

  const basePrice = plan.price;
  const discount = BILLING_CYCLE_DISCOUNT[cycle] ?? 1.0;

  // 按周期计费（月付=1月，季付=3月，年付=12月）
  const months = cycle === "quarterly" ? 3 : cycle === "yearly" ? 12 : 1;
  const amountAfterDiscount = Math.round(basePrice * months * discount * 100) / 100;

  // S币抵扣
  const sCoinOffsetYuan = Math.min(sCoinsToYuan(sCoinOffset), amountAfterDiscount);
  const actualAmount = Math.max(0, Math.round((amountAfterDiscount - sCoinOffsetYuan) * 100) / 100);
  const sCoinUsed = Math.min(sCoinOffset, yuanToSCoins(amountAfterDiscount));

  return {
    basePrice,
    discount,
    amountAfterDiscount,
    sCoinOffsetYuan,
    actualAmount,
    sCoinUsed,
  };
}

function sCoinsToYuan(sCoins: number): number {
  return Math.round((sCoins / SCOIN_PER_YUAN) * 100) / 100;
}

function yuanToSCoins(yuan: number): number {
  return Math.floor(yuan * SCOIN_PER_YUAN);
}

// ============ 会员状态查询 ============

/** 获取或创建会员记录 */
export async function getOrCreateMembership(userId: string) {
  let membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership) {
    membership = await prisma.membership.create({
      data: {
        userId,
        tier: "FREE",
        status: "ACTIVE",
      },
    });
  }
  return membership;
}

/** 获取当前有效会员档位（检查过期） */
export async function getEffectiveTier(userId: string): Promise<string> {
  const membership = await getOrCreateMembership(userId);

  // 检查是否过期
  if (membership.tier !== "FREE" && membership.expiresAt && membership.expiresAt < new Date()) {
    // 已过期，降级为 FREE
    await prisma.membership.update({
      where: { userId },
      data: {
        tier: "FREE",
        status: "EXPIRED",
        autoRenew: false,
      },
    });
    return "FREE";
  }

  return membership.tier;
}

/** 获取当前会员套餐配置 */
export async function getEffectivePlan(userId: string): Promise<MembershipPlan> {
  const tier = await getEffectiveTier(userId);
  return MEMBERSHIP_PLANS[tier] ?? MEMBERSHIP_PLANS.FREE;
}

// ============ 会员开通/续费 ============

/**
 * 激活会员（支付成功后调用）
 * 按月发放 Credits 和 S币
 */
export async function activateMembership(
  userId: string,
  tier: string,
  cycle: string,
  orderId: string,
  actualAmount: number
): Promise<void> {
  const plan = MEMBERSHIP_PLANS[tier];
  if (!plan) throw new Error(`未知会员档位：${tier}`);

  const now = new Date();
  const months = cycle === "quarterly" ? 3 : cycle === "yearly" ? 12 : 1;
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  // 更新会员记录
  const existing = await prisma.membership.findUnique({ where: { userId } });
  // 如果已有未过期会员，在原到期时间基础上延期
  let startDate = now;
  if (existing && existing.expiresAt && existing.expiresAt > now && existing.tier !== "FREE") {
    startDate = existing.expiresAt;
    expiresAt.setTime(existing.expiresAt.getTime());
    expiresAt.setMonth(expiresAt.getMonth() + months);
  }

  await prisma.membership.upsert({
    where: { userId },
    update: {
      tier,
      status: "ACTIVE",
      startedAt: startDate,
      expiresAt,
      billingCycle: cycle,
      pricePaid: actualAmount,
      lastCreditsGrant: now,
      lastSCoinsGrant: now,
    },
    create: {
      userId,
      tier,
      status: "ACTIVE",
      startedAt: startDate,
      expiresAt,
      billingCycle: cycle,
      pricePaid: actualAmount,
      lastCreditsGrant: now,
      lastSCoinsGrant: now,
    },
  });

  // 立即发放首月 Credits 和 S币
  await addCredits(userId, plan.credits, "membership_gift", `${plan.name} 月度 Credits 赠送`, {
    tier,
    cycle,
    orderId,
    month: 1,
  });
  await addSCoins(userId, plan.sCoins, "membership_gift", `${plan.name} 月度 S币 赠送`, {
    tier,
    cycle,
    orderId,
    month: 1,
  });

  // 标记订单为已支付
  await prisma.subscriptionOrder.update({
    where: { id: orderId },
    data: {
      status: "paid",
      paidAt: now,
    },
  });
}

/**
 * 创建订阅订单
 * 支持 S币抵扣
 */
export async function createOrder(
  userId: string,
  tier: string,
  cycle: string,
  sCoinOffset: number = 0,
  paymentMethod: string = "manual"
) {
  const plan = MEMBERSHIP_PLANS[tier];
  if (!plan) throw new Error(`未知会员档位：${tier}`);
  if (tier === "FREE") throw new Error("免费版无需购买");

  const calc = calculateOrderAmount(tier, cycle, sCoinOffset);

  // 如果使用 S币抵扣，先检查余额
  if (calc.sCoinUsed > 0) {
    const { hasEnoughSCoins } = await import("@/lib/wallet");
    const enough = await hasEnoughSCoins(userId, calc.sCoinUsed);
    if (!enough) throw new Error("S币余额不足，无法抵扣");
  }

  const order = await prisma.subscriptionOrder.create({
    data: {
      userId,
      tier,
      cycle,
      amount: calc.amountAfterDiscount,
      sCoinOffset: calc.sCoinOffsetYuan,
      sCoinUsed: calc.sCoinUsed,
      actualAmount: calc.actualAmount,
      status: "pending",
      paymentMethod,
    },
  });

  return order;
}

/**
 * 订单支付成功处理（支付回调触发）
 * 扣除 S币抵扣部分 + 激活会员
 */
export async function handlePaymentSuccess(
  orderId: string,
  tradeNo?: string
): Promise<void> {
  const order = await prisma.subscriptionOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`订单不存在：${orderId}`);
  if (order.status === "paid") return; // 已处理

  // 扣除 S币 抵扣部分
  if (order.sCoinUsed > 0) {
    const { deductSCoins } = await import("@/lib/wallet");
    await deductSCoins(
      order.userId,
      order.sCoinUsed,
      "membership_offset",
      `${order.tier} 会员 ${order.cycle} S币抵扣`,
      { orderId: order.id, tier: order.tier, cycle: order.cycle }
    );
  }

  // 激活会员
  await activateMembership(
    order.userId,
    order.tier,
    order.cycle,
    order.id,
    Number(order.actualAmount)
  );

  // 更新支付流水号
  if (tradeNo) {
    await prisma.subscriptionOrder.update({
      where: { id: orderId },
      data: { tradeNo },
    });
  }
}

// ============ 月度发放检查 ============

/**
 * 检查并发放月度 Credits/S币
 * 应由 cron 定时任务每天调用一次
 * 年付会员每月1号发放，月付/季付在开通日每满一月发放
 */
export async function checkAndGrantMonthly(userId: string): Promise<void> {
  const membership = await prisma.membership.findUnique({ where: { userId } });
  if (!membership || membership.tier === "FREE" || membership.status !== "ACTIVE") return;

  const now = new Date();
  const lastGrant = membership.lastCreditsGrant ?? membership.startedAt ?? now;

  // 检查是否满一个月
  const nextGrantDate = new Date(lastGrant);
  nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);

  if (now < nextGrantDate) return; // 未满一个月

  // 检查会员是否已过期
  if (membership.expiresAt && membership.expiresAt < now) {
    await prisma.membership.update({
      where: { userId },
      data: { tier: "FREE", status: "EXPIRED", autoRenew: false },
    });
    return;
  }

  const plan = MEMBERSHIP_PLANS[membership.tier];
  if (!plan) return;

  // 发放 Credits 和 S币
  await addCredits(userId, plan.credits, "membership_gift", `${plan.name} 月度 Credits 赠送`, {
    tier: membership.tier,
    month: Math.floor((now.getTime() - (membership.startedAt?.getTime() ?? now.getTime())) / (30 * 24 * 60 * 60 * 1000)) + 1,
  });
  await addSCoins(userId, plan.sCoins, "membership_gift", `${plan.name} 月度 S币 赠送`, {
    tier: membership.tier,
  });

  await prisma.membership.update({
    where: { userId },
    data: {
      lastCreditsGrant: now,
      lastSCoinsGrant: now,
    },
  });
}

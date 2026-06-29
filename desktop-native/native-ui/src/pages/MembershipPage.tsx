// 会员页面（对齐 Web 端 /api/membership）
// 会员档位 · 套餐对比 · 升级续费
import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Check,
  Sparkles,
  Zap,
  Brain,
  Workflow,
  Wrench,
  Loader2,
  RefreshCw,
  Calendar,
  Infinity as InfinityIcon,
  Coins,
  AlertCircle,
  CreditCard,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { HelpButton } from "@/components/ui/HelpButton";
import { Modal } from "@/components/ui/Modal";
import { cloudApi } from "@/lib/cloud-api";
import { formatCredits } from "@/lib/credits";

// hsl 主色变量值（与 globals.css 中 --primary 一致：217 86% 33%）
const PRIMARY_HSL = "hsl(217 86% 33%)";

// ============ 类型定义 ============

interface MembershipPlan {
  tier: "FREE" | "LITE" | "PRO" | "MAX" | "ULTRA";
  name: string;
  price: number;
  credits: string; // BigInt 序列化为字符串
  sCoins: number;
  features: string[];
  modelAccess: string[];
  apiCallsPerDay: number;
  memoryLimit: number;
  cognitionLimit: number;
  flowLimit: number;
  skillLimit: number;
  hermesAgent: boolean;
  adFree: boolean;
  prioritySupport: boolean;
  monthlyReport: boolean;
}

interface BillingCycle {
  key: string;
  label: string;
  discount: number;
}

interface PlansData {
  plans: MembershipPlan[];
  billingCycles: BillingCycle[];
}

interface CurrentMembership {
  tier: string;
  name: string;
  status: string;
  startedAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  billingCycle: string | null;
  plan: MembershipPlan;
}

// ============ 常量 ============

// YI / formatCredits 已抽取到 @/lib/credits

/** 5 档套餐的视觉配置 */
const TIER_THEME: Record<
  string,
  {
    gradient: string;
    ring: string;
    badgeClass: string;
    iconColor: string;
    glow: string;
  }
> = {
  FREE: {
    gradient: "from-gray-500 to-gray-700",
    ring: "ring-border/60",
    badgeClass: "bg-muted/30 text-muted-foreground",
    iconColor: "text-muted-foreground",
    glow: "bg-muted/20",
  },
  LITE: {
    gradient: "from-cognition to-blue-500",
    ring: "ring-cognition/40",
    badgeClass: "bg-cognition/10 text-cognition",
    iconColor: "text-cognition",
    glow: "bg-cognition/20",
  },
  PRO: {
    gradient: "from-campaign to-orange-500",
    ring: "ring-campaign/40",
    badgeClass: "bg-campaign/10 text-campaign",
    iconColor: "text-campaign",
    glow: "bg-campaign/20",
  },
  MAX: {
    gradient: "from-northstar to-indigo-500",
    ring: "ring-northstar/40",
    badgeClass: "bg-northstar/10 text-northstar",
    iconColor: "text-northstar",
    glow: "bg-northstar/20",
  },
  ULTRA: {
    gradient: "from-amber-500 to-yellow-500",
    ring: "ring-amber-400/50",
    badgeClass: "bg-task/10 text-task",
    iconColor: "text-amber-500",
    glow: "bg-amber-500/20",
  },
};

/** 计费周期配置 */
const CYCLE_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

const CYCLE_LABEL: Record<string, string> = {
  monthly: "月付",
  quarterly: "季付",
  yearly: "年付",
};

// ============ 工具函数 ============

// formatCredits 已抽取到 @/lib/credits

/** 格式化日期：YYYY-MM-DD */
function formatDate(iso: string | null): string {
  if (!iso) return "永久";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 计算剩余天数 */
function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

/** 客户端订单金额计算（与后端 calculateOrderAmount 保持一致） */
function calcOrderAmount(
  basePrice: number,
  cycle: string,
  discount: number,
  sCoinOffset: number
): {
  months: number;
  originalPrice: number;
  discountAmount: number;
  amountAfterDiscount: number;
  sCoinOffsetYuan: number;
  actualAmount: number;
  sCoinUsed: number;
} {
  const months = CYCLE_MONTHS[cycle] ?? 1;
  const originalPrice = Math.round(basePrice * months * 100) / 100;
  const amountAfterDiscount = Math.round(originalPrice * discount * 100) / 100;
  const discountAmount = Math.round((originalPrice - amountAfterDiscount) * 100) / 100;

  // S币 → 元（1 元 = 50 S币）
  const sCoinOffsetYuanRaw = Math.round((sCoinOffset / 50) * 100) / 100;
  const sCoinOffsetYuan = Math.min(sCoinOffsetYuanRaw, amountAfterDiscount);
  const actualAmount = Math.max(0, Math.round((amountAfterDiscount - sCoinOffsetYuan) * 100) / 100);
  const sCoinUsed = Math.min(sCoinOffset, Math.floor(amountAfterDiscount * 50));

  return {
    months,
    originalPrice,
    discountAmount,
    amountAfterDiscount,
    sCoinOffsetYuan,
    actualAmount,
    sCoinUsed,
  };
}

// ============ 主组件 ============

export function MembershipPage() {
  const [membership, setMembership] = useState<CurrentMembership | null>(null);
  const [plansData, setPlansData] = useState<PlansData | null>(null);
  const [sCoinBalance, setSCoinBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // 购买 Modal 状态
  const [purchaseModal, setPurchaseModal] = useState<{
    open: boolean;
    tier: string;
    cycle: string;
    sCoinOffset: number;
    submitting: boolean;
  }>({
    open: false,
    tier: "",
    cycle: "monthly",
    sCoinOffset: 0,
    submitting: false,
  });

  // 加载会员状态
  const loadMembership = useCallback(async () => {
    try {
      const json = await cloudApi.get<{ success: boolean; data: CurrentMembership }>(
        "/api/membership"
      );
      setMembership(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载会员状态失败");
    }
  }, []);

  // 加载套餐列表
  const loadPlans = useCallback(async () => {
    try {
      const json = await cloudApi.get<{ success: boolean; data: PlansData }>(
        "/api/membership/plans"
      );
      setPlansData(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载套餐失败");
    }
  }, []);

  // 加载 S币 余额
  const loadSCoinBalance = useCallback(async () => {
    try {
      const json = await cloudApi.get<{
        success: boolean;
        data: { sCoins: number };
      }>("/api/wallet");
      setSCoinBalance(json.data?.sCoins ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载 S币 余额失败");
    }
  }, []);

  useEffect(() => {
    Promise.all([loadMembership(), loadPlans(), loadSCoinBalance()]).finally(() =>
      setLoading(false)
    );
  }, [loadMembership, loadPlans, loadSCoinBalance]);

  // 刷新
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await Promise.all([loadMembership(), loadPlans(), loadSCoinBalance()]);
    } finally {
      setLoading(false);
    }
  };

  // 打开购买 Modal
  const openPurchaseModal = (tier: string) => {
    setPurchaseModal({
      open: true,
      tier,
      cycle: "monthly",
      sCoinOffset: 0,
      submitting: false,
    });
  };

  // 关闭 Modal
  const closePurchaseModal = () => {
    if (purchaseModal.submitting) return;
    setPurchaseModal((prev) => ({ ...prev, open: false }));
  };

  // 切换计费周期
  const handleCycleChange = (cycle: string) => {
    setPurchaseModal((prev) => ({ ...prev, cycle, sCoinOffset: 0 }));
  };

  // S币 抵扣滑块
  const handleSCoinOffsetChange = (value: number) => {
    setPurchaseModal((prev) => ({
      ...prev,
      sCoinOffset: Math.max(0, Math.min(value, sCoinBalance)),
    }));
  };

  // 确认支付：创建订单
  const handleConfirmPurchase = async () => {
    const { tier, cycle, sCoinOffset } = purchaseModal;
    if (!tier) return;
    setPurchaseModal((prev) => ({ ...prev, submitting: true }));
    try {
      const json = await cloudApi.post<{
        success: boolean;
        data: { paid: boolean; message?: string };
        error?: { message?: string };
      }>("/api/membership/order", { tier, cycle, sCoinOffset, paymentMethod: "manual" });

      if (!json.success) {
        throw new Error(json.error?.message || "创建订单失败");
      }
      const { paid, message } = json.data || {};
      if (paid) {
        toast.success(message || "S币全额抵扣，会员已激活");
      } else {
        toast.success(message || "订单已创建，请完成支付");
      }
      setPurchaseModal((prev) => ({ ...prev, open: false, submitting: false }));
      // 刷新会员状态与 S币 余额
      setLoading(true);
      await Promise.all([loadMembership(), loadSCoinBalance()]);
      setLoading(false);
    } catch (e) {
      toast.error((e as Error).message || "下单失败");
      setPurchaseModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">加载会员...</p>
      </div>
    );
  }

  if (!membership || !plansData) {
    return (
      <div className="mx-auto max-w-5xl">
        <MembershipHeader onRefresh={handleRefresh} />
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
            <Crown className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium text-foreground">加载失败</div>
        </div>
      </div>
    );
  }

  const currentTier = membership.tier;
  const currentTierIndex = plansData.plans.findIndex((p) => p.tier === currentTier);

  return (
    <div className="mx-auto max-w-5xl">
      <MembershipHeader onRefresh={handleRefresh} />

      {/* ============ 当前会员状态卡片 ============ */}
      <CurrentMembershipCard membership={membership} sCoinBalance={sCoinBalance} />

      {/* ============ 套餐对比网格 ============ */}
      <div className="mb-4 flex items-center gap-2">
        <Crown className="h-4 w-4 text-campaign" />
        <h2 className="text-sm font-semibold text-foreground">套餐对比</h2>
        <span className="text-xs text-muted-foreground">5 档套餐 · 选择适合你的方案</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plansData.plans.map((plan) => {
          const theme = TIER_THEME[plan.tier] || TIER_THEME.FREE;
          const isCurrent = plan.tier === currentTier;
          const planIndex = plansData.plans.findIndex((p) => p.tier === plan.tier);
          const isUpgrade = planIndex > currentTierIndex;
          const isDowngrade = planIndex < currentTierIndex;

          return (
            <PlanCard
              key={plan.tier}
              plan={plan}
              theme={theme}
              isCurrent={isCurrent}
              isUpgrade={isUpgrade}
              isDowngrade={isDowngrade}
              onPurchase={() => openPurchaseModal(plan.tier)}
            />
          );
        })}
      </div>

      {/* ============ 购买 Modal ============ */}
      <PurchaseModal
        open={purchaseModal.open}
        tier={purchaseModal.tier}
        cycle={purchaseModal.cycle}
        sCoinOffset={purchaseModal.sCoinOffset}
        sCoinBalance={sCoinBalance}
        submitting={purchaseModal.submitting}
        plans={plansData.plans}
        billingCycles={plansData.billingCycles}
        onClose={closePurchaseModal}
        onCycleChange={handleCycleChange}
        onSCoinOffsetChange={handleSCoinOffsetChange}
        onConfirm={handleConfirmPurchase}
      />
    </div>
  );
}

// ============ 页头 ============

function MembershipHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-start justify-between gap-3"
    >
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Crown className="h-6 w-6 text-primary" />
          会员
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">会员档位 · 套餐对比 · 升级续费</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="btn-glass flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm"
          title="刷新"
        >
          <RefreshCw className="h-4 w-4" />
          <span>刷新</span>
        </button>
        <HelpButton module="membership" />
      </div>
    </motion.div>
  );
}

// ============ 当前会员卡片 ============

function CurrentMembershipCard({
  membership,
  sCoinBalance,
}: {
  membership: CurrentMembership;
  sCoinBalance: number;
}) {
  const theme = TIER_THEME[membership.tier] || TIER_THEME.FREE;
  const expiresAt = membership.expiresAt;
  const days = daysLeft(expiresAt);
  const isExpired = membership.status === "EXPIRED";
  const isFree = membership.tier === "FREE";

  return (
    <div className="ios-glass relative mb-6 overflow-hidden p-5">
      {/* 背景装饰 */}
      <div
        className={cn(
          "pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full blur-3xl",
          theme.glow
        )}
      />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-cognition/10 blur-3xl" />

      <div className="relative">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* 会员图标 */}
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg",
                theme.gradient
              )}
            >
              <Crown className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{membership.name}</h2>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                    theme.badgeClass
                  )}
                >
                  {isExpired ? "已过期" : membership.status === "ACTIVE" ? "使用中" : membership.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {isFree ? "永久免费" : `到期 ${formatDate(expiresAt)}`}
                </span>
                {!isFree && days !== null && (
                  <span className={days < 7 ? "text-campaign" : ""}>剩余 {days} 天</span>
                )}
                {membership.billingCycle && (
                  <span className="flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    {CYCLE_LABEL[membership.billingCycle] || membership.billingCycle}
                  </span>
                )}
                {membership.autoRenew && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-task/10 px-2 py-0.5 text-[11px] font-medium text-task">
                    <RefreshCw className="h-3 w-3" />
                    自动续费
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* S币 余额提示 */}
          <div className="ios-glass-sm rounded-xl px-3 py-2 text-right">
            <div className="text-[11px] text-muted-foreground">S币 余额</div>
            <div className="text-base font-semibold text-campaign">{sCoinBalance.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">可抵扣 ¥{(sCoinBalance / 50).toFixed(2)}</div>
          </div>
        </div>

        {/* 权益概览 */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <BenefitItem
            icon={Sparkles}
            label="Credits/月"
            value={formatCredits(membership.plan.credits)}
          />
          <BenefitItem
            icon={Gift}
            label="S币/月"
            value={membership.plan.sCoins.toLocaleString()}
          />
          <BenefitItem
            icon={Zap}
            label="API/日"
            value={
              membership.plan.apiCallsPerDay === -1
                ? "无限"
                : membership.plan.apiCallsPerDay.toLocaleString()
            }
          />
          <BenefitItem
            icon={Brain}
            label="记忆上限"
            value={
              membership.plan.memoryLimit === -1
                ? "无限"
                : membership.plan.memoryLimit.toLocaleString()
            }
          />
          <BenefitItem
            icon={Workflow}
            label="工作流数"
            value={
              membership.plan.flowLimit === -1
                ? "无限"
                : membership.plan.flowLimit.toLocaleString()
            }
          />
          <BenefitItem
            icon={Wrench}
            label="技能数"
            value={
              membership.plan.skillLimit === -1
                ? "无限"
                : membership.plan.skillLimit.toLocaleString()
            }
          />
        </div>

        {/* 核心权益列表 */}
        <div className="mt-4 flex flex-wrap gap-2">
          {membership.plan.features.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-primary/5 px-2.5 py-1 text-[11px] text-foreground/80"
            >
              <Check className="h-3 w-3 text-task" />
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BenefitItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Brain;
  label: string;
  value: string;
}) {
  return (
    <div className="ios-glass-sm rounded-xl px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

// ============ 套餐卡片 ============

function PlanCard({
  plan,
  theme,
  isCurrent,
  isUpgrade,
  isDowngrade,
  onPurchase,
}: {
  plan: MembershipPlan;
  theme: (typeof TIER_THEME)[keyof typeof TIER_THEME];
  isCurrent: boolean;
  isUpgrade: boolean;
  isDowngrade: boolean;
  onPurchase: () => void;
}) {
  const isFree = plan.tier === "FREE";

  return (
    <div
      className={cn(
        "ios-glass relative flex flex-col overflow-hidden p-5 transition-colors",
        isCurrent ? cn("ring-2", theme.ring) : "hover:bg-primary/3"
      )}
    >
      {/* 背景光晕 */}
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-50 blur-2xl",
          theme.glow
        )}
      />

      <div className="relative flex flex-1 flex-col">
        {/* 头部：档位名称 + 当前标签 */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-md",
                theme.gradient
              )}
            >
              <Crown className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-base font-bold text-foreground">{plan.name}</div>
              <div className="text-[11px] text-muted-foreground">{plan.tier}</div>
            </div>
          </div>
          {isCurrent && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                theme.badgeClass
              )}
            >
              <Check className="h-3 w-3" />
              当前会员
            </span>
          )}
        </div>

        {/* 价格 */}
        <div className="mb-4">
          {isFree ? (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">¥0</span>
              <span className="text-xs text-muted-foreground">/ 永久</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">¥{plan.price}</span>
              <span className="text-xs text-muted-foreground">/ 月</span>
            </div>
          )}
        </div>

        {/* 月度权益 */}
        <div className="mb-4 space-y-2">
          <div className="ios-glass-sm flex items-center justify-between rounded-lg px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Coins className="h-3 w-3" />
              Credits/月
            </span>
            <span className="font-semibold text-foreground">{formatCredits(plan.credits)}</span>
          </div>
          <div className="ios-glass-sm flex items-center justify-between rounded-lg px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Gift className="h-3 w-3" />
              S币/月
            </span>
            <span className="font-semibold text-foreground">{plan.sCoins.toLocaleString()}</span>
          </div>
        </div>

        {/* 核心权益 */}
        <div className="mb-4 flex-1 space-y-1.5">
          {plan.features.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-task" />
              <span>{f}</span>
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="mt-auto">
          {isCurrent ? (
            <button
              disabled
              className="btn-glass flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs opacity-60"
            >
              <Check className="h-3 w-3" />
              当前会员
            </button>
          ) : isFree ? (
            <button
              disabled
              className="btn-glass flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs opacity-60"
            >
              <InfinityIcon className="h-3 w-3" />
              永久免费
            </button>
          ) : isUpgrade ? (
            <button
              onClick={onPurchase}
              className="btn-primary-glass flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs"
            >
              <Crown className="h-3 w-3" />
              升级
            </button>
          ) : isDowngrade ? (
            <button
              onClick={onPurchase}
              className="btn-glass flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              续费
            </button>
          ) : (
            <button
              onClick={onPurchase}
              className="btn-primary-glass flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-xs"
            >
              <Crown className="h-3 w-3" />
              开通
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ 购买 Modal ============

function PurchaseModal({
  open,
  tier,
  cycle,
  sCoinOffset,
  sCoinBalance,
  submitting,
  plans,
  billingCycles,
  onClose,
  onCycleChange,
  onSCoinOffsetChange,
  onConfirm,
}: {
  open: boolean;
  tier: string;
  cycle: string;
  sCoinOffset: number;
  sCoinBalance: number;
  submitting: boolean;
  plans: MembershipPlan[];
  billingCycles: BillingCycle[];
  onClose: () => void;
  onCycleChange: (cycle: string) => void;
  onSCoinOffsetChange: (value: number) => void;
  onConfirm: () => void;
}) {
  const plan = useMemo(() => plans.find((p) => p.tier === tier), [plans, tier]);
  const cycleInfo = useMemo(() => billingCycles.find((c) => c.key === cycle), [billingCycles, cycle]);

  // 客户端实时计算订单金额
  const calc = useMemo(() => {
    if (!plan || !cycleInfo) return null;
    return calcOrderAmount(plan.price, cycle, cycleInfo.discount, sCoinOffset);
  }, [plan, cycle, cycleInfo, sCoinOffset]);

  if (!plan || !calc) {
    return (
      <Modal open={open} onClose={onClose} title="购买会员" size="lg">
        <div className="py-8 text-center text-sm text-muted-foreground">套餐信息加载中...</div>
      </Modal>
    );
  }

  const theme = TIER_THEME[plan.tier] || TIER_THEME.FREE;
  const isFullOffset = calc.actualAmount === 0;
  const maxSliderValue = Math.min(sCoinBalance, Math.floor(calc.amountAfterDiscount * 50));
  const sCoinNotEnough = sCoinBalance < calc.sCoinUsed && calc.sCoinUsed > 0;

  return (
    <Modal open={open} onClose={onClose} title={`升级到 ${plan.name}`} size="lg">
      <div className="space-y-5">
        {/* 套餐概览 */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl bg-gradient-to-br p-4",
            theme.gradient
          )}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center justify-between text-white">
            <div>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                <span className="text-lg font-bold">{plan.name}</span>
              </div>
              <div className="mt-1 text-xs text-white/80">
                {formatCredits(plan.credits)} Credits/月 · {plan.sCoins.toLocaleString()} S币/月
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">¥{plan.price}</div>
              <div className="text-[11px] text-white/80">/ 月</div>
            </div>
          </div>
        </div>

        {/* 计费周期选择 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">计费周期</label>
          <div className="grid grid-cols-3 gap-2">
            {billingCycles.map((c) => {
              const active = cycle === c.key;
              const months = CYCLE_MONTHS[c.key] ?? 1;
              const totalAmount = Math.round(plan.price * months * c.discount * 100) / 100;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onCycleChange(c.key)}
                  className={cn(
                    "relative rounded-xl border p-3 text-left transition-all",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-background hover:border-primary/40"
                  )}
                >
                  <div className="text-sm font-semibold text-foreground">{c.label}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {months} 个月
                    {c.discount < 1 && (
                      <span className="ml-1 rounded-full bg-campaign/10 px-1.5 py-0.5 text-[10px] text-campaign">
                        {(c.discount * 10).toFixed(1)}折
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-sm font-bold text-foreground">¥{totalAmount}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* S币 抵扣滑块 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">S币 抵扣</label>
            <div className="text-xs text-muted-foreground">
              余额 <span className="font-semibold text-campaign">{sCoinBalance.toLocaleString()}</span> S币
              <span className="ml-1 text-muted-foreground/70">（1 元 = 50 S币）</span>
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={maxSliderValue}
            step={1}
            value={Math.min(sCoinOffset, maxSliderValue)}
            onChange={(e) => onSCoinOffsetChange(Number(e.target.value))}
            disabled={maxSliderValue === 0}
            style={{ accentColor: PRIMARY_HSL }}
            className="w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="S币 抵扣数量"
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>0 S币</span>
            <span className="font-semibold text-campaign">
              使用 {Math.min(sCoinOffset, maxSliderValue).toLocaleString()} S币
              <span className="ml-1 text-muted-foreground/70">
                （抵扣 ¥{calc.sCoinOffsetYuan.toFixed(2)}）
              </span>
            </span>
            <span>{maxSliderValue.toLocaleString()} S币</span>
          </div>
          {sCoinNotEnough && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-graveyard/30 bg-graveyard/5 px-2.5 py-1.5 text-[11px] text-graveyard">
              <AlertCircle className="h-3 w-3" />
              S币 余额不足，下单时会失败
            </div>
          )}
          {isFullOffset && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-task/30 bg-task/5 px-2.5 py-1.5 text-[11px] text-task">
              <Check className="h-3 w-3" />
              S币 全额抵扣，无需支付现金，订单将立即激活
            </div>
          )}
        </div>

        {/* 订单金额明细 */}
        <div className="ios-glass-sm space-y-2 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">原价</span>
            <span className="text-foreground/80">¥{calc.originalPrice.toFixed(2)}</span>
          </div>
          {calc.discountAmount > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">周期折扣</span>
              <span className="text-campaign">-¥{calc.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">折后小计</span>
            <span className="text-foreground/80">¥{calc.amountAfterDiscount.toFixed(2)}</span>
          </div>
          {calc.sCoinOffsetYuan > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">S币 抵扣</span>
              <span className="text-campaign">-¥{calc.sCoinOffsetYuan.toFixed(2)}</span>
            </div>
          )}
          <div className="my-2 h-px bg-border/60" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">实付金额</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-northstar">¥{calc.actualAmount.toFixed(2)}</span>
              {isFullOffset && (
                <span className="rounded-full bg-task/10 px-2 py-0.5 text-[10px] font-medium text-task">
                  全额抵扣
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 权益提示 */}
        <div className="rounded-lg border border-northstar/20 bg-northstar/5 p-3 text-xs text-foreground/80">
          <div className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground">
            <Gift className="h-3.5 w-3.5 text-northstar" />
            开通后立即获得
          </div>
          <ul className="space-y-1 pl-5">
            <li>• {formatCredits(plan.credits)} Credits（立即到账）</li>
            <li>• {plan.sCoins.toLocaleString()} S币（立即到账）</li>
            <li>• {CYCLE_LABEL[cycle]} 周期，到期后可续费</li>
          </ul>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={submitting}
            className="btn-glass flex h-9 items-center px-4 text-sm disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting || sCoinNotEnough}
            className="btn-primary-glass flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                下单中...
              </>
            ) : isFullOffset ? (
              <>
                <Check className="h-3.5 w-3.5" />
                确认开通（S币全额抵扣）
              </>
            ) : (
              <>
                <CreditCard className="h-3.5 w-3.5" />
                确认支付 ¥{calc.actualAmount.toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  Check,
  Crown,
  Users,
  Zap,
  Download,
  TrendingUp,
  Calendar,
  CreditCard,
  Loader2,
  Receipt,
} from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";

// ============ 类型定义 ============

type PlanId = "free" | "pro" | "team";

interface Plan {
  id: PlanId;
  name: string;
  price: number; // 月费（元），0 表示免费
  priceYearly: number; // 年费
  badge?: string;
  highlight?: boolean;
  desc: string;
  features: string[];
  tokenLimit: number; // 月 Token 上限
  cta: string;
}

interface CurrentSubscription {
  plan: PlanId;
  status: "active" | "expired" | "trialing";
  startedAt: string;
  expiresAt: string;
  usedTokens: number;
  limitTokens: number;
  willRenew: boolean;
}

interface BillRecord {
  id: string;
  period: string; // 账单周期，如 "2026-06"
  plan: PlanId;
  amount: number;
  status: "paid" | "pending" | "refunded";
  paidAt: string | null;
  invoiceUrl: string | null;
}

interface SubscriptionData {
  current: CurrentSubscription;
  bills: BillRecord[];
}

// ============ 套餐定义（模仿 Trae / 豆包的定价结构） ============

const PLANS: Plan[] = [
  {
    id: "free",
    name: "免费版",
    price: 0,
    priceYearly: 0,
    desc: "适合个人轻度使用，体验核心 AI 能力",
    features: [
      "每月 50k Token 额度",
      "基础 AI 助理对话",
      "灵感收件箱（上限 100 条）",
      "决策看板（上限 50 任务）",
      "社区支持",
    ],
    tokenLimit: 50_000,
    cta: "开始使用",
  },
  {
    id: "pro",
    name: "Pro 专业版",
    price: 39,
    priceYearly: 388,
    badge: "热门",
    highlight: true,
    desc: "适合重度创作者与开发者，解锁全部高级功能",
    features: [
      "每月 2M Token 额度",
      "全部 AI 助理功能（含 Function Calling）",
      "无限灵感收件箱",
      "AI 工作流（含 Lynx Agent 节点）",
      "记忆图谱 + 语义搜索",
      "技能市场 + 自定义技能",
      "邮件支持（24h 响应）",
    ],
    tokenLimit: 2_000_000,
    cta: "升级到 Pro",
  },
  {
    id: "team",
    name: "团队版",
    price: 129,
    priceYearly: 1288,
    desc: "适合团队协作，多席位 + 集中管理",
    features: [
      "每月 10M Token 额度（共享）",
      "包含 Pro 全部功能",
      "最多 10 个席位",
      "团队共享认知库与技能",
      "角色权限管理（RBAC）",
      "飞书任务双向同步",
      "专属客户成功经理",
    ],
    tokenLimit: 10_000_000,
    cta: "升级到团队版",
  },
];

const PLAN_LABEL: Record<PlanId, string> = {
  free: "免费版",
  pro: "Pro 专业版",
  team: "团队版",
};

const STATUS_LABEL: Record<BillRecord["status"], string> = {
  paid: "已支付",
  pending: "待支付",
  refunded: "已退款",
};

// ============ 工具函数 ============

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 模拟订阅数据（暂未对接后端计费系统，使用本地模拟数据） */
function getMockData(): SubscriptionData {
  const now = new Date();
  const expires = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return {
    current: {
      plan: "pro",
      status: "active",
      startedAt: new Date(now.getFullYear(), now.getMonth() - 2, 15).toISOString(),
      expiresAt: expires.toISOString(),
      usedTokens: 1_245_680,
      limitTokens: 2_000_000,
      willRenew: true,
    },
    bills: [
      {
        id: "bill-2026-06",
        period: "2026-06",
        plan: "pro",
        amount: 39,
        status: "paid",
        paidAt: "2026-06-01T00:00:00.000Z",
        invoiceUrl: null,
      },
      {
        id: "bill-2026-05",
        period: "2026-05",
        plan: "pro",
        amount: 39,
        status: "paid",
        paidAt: "2026-05-01T00:00:00.000Z",
        invoiceUrl: null,
      },
      {
        id: "bill-2026-04",
        period: "2026-04",
        plan: "free",
        amount: 0,
        status: "paid",
        paidAt: "2026-04-01T00:00:00.000Z",
        invoiceUrl: null,
      },
    ],
  };
}

// ============ 主组件 ============

export default function SubscriptionPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [switching, setSwitching] = useState<PlanId | null>(null);

  useEffect(() => {
    // 模拟异步加载
    const t = setTimeout(() => {
      setData(getMockData());
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const handleSwitchPlan = (plan: PlanId) => {
    if (!data || data.current.plan === plan) return;
    setSwitching(plan);
    // 模拟切换套餐
    setTimeout(() => {
      const newPlan = PLANS.find((p) => p.id === plan)!;
      setData({
        ...data,
        current: {
          ...data.current,
          plan,
          limitTokens: newPlan.tokenLimit,
          usedTokens: plan === "free" ? Math.min(data.current.usedTokens, newPlan.tokenLimit) : data.current.usedTokens,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      setSwitching(null);
      toast(`已切换到 ${PLAN_LABEL[plan]}`, "success");
    }, 800);
  };

  const handleExportBills = () => {
    if (!data) return;
    const rows = [
      ["账单周期", "套餐", "金额(元)", "状态", "支付时间"],
      ...data.bills.map((b) => [
        b.period,
        PLAN_LABEL[b.plan],
        String(b.amount),
        STATUS_LABEL[b.status],
        formatDate(b.paidAt),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lynnhub-bills-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("账单已导出", "success");
  };

  const usagePercent = useMemo(() => {
    if (!data) return 0;
    return Math.min(100, (data.current.usedTokens / data.current.limitTokens) * 100);
  }, [data]);

  if (loading) return <LoadingState title="订阅与账单" />;
  if (!data) return <div className="p-8"><PageHeader title="订阅与账单" subtitle="加载失败" /></div>;

  const currentPlan = PLANS.find((p) => p.id === data.current.plan)!;

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="订阅与账单"
        subtitle="管理你的套餐、查看用量与账单记录"
        action={<HelpButton contentKey="subscription" />}
      />

      {/* ============ 当前套餐卡片 ============ */}
      <Card className="mb-6 overflow-hidden !p-0">
        <div className="relative bg-gradient-to-br from-northstar/20 via-cognition/10 to-transparent p-6">
          <div className="absolute right-4 top-4">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
              data.current.status === "active"
                ? "bg-task/15 text-task"
                : "bg-graveyard/15 text-graveyard"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                data.current.status === "active" ? "bg-task" : "bg-graveyard"
              }`} />
              {data.current.status === "active" ? "生效中" : "已过期"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crown className="h-4 w-4 text-northstar" />
            当前套餐
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <h2 className="text-3xl font-bold text-foreground">{currentPlan.name}</h2>
            <span className="text-sm text-muted-foreground">
              ¥{billingCycle === "monthly" ? currentPlan.price : currentPlan.priceYearly}
              <span className="text-xs">/{billingCycle === "monthly" ? "月" : "年"}</span>
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">到期时间</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(data.current.expiresAt)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">续费状态</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <CreditCard className="h-3.5 w-3.5" />
                {data.current.willRenew ? "自动续费" : "手动续费"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">本月用量</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                {formatTokens(data.current.usedTokens)} / {formatTokens(data.current.limitTokens)}
              </div>
            </div>
          </div>

          {/* 用量进度条 */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Token 使用进度</span>
              <span className={`font-medium ${
                usagePercent > 90 ? "text-graveyard" : usagePercent > 70 ? "text-campaign" : "text-task"
              }`}>
                {usagePercent.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-background/50">
              <div
                className={`h-full transition-all duration-500 ${
                  usagePercent > 90
                    ? "bg-graveyard"
                    : usagePercent > 70
                      ? "bg-campaign"
                      : "bg-task"
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ============ 套餐对比 ============ */}
      <div className="mb-6">
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-semibold text-foreground">选择套餐</h3>
            <p className="text-xs text-muted-foreground">根据使用量随时升级或降级，立即生效</p>
          </div>
          {/* 月付/年付切换 */}
          <div className="glass-card inline-flex gap-1 rounded-xl p-1">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              按月
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                billingCycle === "yearly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              按年 <span className="text-[10px] text-task">省 17%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = data.current.plan === plan.id;
            const isHighlighted = plan.highlight;
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  isHighlighted ? "border-northstar/40 ring-1 ring-northstar/30" : ""
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-northstar px-3 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                    {plan.badge}
                  </span>
                )}

                <div className="mb-3 flex items-center gap-2">
                  {plan.id === "free" && <Sparkles className="h-4 w-4 text-muted-foreground" />}
                  {plan.id === "pro" && <Zap className="h-4 w-4 text-northstar" />}
                  {plan.id === "team" && <Users className="h-4 w-4 text-cognition" />}
                  <h4 className="text-base font-semibold text-foreground">{plan.name}</h4>
                </div>

                <p className="mb-3 text-xs text-muted-foreground">{plan.desc}</p>

                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">
                    ¥{billingCycle === "monthly" ? plan.price : plan.priceYearly}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{billingCycle === "monthly" ? "月" : "年"}
                  </span>
                </div>

                <ul className="mb-5 flex-1 space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-task" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isCurrent ? "outline" : isHighlighted ? "primary" : "secondary"}
                  disabled={isCurrent || switching !== null}
                  onClick={() => handleSwitchPlan(plan.id)}
                  className="w-full"
                >
                  {switching === plan.id ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 切换中...</>
                  ) : isCurrent ? (
                    "当前套餐"
                  ) : (
                    plan.cta
                  )}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ============ 账单历史 ============ */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-cognition" />
            <h3 className="text-base font-semibold text-foreground">账单历史</h3>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportBills} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            导出账单
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground">
                <th className="py-2 pr-3 font-medium">账单周期</th>
                <th className="py-2 pr-3 font-medium">套餐</th>
                <th className="py-2 pr-3 font-medium">金额</th>
                <th className="py-2 pr-3 font-medium">状态</th>
                <th className="py-2 pr-3 font-medium">支付时间</th>
                <th className="py-2 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.bills.map((bill) => (
                <tr key={bill.id} className="border-b border-border/20 last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-foreground">{bill.period}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{PLAN_LABEL[bill.plan]}</td>
                  <td className="py-2.5 pr-3 text-foreground">
                    {bill.amount === 0 ? "免费" : `¥${bill.amount}`}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      bill.status === "paid"
                        ? "bg-task/10 text-task"
                        : bill.status === "pending"
                          ? "bg-campaign/10 text-campaign"
                          : "bg-graveyard/10 text-graveyard"
                    }`}>
                      {STATUS_LABEL[bill.status]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{formatDate(bill.paidAt)}</td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => toast("发票下载功能即将上线", "info")}
                      className="text-[11px] text-cognition hover:underline disabled:opacity-50"
                      disabled={bill.amount === 0}
                    >
                      下载发票
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-[11px] text-muted-foreground">
          如对账单有疑问，请在帮助中心联系支持。
        </div>
      </Card>
    </div>
  );
}

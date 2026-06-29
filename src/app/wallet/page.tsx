"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Wallet as WalletIcon,
  Coins,
  Snowflake,
  Crown,
  TrendingUp,
  TrendingDown,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Lock,
  Unlock,
  RotateCcw,
} from "lucide-react";
import { PageHeader, Card, Button, LoadingState, Badge } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";

// ============ 类型定义 ============

interface WalletData {
  credits: string; // BigInt 序列化为字符串
  sCoins: number;
  frozenCredits: string;
  availableCredits: string;
  membership: {
    tier: string;
    name: string;
    features: string[];
  };
}

interface CreditTx {
  id: string;
  type: string; // earn | spend | freeze | unfreeze | refund
  amount: string; // BigInt 序列化为字符串
  balanceAfter: string;
  reason: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface SCoinTx {
  id: string;
  type: string; // earn | spend
  amount: number;
  balanceAfter: number;
  reason: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface TxPage<T> {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

type CurrencyTab = "credits" | "scoins";

// ============ 工具函数 ============

const YI = 100_000_000; // 1亿

/** 格式化 Credits（BigInt 字符串）：超过 1 亿用「亿」为单位 */
function formatCredits(creditStr: string): string {
  try {
    const n = BigInt(creditStr);
    if (n >= BigInt(YI)) {
      const yi = Number(n) / YI;
      // 整数亿直接显示，否则保留 2 位小数
      const rounded = Math.round(yi * 100) / 100;
      return Number.isInteger(rounded) ? `${rounded}亿` : `${rounded.toFixed(2)}亿`;
    }
    return Number(n).toLocaleString();
  } catch {
    return creditStr;
  }
}

/** 格式化 Credits 带单位（用于卡片大字） */
function formatCreditsDisplay(creditStr: string): { value: string; unit: string } {
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

/** 格式化时间：YYYY-MM-DD HH:mm */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 流水类型映射 */
const TX_TYPE_MAP: Record<string, { label: string; color: "task" | "graveyard" | "cognition" | "campaign" | "northstar"; icon: typeof TrendingUp }> = {
  earn: { label: "收入", color: "task", icon: ArrowDownCircle },
  spend: { label: "支出", color: "graveyard", icon: ArrowUpCircle },
  freeze: { label: "冻结", color: "cognition", icon: Lock },
  unfreeze: { label: "解冻", color: "campaign", icon: Unlock },
  refund: { label: "退款", color: "northstar", icon: RotateCcw },
};

/** 原因映射（中文化） */
const REASON_MAP: Record<string, string> = {
  ai_chat: "AI 对话",
  buy_membership: "购买会员",
  membership_gift: "会员赠送",
  sign_in: "签到",
  task_reward: "任务奖励",
  recharge: "充值",
  admin_adjust: "管理员调整",
  buy_token_pack: "购买词元包",
  buy_skill: "购买技能",
  buy_knowledge: "购买知识",
  buy_flow: "购买工作流",
  sell_skill: "出售技能",
  tip: "打赏",
  membership_offset: "会员抵扣",
};

function getReasonLabel(reason: string): string {
  return REASON_MAP[reason] || reason;
}

// ============ 会员档位徽章颜色 ============

const TIER_BADGE_COLOR: Record<string, "default" | "northstar" | "campaign" | "task" | "cognition"> = {
  FREE: "default",
  LITE: "cognition",
  PRO: "campaign",
  MAX: "northstar",
  ULTRA: "task",
};

// ============ 主组件 ============

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CurrencyTab>("credits");

  // Credits 流水
  const [creditTxs, setCreditTxs] = useState<CreditTx[]>([]);
  const [creditCursor, setCreditCursor] = useState<string | null>(null);
  const [creditHasMore, setCreditHasMore] = useState(false);
  const [creditLoading, setCreditLoading] = useState(false);

  // S币 流水
  const [scoinTxs, setScoinTxs] = useState<SCoinTx[]>([]);
  const [scoinCursor, setScoinCursor] = useState<string | null>(null);
  const [scoinHasMore, setScoinHasMore] = useState(false);
  const [scoinLoading, setScoinLoading] = useState(false);

  // 是否已加载过对应币种的流水（避免切换 tab 重复请求）
  const loadedRef = useRef<Set<CurrencyTab>>(new Set());

  // 加载钱包余额
  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet");
      if (!res.ok) throw new Error("加载失败");
      const json = await res.json();
      setWallet(json.data);
    } catch {
      toast("加载钱包失败", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载 Credits 流水
  const loadCreditTxs = useCallback(
    async (cursor?: string | null) => {
      setCreditLoading(true);
      try {
        const params = new URLSearchParams({
          currency: "credits",
          limit: "50",
        });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/wallet/transactions?${params}`);
        if (!res.ok) throw new Error("加载流水失败");
        const json = await res.json();
        const page: TxPage<CreditTx> = json.data;
        setCreditTxs((prev) => (cursor ? [...prev, ...page.data] : page.data));
        setCreditCursor(page.nextCursor);
        setCreditHasMore(page.hasMore);
        loadedRef.current.add("credits");
      } catch {
        toast("加载 Credits 流水失败", "error");
      } finally {
        setCreditLoading(false);
      }
    },
    []
  );

  // 加载 S币 流水
  const loadSCoinTxs = useCallback(
    async (cursor?: string | null) => {
      setScoinLoading(true);
      try {
        const params = new URLSearchParams({
          currency: "scoins",
          limit: "50",
        });
        if (cursor) params.set("cursor", cursor);
        const res = await fetch(`/api/wallet/transactions?${params}`);
        if (!res.ok) throw new Error("加载流水失败");
        const json = await res.json();
        const page: TxPage<SCoinTx> = json.data;
        setScoinTxs((prev) => (cursor ? [...prev, ...page.data] : page.data));
        setScoinCursor(page.nextCursor);
        setScoinHasMore(page.hasMore);
        loadedRef.current.add("scoins");
      } catch {
        toast("加载 S币 流水失败", "error");
      } finally {
        setScoinLoading(false);
      }
    },
    []
  );

  // 初次挂载：加载余额 + Credits 流水
  useEffect(() => {
    loadWallet();
    loadCreditTxs();
  }, [loadWallet, loadCreditTxs]);

  // 切换 Tab：按需加载 S币 流水
  const handleTabChange = (tab: CurrencyTab) => {
    setActiveTab(tab);
    if (tab === "scoins" && !loadedRef.current.has("scoins")) {
      loadSCoinTxs();
    }
  };

  // 刷新
  const handleRefresh = () => {
    setLoading(true);
    loadedRef.current.clear();
    setCreditTxs([]);
    setScoinTxs([]);
    setCreditCursor(null);
    setScoinCursor(null);
    loadWallet();
    loadCreditTxs();
    if (activeTab === "scoins") loadSCoinTxs();
  };

  if (loading) {
    return <LoadingState title="钱包" />;
  }

  if (!wallet) {
    return (
      <div className="p-4 sm:p-8">
        <PageHeader title="钱包" subtitle="加载失败" />
      </div>
    );
  }

  const creditsDisplay = formatCreditsDisplay(wallet.credits);
  const frozenDisplay = formatCreditsDisplay(wallet.frozenCredits);
  const availableDisplay = formatCreditsDisplay(wallet.availableCredits);

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="钱包"
        subtitle="Credits · S币 余额与交易流水"
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">刷新</span>
            </Button>
            <HelpButton contentKey="wallet" />
          </div>
        }
      />

      {/* ============ 顶部余额卡片 ============ */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Credits 卡片 */}
        <Card className="relative overflow-hidden">
          {/* 背景装饰：星空蓝渐变 */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-northstar/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-cognition/10 blur-3xl" />

          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-northstar/15">
                  <Coins className="h-5 w-5 text-northstar" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">Credits 余额</div>
                  <div className="text-[11px] text-muted-foreground">AI 对话与词元消耗</div>
                </div>
              </div>
              {wallet.membership?.tier && (
                <Link href="/membership">
                  <Badge color={TIER_BADGE_COLOR[wallet.membership.tier] || "default"}>
                    <Crown className="mr-1 h-3 w-3" />
                    {wallet.membership.name}
                  </Badge>
                </Link>
              )}
            </div>

            <div className="mb-4 flex items-baseline gap-2">
              <span className="bg-gradient-to-r from-northstar to-cognition bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
                {creditsDisplay.value}
              </span>
              {creditsDisplay.unit && (
                <span className="text-xl font-semibold text-northstar">{creditsDisplay.unit}</span>
              )}
              <span className="ml-1 text-xs text-muted-foreground">Credits</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="ios-glass-sm rounded-xl px-3 py-2">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <WalletIcon className="h-3 w-3" />
                  可用余额
                </div>
                <div className="mt-0.5 text-sm font-semibold text-foreground">
                  {availableDisplay.value}
                  {availableDisplay.unit && (
                    <span className="ml-0.5 text-xs text-muted-foreground">{availableDisplay.unit}</span>
                  )}
                </div>
              </div>
              <div className="ios-glass-sm rounded-xl px-3 py-2">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Snowflake className="h-3 w-3" />
                  冻结中
                </div>
                <div className="mt-0.5 text-sm font-semibold text-cognition">
                  {frozenDisplay.value}
                  {frozenDisplay.unit && (
                    <span className="ml-0.5 text-xs text-muted-foreground">{frozenDisplay.unit}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* S币 卡片 */}
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-campaign/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-northstar/10 blur-3xl" />

          <div className="relative">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-campaign/15">
                  <Coins className="h-5 w-5 text-campaign" />
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">S币 余额</div>
                  <div className="text-[11px] text-muted-foreground">可抵扣会员现金</div>
                </div>
              </div>
              <Link href="/membership">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Crown className="h-3 w-3" />
                  充值会员
                </Button>
              </Link>
            </div>

            <div className="mb-4 flex items-baseline gap-2">
              <span className="bg-gradient-to-r from-campaign to-northstar bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
                {wallet.sCoins.toLocaleString()}
              </span>
              <span className="ml-1 text-xs text-muted-foreground">S币</span>
            </div>

            <div className="ios-glass-sm rounded-xl px-3 py-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">汇率说明</span>
                <span className="font-medium text-foreground/80">1 元 = 50 S币</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">当前可抵扣</span>
                <span className="font-medium text-campaign">
                  ¥{(wallet.sCoins / 50).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ============ 交易流水 ============ */}
      <Card>
        {/* Tab 切换 */}
        <div className="mb-4 flex items-center justify-between">
          <div className="glass-card flex gap-1 overflow-x-auto rounded-2xl p-1.5">
            {(
              [
                { key: "credits" as const, label: "Credits 流水", icon: Coins },
                { key: "scoins" as const, label: "S币 流水", icon: Coins },
              ]
            ).map((tab) => {
              const active = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Credits 流水列表 */}
        {activeTab === "credits" && (
          <CreditTxList
            txs={creditTxs}
            loading={creditLoading}
            hasMore={creditHasMore}
            onLoadMore={() => loadCreditTxs(creditCursor)}
          />
        )}

        {/* S币 流水列表 */}
        {activeTab === "scoins" && (
          <SCoinTxList
            txs={scoinTxs}
            loading={scoinLoading}
            hasMore={scoinHasMore}
            onLoadMore={() => loadSCoinTxs(scoinCursor)}
          />
        )}
      </Card>
    </div>
  );
}

// ============ Credits 流水列表 ============

function CreditTxList({
  txs,
  loading,
  hasMore,
  onLoadMore,
}: {
  txs: CreditTx[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (loading && txs.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        加载中...
      </div>
    );
  }

  if (txs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
          <Coins className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-sm font-medium text-foreground">暂无 Credits 流水</div>
        <div className="text-xs text-muted-foreground">使用 AI 对话后会在此显示消耗记录</div>
      </div>
    );
  }

  return (
    <div>
      {/* 表头 */}
      <div className="mb-2 hidden grid-cols-12 gap-2 px-3 text-[11px] font-medium text-muted-foreground sm:grid">
        <div className="col-span-3">时间</div>
        <div className="col-span-2">类型</div>
        <div className="col-span-2 text-right">金额</div>
        <div className="col-span-2">原因</div>
        <div className="col-span-3">描述</div>
      </div>
      <div className="space-y-1">
        {txs.map((tx) => {
          const typeInfo = TX_TYPE_MAP[tx.type] || TX_TYPE_MAP.spend;
          const TypeIcon = typeInfo.icon;
          const isPositive = tx.type === "earn" || tx.type === "unfreeze" || tx.type === "refund";
          return (
            <div
              key={tx.id}
              className="ios-glass-sm grid grid-cols-12 items-center gap-2 rounded-xl px-3 py-2.5 text-xs transition-colors hover:bg-primary/5"
            >
              {/* 时间 */}
              <div className="col-span-12 text-[11px] text-muted-foreground sm:col-span-3">
                {formatTime(tx.createdAt)}
              </div>
              {/* 类型 */}
              <div className="col-span-3 sm:col-span-2">
                <Badge color={typeInfo.color}>
                  <TypeIcon className="mr-1 h-3 w-3" />
                  {typeInfo.label}
                </Badge>
              </div>
              {/* 金额 */}
              <div
                className={`col-span-9 text-right text-sm font-semibold sm:col-span-2 ${
                  isPositive ? "text-task" : "text-graveyard"
                }`}
              >
                {isPositive ? "+" : "-"}
                {formatCredits(tx.amount)}
                <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">Credits</span>
              </div>
              {/* 原因 */}
              <div className="col-span-6 text-foreground/80 sm:col-span-2">
                {getReasonLabel(tx.reason)}
              </div>
              {/* 描述 */}
              <div className="col-span-6 truncate text-muted-foreground sm:col-span-3" title={tx.description || ""}>
                {tx.description || "-"}
              </div>
            </div>
          );
        })}
      </div>

      {/* 加载更多 */}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading} className="gap-1.5">
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                加载中...
              </>
            ) : (
              <>
                <TrendingDown className="h-3.5 w-3.5" />
                加载更多
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============ S币 流水列表 ============

function SCoinTxList({
  txs,
  loading,
  hasMore,
  onLoadMore,
}: {
  txs: SCoinTx[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (loading && txs.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        加载中...
      </div>
    );
  }

  if (txs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
          <Coins className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-sm font-medium text-foreground">暂无 S币 流水</div>
        <div className="text-xs text-muted-foreground">购买会员或签到获得 S币后会在此显示</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 hidden grid-cols-12 gap-2 px-3 text-[11px] font-medium text-muted-foreground sm:grid">
        <div className="col-span-3">时间</div>
        <div className="col-span-2">类型</div>
        <div className="col-span-2 text-right">金额</div>
        <div className="col-span-2">原因</div>
        <div className="col-span-3">描述</div>
      </div>
      <div className="space-y-1">
        {txs.map((tx) => {
          const typeInfo = TX_TYPE_MAP[tx.type] || TX_TYPE_MAP.spend;
          const TypeIcon = typeInfo.icon;
          const isPositive = tx.type === "earn";
          return (
            <div
              key={tx.id}
              className="ios-glass-sm grid grid-cols-12 items-center gap-2 rounded-xl px-3 py-2.5 text-xs transition-colors hover:bg-primary/5"
            >
              <div className="col-span-12 text-[11px] text-muted-foreground sm:col-span-3">
                {formatTime(tx.createdAt)}
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Badge color={typeInfo.color}>
                  <TypeIcon className="mr-1 h-3 w-3" />
                  {typeInfo.label}
                </Badge>
              </div>
              <div
                className={`col-span-9 text-right text-sm font-semibold sm:col-span-2 ${
                  isPositive ? "text-task" : "text-graveyard"
                }`}
              >
                {isPositive ? "+" : "-"}
                {tx.amount.toLocaleString()}
                <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">S币</span>
              </div>
              <div className="col-span-6 text-foreground/80 sm:col-span-2">
                {getReasonLabel(tx.reason)}
              </div>
              <div className="col-span-6 truncate text-muted-foreground sm:col-span-3" title={tx.description || ""}>
                {tx.description || "-"}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading} className="gap-1.5">
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                加载中...
              </>
            ) : (
              <>
                <TrendingDown className="h-3.5 w-3.5" />
                加载更多
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

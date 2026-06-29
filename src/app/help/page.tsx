"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Rocket,
  CreditCard,
  Sparkles,
  Wrench,
  ChevronDown,
  BookOpen,
  MessageSquare,
  Users,
  ArrowRight,
} from "lucide-react";
import { PageHeader, Card } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";

// ============ 类型定义 ============

type Category = "getting-started" | "billing" | "features" | "troubleshooting";

interface FAQItem {
  id: string;
  category: Category;
  question: string;
  answer: string;
  docLink?: { label: string; href: string };
}

interface QuickEntry {
  category: Category;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

// ============ 分类配置 ============

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "getting-started", label: "开始使用", icon: <Rocket className="h-4 w-4" />, color: "text-northstar" },
  { id: "billing", label: "账户与计费", icon: <CreditCard className="h-4 w-4" />, color: "text-cognition" },
  { id: "features", label: "功能使用", icon: <Sparkles className="h-4 w-4" />, color: "text-task" },
  { id: "troubleshooting", label: "故障排查", icon: <Wrench className="h-4 w-4" />, color: "text-campaign" },
];

const QUICK_ENTRIES: QuickEntry[] = [
  {
    category: "getting-started",
    label: "开始使用",
    desc: "快速了解 LynxHub 核心概念",
    icon: <Rocket className="h-5 w-5" />,
    color: "text-northstar",
  },
  {
    category: "billing",
    label: "账户与计费",
    desc: "套餐、账单与 Token 用量",
    icon: <CreditCard className="h-5 w-5" />,
    color: "text-cognition",
  },
  {
    category: "features",
    label: "功能使用",
    desc: "AI 助理 / 工作流 / 技能",
    icon: <Sparkles className="h-5 w-5" />,
    color: "text-task",
  },
  {
    category: "troubleshooting",
    label: "故障排查",
    desc: "常见问题与解决方案",
    icon: <Wrench className="h-5 w-5" />,
    color: "text-campaign",
  },
];

// ============ FAQ 数据（模仿 Trae / 豆包帮助中心结构） ============

const FAQS: FAQItem[] = [
  // 开始使用
  {
    id: "gs-1",
    category: "getting-started",
    question: "LynxHub 是什么？适合什么样的用户？",
    answer:
      "LynxHub 是一个 AI 驱动的个人工作台，整合灵感收件箱、决策看板、记忆图谱、认知库、AI 助理、AI 工作流等模块。适合创作者、开发者、产品经理等需要管理灵感、决策和知识沉淀的用户。",
    docLink: { label: "查看产品介绍", href: "/inbox" },
  },
  {
    id: "gs-2",
    category: "getting-started",
    question: "如何快速上手第一步？",
    answer:
      "按 Ctrl + J（Mac: Cmd + J）唤起闪电输入，写下你脑海中任何想法，系统会自动分类到收件箱。然后访问决策看板把重要灵感流转为任务。",
    docLink: { label: "查看 Inbox 使用说明", href: "/inbox" },
  },
  {
    id: "gs-3",
    category: "getting-started",
    question: "如何配置 AI 模型？",
    answer:
      "前往「设置 → AI 模型」选项卡，支持 DeepSeek、MiMo、Embedding 三种 Provider。点击对应卡片填写 API Key 后保存，重启 dev server 生效。也可直接编辑 .env 文件。",
    docLink: { label: "打开设置页", href: "/settings" },
  },
  {
    id: "gs-4",
    category: "getting-started",
    question: "支持哪些 AI Provider？",
    answer:
      "国内推荐方案 B：硅基流动（兼容 OpenAI 接口）。也支持 OpenAI 官方、DeepSeek、MiMo 等。Embedding 推荐使用 BAAI/bge-m3 模型以启用语义搜索。",
  },

  // 账户与计费
  {
    id: "bl-1",
    category: "billing",
    question: "Token 是什么？怎么计费？",
    answer:
      "Token 是 AI 模型处理文本的最小单位，约 1 个汉字 ≈ 1.5 Token，1 个英文单词 ≈ 1 Token。每次 AI 对话、提取、工作流执行都会消耗 Token。可在「词元统计」页查看用量明细。",
    docLink: { label: "查看词元统计", href: "/admin/token-stats" },
  },
  {
    id: "bl-2",
    category: "billing",
    question: "不同套餐的 Token 额度有什么区别？",
    answer:
      "免费版每月 50k Token（适合轻度体验），Pro 专业版每月 2M Token（适合重度创作者），团队版每月 10M Token 且支持 10 席位共享。可在订阅与账单页升级或降级套餐。",
    docLink: { label: "查看订阅与账单", href: "/subscription" },
  },
  {
    id: "bl-3",
    category: "billing",
    question: "如何导出账单记录？",
    answer:
      "前往「订阅与账单」页底部「账单历史」区，点击「导出账单」按钮，系统会将所有账单明细导出为 CSV 文件（含账单周期、套餐、金额、状态、支付时间）。",
    docLink: { label: "打开订阅与账单", href: "/subscription" },
  },
  {
    id: "bl-4",
    category: "billing",
    question: "Token 用完了怎么办？",
    answer:
      "当月 Token 用完后 AI 功能将暂停，下月 1 号自动恢复。也可立即升级到更高套餐获取更多额度，升级后立即生效。",
    docLink: { label: "升级套餐", href: "/subscription" },
  },

  // 功能使用
  {
    id: "ft-1",
    category: "features",
    question: "AI 助理能做什么？",
    answer:
      "AI 助理支持 Function Calling，能调用 21 个工具覆盖灵感/看板/记忆/认知/技能/工作流/巡检/通知/Lynx Agent 全功能。直接用自然语言对话即可完成创建、搜索、执行等操作。",
    docLink: { label: "打开 AI 助理", href: "/ai-assistant" },
  },
  {
    id: "ft-2",
    category: "features",
    question: "AI 工作流是什么？",
    answer:
      "AI 工作流是可视化编排画布，支持拖拽节点、连线分支、配置参数。提供 9 种节点类型（触发器、AI 任务、条件分支、输出、Lynx Agent、HTTP、数据库、转换、延时），一次编排反复执行。",
    docLink: { label: "打开 AI 工作流", href: "/ai-workflow" },
  },
  {
    id: "ft-3",
    category: "features",
    question: "Lynx Agent 如何使用？",
    answer:
      "Lynx Agent 是基于 Hermes Agent 定制的本地 AI 代理，能直接操控你的电脑。前往「设置 → Lynx Agent」一键安装，配置模型后启动服务。可在 AI 助理或工作流中调用。",
    docLink: { label: "查看 Lynx Agent 说明", href: "/settings" },
  },
  {
    id: "ft-4",
    category: "features",
    question: "记忆图谱和认知库有什么区别？",
    answer:
      "记忆图谱是 3D 力导向图，可视化展示知识节点和关联，支持语义搜索。认知库是结构化分类（方法论/经验/提示词）的认知条目列表，由 AI 自动从对话中提取。两者互补。",
    docLink: { label: "打开记忆图谱", href: "/memory" },
  },
  {
    id: "ft-5",
    category: "features",
    question: "如何使用闪电输入？",
    answer:
      "按 Ctrl + J（Mac: Cmd + J）在任何页面唤起闪电输入框，写下灵感后回车保存。系统会自动分类到收件箱，之后可流转到看板或送入墓地。",
    docLink: { label: "打开 Inbox", href: "/inbox" },
  },

  // 故障排查
  {
    id: "ts-1",
    category: "troubleshooting",
    question: "AI 功能无响应怎么办？",
    answer:
      "1) 检查「设置 → AI 模型」中 API Key 是否已配置；2) 查看「词元统计」是否已用完额度；3) 查看「设置 → 系统状态」数据库是否连接；4) 重启 dev server 后再试。",
    docLink: { label: "打开设置页", href: "/settings" },
  },
  {
    id: "ts-2",
    category: "troubleshooting",
    question: "Lynx Agent 启动失败？",
    answer:
      "1) 确保已点击「一键安装 AI 环境」；2) 安装后点击「一键配置模型」复用 Lynx 的 API Key；3) 检查端口 9119 是否被占用；4) 查看「设置 → Lynx Agent」中的错误日志。",
    docLink: { label: "打开 Lynx Agent 设置", href: "/settings" },
  },
  {
    id: "ts-3",
    category: "troubleshooting",
    question: "记忆图谱语义搜索不工作？",
    answer:
      "语义搜索依赖 Embedding 模型。前往「设置 → AI 模型」检查 Embedding 是否已配置。未配置时会降级为 TF-IDF 关键词匹配（可用但精度较低）。",
    docLink: { label: "配置 Embedding", href: "/settings" },
  },
  {
    id: "ts-4",
    category: "troubleshooting",
    question: "飞书通知收不到？",
    answer:
      "1) 检查飞书机器人 Webhook URL 是否正确；2) 如启用了签名校验，确认 Token 配置正确；3) 点击「发送测试消息」验证连通性；4) 确认巡检规则已启用且触发了通知。",
    docLink: { label: "配置飞书机器人", href: "/admin/lark-bot" },
  },
  {
    id: "ts-5",
    category: "troubleshooting",
    question: "页面加载很慢？",
    answer:
      "1) 清理浏览器缓存后重试；2) 检查网络连接；3) 查看「性能监控」页的 API 响应时间是否异常；4) 若数据库记录数过多，可清理测试数据。",
    docLink: { label: "查看性能监控", href: "/admin/diagnostics" },
  },
];

// ============ 主组件 ============

export default function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 过滤 FAQ
  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      const matchCategory = activeCategory === "all" || f.category === activeCategory;
      if (!matchCategory) return false;
      if (!q) return true;
      return (
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  // 按分类分组
  const groupedFaqs = useMemo(() => {
    const groups: Record<Category, FAQItem[]> = {
      "getting-started": [],
      billing: [],
      features: [],
      troubleshooting: [],
    };
    for (const f of filteredFaqs) {
      groups[f.category].push(f);
    }
    return groups;
  }, [filteredFaqs]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleQuickEntryClick = (cat: Category) => {
    setActiveCategory(cat);
    setQuery("");
    // 滚动到问题列表
    setTimeout(() => {
      document.getElementById("faq-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="帮助中心"
        subtitle="查找使用教程、常见问题与故障排查指南"
        action={<HelpButton contentKey="help-center" />}
      />

      {/* ============ 搜索框 ============ */}
      <div className="mb-6">
        <div className="glass-card relative flex items-center rounded-2xl px-4 py-3">
          <Search className="mr-2.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索问题，如：如何配置 AI 模型、Token 怎么计费..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="ml-2 text-xs text-muted-foreground hover:text-foreground"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* ============ 四大快捷入口 ============ */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ENTRIES.map((entry) => (
          <Card
            key={entry.category}
            hover
            onClick={() => handleQuickEntryClick(entry.category)}
            className="!p-4"
          >
            <div className={`mb-2 ${entry.color}`}>{entry.icon}</div>
            <div className="text-sm font-semibold text-foreground">{entry.label}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{entry.desc}</div>
            <div className="mt-3 flex items-center gap-1 text-[11px] text-cognition">
              浏览 <ArrowRight className="h-3 w-3" />
            </div>
          </Card>
        ))}
      </div>

      {/* ============ 分类筛选 ============ */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            activeCategory === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "ios-glass-sm text-muted-foreground hover:text-foreground"
          }`}
        >
          全部
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "ios-glass-sm text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          共 {filteredFaqs.length} 个问题
        </span>
      </div>

      {/* ============ FAQ 列表（按分类分组） ============ */}
      <div id="faq-list" className="space-y-6">
        {filteredFaqs.length === 0 ? (
          <Card className="py-12 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <div className="text-sm font-medium text-foreground">未找到相关问题</div>
            <div className="mt-1 text-xs text-muted-foreground">
              试试换个关键词，或在下方「联系支持」提交你的问题
            </div>
          </Card>
        ) : (
          CATEGORIES.filter((c) => activeCategory === "all" || c.id === activeCategory).map((cat) => {
            const items = groupedFaqs[cat.id];
            if (items.length === 0) return null;
            return (
              <div key={cat.id}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={cat.color}>{cat.icon}</span>
                  <h3 className="text-sm font-semibold text-foreground">{cat.label}</h3>
                  <span className="text-[11px] text-muted-foreground">· {items.length} 个问题</span>
                </div>
                <div className="space-y-2">
                  {items.map((faq) => {
                    const expanded = expandedIds.has(faq.id);
                    return (
                      <Card key={faq.id} className="!p-0">
                        <button
                          onClick={() => toggleExpand(faq.id)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                          <span className="text-sm font-medium text-foreground">{faq.question}</span>
                          <ChevronDown
                            className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
                              expanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {expanded && (
                          <div className="border-t border-border/30 px-4 py-3">
                            <p className="text-xs leading-relaxed text-muted-foreground">{faq.answer}</p>
                            {faq.docLink && (
                              <a
                                href={faq.docLink.href}
                                className="mt-3 inline-flex items-center gap-1 text-xs text-cognition hover:underline"
                              >
                                <BookOpen className="h-3 w-3" />
                                {faq.docLink.label}
                                <ArrowRight className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ============ 联系支持 ============ */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="!p-5">
          <div className="mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-cognition" />
            <h4 className="text-sm font-semibold text-foreground">提交反馈</h4>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            遇到问题或有改进建议？提交反馈，我们会尽快处理。
          </p>
          <button
            onClick={() => (window.location.href = "mailto:support@lynxdo.com?subject=Lynx 用户反馈")}
            className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white"
          >
            发送邮件
            <ArrowRight className="h-3 w-3" />
          </button>
        </Card>

        <Card className="!p-5">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-northstar" />
            <h4 className="text-sm font-semibold text-foreground">加入用户群</h4>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            加入 LynxHub 用户交流群，与开发者和其他用户实时互动。
          </p>
          <button
            onClick={() => (window.location.href = "https://t.me/lynnhub")}
            className="btn-glass inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground"
          >
            加入 Telegram 群
            <ArrowRight className="h-3 w-3" />
          </button>
        </Card>
      </div>
    </div>
  );
}

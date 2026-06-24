"use client";

import { useEffect, useState } from "react";
import {
  Database,
  KeyRound,
  Brain,
  CheckCircle2,
  XCircle,
  FileText,
  Zap,
} from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";

type Settings = {
  db: {
    status: "connected" | "error";
    url: string;
    counts: Record<string, number>;
  };
  ai: {
    chatProvider: boolean;
    chatModel: string;
    chatBaseURL: string;
    embeddingEnabled: boolean;
    embeddingModel: string;
    embeddingMode: string;
  };
  envFilePath: string;
  envExamplePath: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/settings");
        if (!mounted) return;
        if (!res.ok) throw new Error("加载失败");
        const data = await res.json();
        setSettings(data);
        setLoading(false);
      } catch (e: any) {
        if (!mounted) return;
        console.error("Settings load failed:", e);
        toast("加载设置失败", "error");
        setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <LoadingState title="设置" />;
  }

  if (!settings) {
    return (
      <div className="p-4 sm:p-8">
        <PageHeader title="设置" subtitle="加载失败" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="设置"
        subtitle="系统配置状态 · 点击文件路径可直接打开编辑"
      />

      {/* 快捷键 */}
      <Section icon={<Zap className="h-4 w-4 text-northstar" />} title="快捷键">
        <Row label="闪电输入" value="Ctrl + J（Mac: Cmd + J）" ok />
        <Row
          label="说明"
          value="原 Ctrl+Space 在 Windows 被输入法占用，已改为 Ctrl+J"
        />
      </Section>

      {/* 数据库 */}
      <Section icon={<Database className="h-4 w-4 text-campaign" />} title="数据库">
        <Row
          label="状态"
          value={settings.db.status === "connected" ? "已连接" : "连接失败"}
          ok={settings.db.status === "connected"}
        />
        <Row label="连接地址" value={settings.db.url} />
        <Row
          label="数据量"
          value={`灵感 ${settings.db.counts.ideas || 0} · 任务 ${settings.db.counts.tasks || 0} · 对话 ${settings.db.counts.conversations || 0} · 认知 ${settings.db.counts.cognitions || 0} · 记忆 ${settings.db.counts.memories || 0}`}
        />
      </Section>

      {/* AI Provider */}
      <Section
        icon={<KeyRound className="h-4 w-4 text-cognition" />}
        title="AI Provider（对话提取 / 认知提取）"
      >
        <Row
          label="API Key"
          value={settings.ai.chatProvider ? "已配置" : "未配置（AI 提取功能不可用）"}
          ok={settings.ai.chatProvider}
        />
        <Row label="模型" value={settings.ai.chatModel} />
        <Row label="Base URL" value={settings.ai.chatBaseURL} />
        {!settings.ai.chatProvider && (
          <div className="mt-3 rounded-md border border-graveyard/30 bg-graveyard/5 p-3 text-xs text-graveyard">
            ⚠️ 未配置 LLM API Key（DEEPSEEK_API_KEY / MIMO_API_KEY / AI_API_KEY），对话资产和认知库的 AI 提取会跳过。
            <br />
            配置后重启 dev server 生效。
          </div>
        )}
      </Section>

      {/* Embedding */}
      <Section
        icon={<Brain className="h-4 w-4 text-task" />}
        title="记忆图谱 Embedding"
      >
        <Row
          label="状态"
          value={settings.ai.embeddingEnabled ? "AI 向量" : "TF-IDF 降级"}
          ok={settings.ai.embeddingEnabled}
        />
        <Row label="模型" value={settings.ai.embeddingModel} />
        <Row label="当前模式" value={settings.ai.embeddingMode} />
        {!settings.ai.embeddingEnabled && (
          <div className="mt-3 rounded-md border border-campaign/30 bg-campaign/5 p-3 text-xs text-campaign">
            ℹ️ 未配置 embedding，记忆图谱使用 TF-IDF 关键词匹配（可用但精度较低）。
            <br />
            配置 EMBEDDING_API_KEY 后启用向量搜索。
          </div>
        )}
      </Section>

      {/* 配置文件 */}
      <Section
        icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        title="配置文件（点击路径在 IDE 中打开）"
      >
        <FileLink
          path={settings.envFilePath}
          label=".env"
          desc="主配置文件，填入 API Key 后保存"
          absolutePath="d:/Lynn工作空间/LynnHub/.env"
        />
        <FileLink
          path={settings.envExamplePath}
          label=".env.example"
          desc="配置模板，含 4 种 Provider 方案说明"
          absolutePath="d:/Lynn工作空间/LynnHub/.env.example"
        />
      </Section>

      {/* 配置指引 */}
      <Section
        icon={<KeyRound className="h-4 w-4 text-northstar" />}
        title="快速配置指引"
      >
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <div className="mb-1 font-medium text-foreground">方案 B（国内推荐）：硅基流动</div>
            <pre className="overflow-x-auto rounded-md bg-muted/30 p-2 text-[11px]">
{`AI_BASE_URL=https://api.siliconflow.cn/v1
AI_API_KEY=sk-你的key
AI_MODEL=Qwen/Qwen2.5-7B-Instruct
AI_EMBEDDING_MODEL=BAAI/bge-m3`}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-medium text-foreground">方案 A：OpenAI 官方</div>
            <pre className="overflow-x-auto rounded-md bg-muted/30 p-2 text-[11px]">
{`AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-你的key
AI_MODEL=gpt-4o-mini
AI_EMBEDDING_MODEL=text-embedding-3-small`}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-medium text-foreground">方案 C：DeepSeek（无 embedding）</div>
            <pre className="overflow-x-auto rounded-md bg-muted/30 p-2 text-[11px]">
{`AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=sk-你的key
AI_MODEL=deepseek-chat`}
            </pre>
          </div>
          <div className="rounded-md bg-muted/20 p-2 text-[11px]">
            配置步骤：1. 点击上方 .env 打开 → 2. 粘贴方案 → 3. 填入 Key → 4. 保存 → 5. 重启 dev server（Ctrl+C 后 npm run dev）
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 text-foreground/80">{value}</span>
      {ok !== undefined &&
        (ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-task" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-graveyard" />
        ))}
    </div>
  );
}

function FileLink({
  path,
  label,
  desc,
  absolutePath,
}: {
  path: string;
  label: string;
  desc: string;
  absolutePath: string;
}) {
  return (
    <a
      href={`file:///${absolutePath.replace(/\\/g, "/")}`}
      className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3 text-xs transition-colors hover:border-northstar/50 hover:bg-muted/40"
    >
      <FileText className="h-4 w-4 shrink-0 text-northstar" />
      <div className="flex-1">
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      <code className="text-[10px] text-muted-foreground/70">{path}</code>
    </a>
  );
}

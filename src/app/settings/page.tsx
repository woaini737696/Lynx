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
  Loader2,
  Save,
} from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";

/** 单个字段的数据库配置状态 */
type FieldStatus = { configured: boolean; value: string };

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
  envSettings: Record<string, boolean>;
  dbSettings: Record<string, FieldStatus>;
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
        action={
          <HelpButton content={{
            painPoint: "AI模型配置散落在环境变量中，无法在界面修改。",
            need: "需要在设置页集中管理所有配置项。",
            solution: "设置页支持数据库存储AI Key，无需改.env即可切换Provider和模型。",
            usage: [
              "配置DeepSeek/MiMo/Embedding的API Key和模型",
              "选择默认Provider",
              "保存后立即生效无需重启",
              "已配置的Key显示为掩码格式"
            ]
          }} />
        }
      />

      {/* AI 模型配置（数据库存储，优先级高于环境变量） */}
      <AIConfigSection dbSettings={settings.dbSettings} envSettings={settings.envSettings} />

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

// ============ AI 模型配置区块 ============

/** Provider 配置表单字段 */
type ProviderForm = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

/** 单个 Provider 卡片的字段定义 */
type ProviderFields = {
  key: "deepseek" | "mimo" | "embedding";
  title: string;
  desc: string;
  defaultBaseUrl: string;
  defaultModel: string;
};

const PROVIDER_FIELDS: ProviderFields[] = [
  {
    key: "deepseek",
    title: "DeepSeek",
    desc: "深度推理模型，适合对话提取 / 认知提取",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  {
    key: "mimo",
    title: "小米 MiMo",
    desc: "多模态模型，支持图片/文件输入",
    defaultBaseUrl: "https://api.mimo.com/v1",
    defaultModel: "mimo-v2.5",
  },
  {
    key: "embedding",
    title: "Embedding",
    desc: "向量模型，用于记忆图谱语义搜索",
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "BAAI/bge-m3",
  },
];

function AIConfigSection({
  dbSettings,
  envSettings,
}: {
  dbSettings: Record<string, FieldStatus>;
  envSettings: Record<string, boolean>;
}) {
  // 默认 Provider：优先读数据库，回退 deepseek
  const [defaultProvider, setDefaultProvider] = useState<"deepseek" | "mimo">(
    dbSettings.defaultProvider?.value === "mimo" ? "mimo" : "deepseek"
  );

  // 三个 Provider 的表单状态
  const [forms, setForms] = useState<Record<"deepseek" | "mimo" | "embedding", ProviderForm>>({
    deepseek: {
      apiKey: "",
      baseUrl: dbSettings.deepseekBaseUrl?.value || "",
      model: dbSettings.deepseekModel?.value || "",
    },
    mimo: {
      apiKey: "",
      baseUrl: dbSettings.mimoBaseUrl?.value || "",
      model: dbSettings.mimoModel?.value || "",
    },
    embedding: {
      apiKey: "",
      baseUrl: dbSettings.embeddingBaseUrl?.value || "",
      model: dbSettings.embeddingModel?.value || "",
    },
  });

  const [saving, setSaving] = useState(false);

  const updateField = (
    provider: "deepseek" | "mimo" | "embedding",
    field: keyof ProviderForm,
    value: string
  ) => {
    setForms((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultProvider,
          deepseekApiKey: forms.deepseek.apiKey,
          deepseekBaseUrl: forms.deepseek.baseUrl,
          deepseekModel: forms.deepseek.model,
          mimoApiKey: forms.mimo.apiKey,
          mimoBaseUrl: forms.mimo.baseUrl,
          mimoModel: forms.mimo.model,
          embeddingApiKey: forms.embedding.apiKey,
          embeddingBaseUrl: forms.embedding.baseUrl,
          embeddingModel: forms.embedding.model,
        }),
      });
      if (res.ok) {
        toast("AI 配置已保存并生效", "success");
        // 清空 apiKey 输入框（已保存到数据库）
        setForms((prev) => ({
          deepseek: { ...prev.deepseek, apiKey: "" },
          mimo: { ...prev.mimo, apiKey: "" },
          embedding: { ...prev.embedding, apiKey: "" },
        }));
        // 重新加载页面状态以刷新 mask 显示
        setTimeout(() => window.location.reload(), 600);
      } else {
        toast("保存失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
    setSaving(false);
  };

  return (
    <Card className="mb-5">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-cognition" />
        <h2 className="text-sm font-semibold">AI 模型配置</h2>
        <span className="ml-auto text-[10px] text-muted-foreground">
          数据库存储 · 优先级高于环境变量 · 保存后立即生效
        </span>
      </div>

      {/* 默认 Provider 切换 */}
      <div className="mb-5 rounded-xl border border-border bg-muted/20 p-3">
        <div className="mb-2 text-[11px] font-medium text-foreground">默认对话 Provider</div>
        <div className="flex gap-2">
          {(["deepseek", "mimo"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setDefaultProvider(p)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                defaultProvider === p
                  ? "border-northstar bg-northstar/10 text-northstar"
                  : "border-border bg-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              {p === "deepseek" ? "DeepSeek" : "小米 MiMo"}
            </button>
          ))}
        </div>
      </div>

      {/* 三个 Provider 卡片 */}
      <div className="space-y-4">
        {PROVIDER_FIELDS.map((p) => (
          <ProviderCard
            key={p.key}
            fields={p}
            form={forms[p.key]}
            dbStatus={{
              apiKey: dbSettings[`${p.key}ApiKey`],
              baseUrl: dbSettings[`${p.key}BaseUrl`],
              model: dbSettings[`${p.key}Model`],
            }}
            envStatus={{
              apiKey: envSettings[`${p.key}ApiKey`] || false,
              baseUrl: envSettings[`${p.key}BaseUrl`] || false,
              model: envSettings[`${p.key}Model`] || false,
            }}
            onChange={(field, value) => updateField(p.key, field, value)}
          />
        ))}
      </div>

      {/* 保存按钮 */}
      <div className="mt-5 flex items-center justify-end gap-3">
        <span className="text-[10px] text-muted-foreground">
          留空 API Key 表示不修改（保持已保存的值）
        </span>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 保存中...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" /> 保存配置
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

/** 单个 Provider 配置卡片 */
function ProviderCard({
  fields,
  form,
  dbStatus,
  envStatus,
  onChange,
}: {
  fields: ProviderFields;
  form: ProviderForm;
  dbStatus: { apiKey: FieldStatus; baseUrl: FieldStatus; model: FieldStatus };
  envStatus: { apiKey: boolean; baseUrl: boolean; model: boolean };
  onChange: (field: keyof ProviderForm, value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-foreground">{fields.title}</div>
          <div className="text-[10px] text-muted-foreground">{fields.desc}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {dbStatus.apiKey.configured ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-task/10 px-1.5 py-0.5 text-[10px] text-task">
              <CheckCircle2 className="h-2.5 w-2.5" /> 数据库已配置
            </span>
          ) : envStatus.apiKey ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-cognition/10 px-1.5 py-0.5 text-[10px] text-cognition">
              环境变量已配置
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-graveyard/10 px-1.5 py-0.5 text-[10px] text-graveyard">
              <XCircle className="h-2.5 w-2.5" /> 未配置
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* API Key */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">API Key</label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => onChange("apiKey", e.target.value)}
            placeholder={
              dbStatus.apiKey.configured
                ? dbStatus.apiKey.value
                : envStatus.apiKey
                ? "环境变量已配置，输入可覆盖"
                : `输入 ${fields.title} API Key`
            }
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-northstar"
          />
        </div>
        {/* Base URL */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Base URL</label>
          <input
            type="text"
            value={form.baseUrl}
            onChange={(e) => onChange("baseUrl", e.target.value)}
            placeholder={fields.defaultBaseUrl}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-northstar"
          />
        </div>
        {/* Model */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Model</label>
          <input
            type="text"
            value={form.model}
            onChange={(e) => onChange("model", e.target.value)}
            placeholder={fields.defaultModel}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-northstar"
          />
        </div>
      </div>

      {/* 已保存配置提示 */}
      {dbStatus.apiKey.configured && (
        <div className="mt-2 text-[10px] text-muted-foreground/70">
          已保存 Key：{dbStatus.apiKey.value}
          {dbStatus.baseUrl.configured && ` · URL：${dbStatus.baseUrl.value}`}
          {dbStatus.model.configured && ` · 模型：${dbStatus.model.value}`}
        </div>
      )}
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

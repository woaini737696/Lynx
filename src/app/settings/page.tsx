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
  Cpu,
  Rocket,
  Play,
  Square,
  Wifi,
  ExternalLink,
  Send,
  BookOpen,
  Terminal,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { HELP_CONTENT } from "@/lib/help-content";
import { toast } from "@/components/ui/toast";
import { UserAIKeyConfig } from "@/components/settings/UserAIKeyConfig";
import { DesktopHermesSection } from "@/components/settings/DesktopHermesSection";

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
      } catch {
        if (!mounted) return;
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
          <HelpButton contentKey="settings" />
        }
      />

      {/* AI 模型配置（数据库存储，优先级高于环境变量） */}
      <AIConfigSection dbSettings={settings.dbSettings} envSettings={settings.envSettings} />

      {/* 用户级 AI Key 配置（每用户自配 Key，优先于全局） */}
      <UserAIKeyConfig />

      {/* 桌面端 HermesAgent 专属配置（仅桌面端显示） */}
      <DesktopHermesSection />

      {/* Hermes Agent 配置 */}
      <HermesConfigSection />

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
          <div className="ios-glass-sm mt-3 rounded-xl border-graveyard/30 p-3 text-xs text-graveyard">
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
          <div className="ios-glass-sm mt-3 rounded-xl border-campaign/30 p-3 text-xs text-campaign">
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
            <pre className="ios-glass-sm overflow-x-auto rounded-md p-2 text-[11px]">
{`AI_BASE_URL=https://api.siliconflow.cn/v1
AI_API_KEY=sk-你的key
AI_MODEL=Qwen/Qwen2.5-7B-Instruct
AI_EMBEDDING_MODEL=BAAI/bge-m3`}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-medium text-foreground">方案 A：OpenAI 官方</div>
            <pre className="ios-glass-sm overflow-x-auto rounded-md p-2 text-[11px]">
{`AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-你的key
AI_MODEL=gpt-4o-mini
AI_EMBEDDING_MODEL=text-embedding-3-small`}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-medium text-foreground">方案 C：DeepSeek（无 embedding）</div>
            <pre className="ios-glass-sm overflow-x-auto rounded-md p-2 text-[11px]">
{`AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=sk-你的key
AI_MODEL=deepseek-chat`}
            </pre>
          </div>
          <div className="ios-glass-sm rounded-md p-2 text-[11px]">
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
      <div className="mb-5 ios-glass-sm rounded-xl p-3">
        <div className="mb-2 text-[11px] font-medium text-foreground">默认对话 Provider</div>
        <div className="flex gap-2">
          {(["deepseek", "mimo"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setDefaultProvider(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                defaultProvider === p
                  ? "border border-northstar bg-northstar/10 text-northstar"
                  : "ios-glass-sm border-border/60 text-muted-foreground hover:border-primary/30 hover:text-primary"
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
    <div className="ios-glass-sm rounded-xl p-4">
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
            className="ios-glass-sm w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors focus:ring-2 focus:ring-northstar/20"
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
            className="ios-glass-sm w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors focus:ring-2 focus:ring-northstar/20"
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
            className="ios-glass-sm w-full rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors focus:ring-2 focus:ring-northstar/20"
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
      className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3 text-xs transition-colors hover:border-northstar/50 hover:bg-primary/10"
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

// ============ Hermes Agent 配置区块 ============

type HermesStatus = {
  installed: boolean;
  installVersion?: string;
  config: {
    enabled: boolean;
    endpoint: string;
    autoStart: boolean;
    capabilities: string[];
    status: string;
    installedAt: string | null;
    lastCheckedAt: string | null;
    lastError: string | null;
  } | null;
  connected: boolean;
  version?: string;
  capabilities: string[];
  connectionError?: string;
};

const ALL_CAPABILITIES = [
  { key: "computer_use", label: "桌面控制", desc: "Agent 可操控你的电脑桌面（鼠标/键盘/截图）" },
  { key: "shell", label: "Shell 命令", desc: "执行终端命令（文件操作、脚本运行等）" },
  { key: "mcp", label: "MCP 工具", desc: "集成 Model Context Protocol 工具生态" },
  { key: "skills_hub", label: "Skills Hub", desc: "672+ 官方技能市场，一键调用" },
];

function HermesConfigSection() {
  const [status, setStatus] = useState<HermesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHermesHelp, setShowHermesHelp] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);

  // 编辑态
  const [endpoint, setEndpoint] = useState("http://localhost:9119");
  const [apiKey, setApiKey] = useState("");
  const [autoStart, setAutoStart] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [capabilities, setCapabilities] = useState<string[]>(["computer_use", "shell", "skills_hub"]);

  // 快速执行相关状态
  const [quickTask, setQuickTask] = useState("");
  const [quickExecuting, setQuickExecuting] = useState(false);
  const [quickResult, setQuickResult] = useState<{ success: boolean; output: string; error?: string; durationMs?: number } | null>(null);

  // 模型配置相关状态
  const [modelConfigured, setModelConfigured] = useState<boolean | null>(null);
  const [configuringModel, setConfiguringModel] = useState(false);
  // 模型 provider 选择：deepseek | mimo | auto
  const [selectedProvider, setSelectedProvider] = useState<"deepseek" | "mimo" | "auto">("auto");
  // 可用模型列表（来自 AISetting）
  const [availableModels, setAvailableModels] = useState<Array<{ provider: string; model: string; configured: boolean }>>([]);
  const [defaultProvider, setDefaultProvider] = useState<string>("auto");

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/hermes/status");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setStatus(data);
      if (data.config) {
        setEndpoint(data.config.endpoint || "http://localhost:9119");
        setEnabled(data.config.enabled);
        setAutoStart(data.config.autoStart);
        setCapabilities(data.config.capabilities || ["computer_use", "shell", "skills_hub"]);
      }
    } catch (e: any) {
      toast("加载 Hermes 状态失败", "error");
    } finally {
      setLoading(false);
    }
  };

  // 检查 Hermes 模型配置状态（已安装时才检查）
  const checkModelConfig = async () => {
    try {
      const res = await fetch("/api/hermes/configure-model");
      if (res.ok) {
        const data = await res.json();
        setModelConfigured(data.configured === true);
        if (Array.isArray(data.availableModels)) {
          setAvailableModels(data.availableModels);
        }
        if (data.defaultProvider) {
          setDefaultProvider(data.defaultProvider);
          // 默认跟随数据库配置的 provider
          if (data.defaultProvider === "deepseek" || data.defaultProvider === "mimo") {
            setSelectedProvider(data.defaultProvider);
          } else {
            setSelectedProvider("auto");
          }
        }
      }
    } catch {
      // 静默失败
    }
  };

  // 一键配置 Hermes 模型（复用 Lynx 的 DeepSeek / MiMo API Key）
  const handleConfigureModel = async () => {
    setConfiguringModel(true);
    try {
      const res = await fetch("/api/hermes/configure-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(data.message || "模型配置成功", "success");
        setModelConfigured(true);
      } else {
        toast(data.error || "配置失败", "error");
      }
    } catch (e: any) {
      toast("请求失败：" + e.message, "error");
    } finally {
      setConfiguringModel(false);
    }
  };

  useEffect(() => {
    loadStatus();
    checkModelConfig();
    // 每 30 秒自动刷新状态（原 10 秒过于频繁，hermes status 命令较重）
    const timer = setInterval(loadStatus, 30_000);
    return () => clearInterval(timer);
  }, []);

  // 快速执行 Hermes 任务
  const handleQuickExecute = async () => {
    const prompt = quickTask.trim();
    if (!prompt) {
      toast("请输入任务描述", "error");
      return;
    }
    setQuickExecuting(true);
    setQuickResult(null);
    try {
      const res = await fetch("/api/hermes/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode: "auto", timeout: 120 }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setQuickResult({
          success: true,
          output: data.output || "(任务已完成，无输出)",
          durationMs: data.durationMs,
        });
        toast("任务执行完成", "success");
      } else {
        setQuickResult({
          success: false,
          output: "",
          error: data.error || "任务执行失败",
          durationMs: data.durationMs,
        });
        toast(data.error || "任务执行失败", "error");
      }
    } catch (e: any) {
      setQuickResult({
        success: false,
        output: "",
        error: e.message || "请求失败",
      });
      toast("请求失败：" + e.message, "error");
    } finally {
      setQuickExecuting(false);
    }
  };

  // 示例任务
  const QUICK_EXAMPLES = [
    "打开浏览器访问 github.com",
    "查看当前目录文件列表",
    "截图保存到桌面",
    "查询今天北京天气",
  ];

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const res = await fetch("/api/hermes/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast("Lynx Agent 安装成功", "success");
        await loadStatus();
      } else {
        toast(data.error || "安装失败", "error");
      }
    } catch (e: any) {
      toast("安装请求失败：" + e.message, "error");
    } finally {
      setInstalling(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const port = endpoint.match(/:(\d+)$/)?.[1] || "9119";
      const res = await fetch("/api/hermes/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", port: parseInt(port, 10) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(data.message || "Lynx Agent 已启动", "success");
        await loadStatus();
      } else {
        toast(data.error || "启动失败", "error");
      }
    } catch (e: any) {
      toast("启动请求失败：" + e.message, "error");
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    try {
      await fetch("/api/hermes/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      toast("Lynx Agent 已停止", "success");
      await loadStatus();
    } catch (e: any) {
      toast("停止失败：" + e.message, "error");
    }
  };

  // 打开 Dashboard：先确保服务已启动，再在新标签页打开 endpoint
  // 解决"点开无法访问"问题：服务可能未运行或刚启动未就绪
  const handleOpenDashboard = async () => {
    const installed = status?.installed;
    const running = status?.config?.status === "running";
    if (!installed) {
      toast("请先安装 Lynx Agent", "error");
      return;
    }
    setOpeningDashboard(true);
    try {
      const port = endpoint.match(/:(\d+)$/)?.[1] || "9119";
      // 若服务未运行，先启动
      if (!running) {
        const startRes = await fetch("/api/hermes/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start", port: parseInt(port, 10) }),
        });
        const startData = await startRes.json();
        if (!startRes.ok || !startData.success) {
          toast("Dashboard 启动失败：" + (startData.error || "未知错误"), "error");
          return;
        }
        toast("Dashboard 已启动，正在打开...", "success");
        await loadStatus();
        // 等待 1.5 秒让 HTTP 服务完全就绪
        await new Promise((r) => setTimeout(r, 1500));
      }
      // 在新标签页打开 Dashboard
      window.open(endpoint, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast("打开 Dashboard 失败：" + e.message, "error");
    } finally {
      setOpeningDashboard(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/hermes/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (data.connected) {
        toast(`连接成功（v${data.version || "?"}）`, "success");
      } else {
        toast("连接失败：" + (data.error || "未知错误"), "error");
      }
      await loadStatus();
    } catch (e: any) {
      toast("测试请求失败：" + e.message, "error");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/hermes/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          endpoint,
          apiKey: apiKey || null,
          autoStart,
          capabilities,
        }),
      });
      if (res.ok) {
        toast("配置已保存", "success");
        await loadStatus();
      } else {
        toast("保存失败", "error");
      }
    } catch (e: any) {
      toast("保存失败：" + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleCapability = (key: string) => {
    setCapabilities((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]
    );
  };

  if (loading) {
    return (
      <Section icon={<Cpu className="h-4 w-4 text-northstar" />} title="Lynx Agent（本地 AI 代理）">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> 加载中...
        </div>
      </Section>
    );
  }

  const isInstalled = status?.installed;
  const isRunning = status?.config?.status === "running";
  const isConnected = status?.connected;

  return (
    <Section
      icon={<Cpu className="h-4 w-4 text-northstar" />}
      title="Lynx Agent（本地 AI 代理）"
    >
      {/* 说明 */}
      <div className="mb-4 rounded-md border border-northstar/20 bg-northstar/5 p-3 text-xs text-muted-foreground">
        <div className="mb-1 flex items-center justify-between">
          <div className="font-medium text-foreground">🤖 Lynx Agent 是什么？</div>
          <button
            type="button"
            onClick={handleOpenDashboard}
            disabled={openingDashboard}
            className="inline-flex items-center gap-1 text-[11px] text-campaign hover:underline disabled:opacity-50"
            title={isInstalled ? "确保 Dashboard 服务已启动并在新标签页打开" : "请先安装 Lynx Agent"}
          >
            {openingDashboard ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> 启动中...</>
            ) : (
              <><ExternalLink className="h-3 w-3" /> 打开 Dashboard</>
            )}
          </button>
        </div>
        基于 Hermes Agent 技术深度定制开发，让 AI 助理升级为 Lynx 超级助理，可以直接操控你的电脑（桌面控制、Shell 命令、系统级 CLI、浏览器控制、应用控制），并且拥有自主学习能力（你重复做 2 次的工作，Lynx 超级助理会自主学习并打包成技能 Skill），自我成长能力（你每次的对话和操作，Lynx 超级助理会自动提取关键记忆，保证永远不会失忆），实现「AI 自动化工作流」，无需学习开箱即用。所有操作都在本地执行，数据不出本机，保证你的隐私。
      </div>

      {/* Lynx Agent 使用说明已整合到右上角 HelpButton 弹窗（contentKey="settings"） */}

      {/* 安装状态 */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${
              isRunning ? "bg-green-500" : isInstalled ? "bg-yellow-500" : "bg-gray-400"
            }`} />
            <span className="font-medium text-foreground">
              {isRunning ? "运行中" : isInstalled ? "已安装（未运行）" : "未安装"}
            </span>
            {status?.installVersion && (
              <span className="text-muted-foreground">v{status.installVersion}</span>
            )}
            {isConnected && status?.version && (
              <span className="text-green-600">· 已连接</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isInstalled && (
              <Button
                size="sm"
                onClick={handleInstall}
                disabled={installing}
                className="gap-1.5"
              >
                {installing ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> 安装中...</>
                ) : (
                  <><Rocket className="h-3 w-3" /> 一键安装</>
                )}
              </Button>
            )}
            {isInstalled && !isRunning && (
              <Button
                size="sm"
                onClick={handleStart}
                disabled={starting}
                className="gap-1.5"
              >
                {starting ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> 启动中...</>
                ) : (
                  <><Play className="h-3 w-3" /> 启动服务</>
                )}
              </Button>
            )}
            {isRunning && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleStop}
                className="gap-1.5"
              >
                <Square className="h-3 w-3" /> 停止
              </Button>
            )}
          </div>
        </div>

        {status?.config?.lastError && (
          <div className="rounded-md border border-red-300/30 bg-red-50/50 p-2 text-xs text-red-600">
            ⚠️ {status.config.lastError}
          </div>
        )}
      </div>

      {/* 模型配置（LLM Provider）— 未配置时会导致 "no final response was produced" */}
      {isInstalled && (
        <div className="mb-4 rounded-md glass-card p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className={`h-2 w-2 rounded-full ${
                modelConfigured === true ? "bg-green-500" : modelConfigured === false ? "bg-red-500" : "bg-gray-400"
              }`} />
              <span className="font-medium text-foreground">LLM 模型配置</span>
              {modelConfigured === true ? (
                <span className="text-green-600">· 已配置</span>
              ) : modelConfigured === false ? (
                <span className="text-red-600">· 未配置（任务会失败）</span>
              ) : (
                <span className="text-muted-foreground">· 检测中</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 模型 provider 选择器 */}
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as "deepseek" | "mimo" | "auto")}
                disabled={configuringModel}
                className="h-7 rounded border border-border/60 bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-campaign disabled:opacity-50"
                title="选择要配置的 LLM Provider"
              >
                <option value="auto">自动（按配置）</option>
                <option value="deepseek">DeepSeek</option>
                <option value="mimo">MiMo</option>
              </select>
              <Button
                size="sm"
                variant={modelConfigured ? "outline" : "primary"}
                onClick={handleConfigureModel}
                disabled={configuringModel}
                className="gap-1.5"
              >
                {configuringModel ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> 配置中...</>
                ) : modelConfigured ? (
                  <><RefreshCw className="h-3 w-3" /> 重新配置</>
                ) : (
                  <><Sparkles className="h-3 w-3" /> 一键配置模型</>
                )}
              </Button>
            </div>
          </div>
          {modelConfigured === false && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              Hermes 需要配置 LLM 模型才能执行任务。点击「一键配置模型」会自动复用 Lynx 的 DeepSeek / MiMo API Key 写入 Hermes 配置。
            </div>
          )}
          {availableModels.length > 0 && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              已配置的 Provider：
              {availableModels.map((m) => ` ${m.provider}（${m.model}）`).join("、")}
              {defaultProvider && defaultProvider !== "auto" ? `　默认：${defaultProvider}` : ""}
            </div>
          )}
        </div>
      )}

      {/* 快速执行（仅在运行中时显示） */}
      {isRunning && (
        <div className="mb-4 rounded-md border border-campaign/30 bg-campaign/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-campaign" />
            <span className="text-xs font-medium text-foreground">快速执行任务</span>
            <span className="text-[10px] text-muted-foreground">直接在这里让 Hermes 执行任务，无需切换到 AI 助理</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={quickTask}
              onChange={(e) => setQuickTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !quickExecuting) handleQuickExecute();
              }}
              placeholder="输入任务描述，如：打开浏览器访问 github.com"
              className="flex-1 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs"
              disabled={quickExecuting}
            />
            <Button
              size="sm"
              onClick={handleQuickExecute}
              disabled={quickExecuting || !quickTask.trim()}
              className="gap-1.5"
            >
              {quickExecuting ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> 执行中...</>
              ) : (
                <><Send className="h-3 w-3" /> 执行</>
              )}
            </Button>
          </div>

          {/* 示例任务 */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuickTask(ex)}
                disabled={quickExecuting}
                className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-campaign/40 hover:text-campaign disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>

          {/* 执行结果 */}
          {quickResult && (
            <div className="mt-3 rounded-md border border-border/60 bg-background p-2.5">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className={quickResult.success ? "text-task" : "text-graveyard"}>
                  {quickResult.success ? "✓ 执行成功" : "✗ 执行失败"}
                </span>
                {quickResult.durationMs && (
                  <span className="text-muted-foreground">
                    耗时 {(quickResult.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {quickResult.success ? (
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-[11px] text-foreground">
                  {quickResult.output}
                </pre>
              ) : (
                <div className="text-[11px] text-graveyard">{quickResult.error}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 配置表单 */}
      <div className="space-y-3">
        {/* 启用开关 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-foreground">启用 Hermes 集成</div>
            <div className="text-[11px] text-muted-foreground">开启后 AI 助理和工作流可调用 Hermes</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-northstar focus-visible:ring-opacity-75 ${
              enabled ? "bg-northstar" : "bg-muted-foreground/30"
            }`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        {/* 端点 */}
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Hermes 端点</label>
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="http://localhost:9119"
            className="w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">API Key（可选）</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="如 Hermes 启用了鉴权则填写"
            className="w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs"
          />
        </div>

        {/* 能力配置 */}
        <div>
          <div className="mb-2 text-xs font-medium text-foreground">能力配置</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ALL_CAPABILITIES.map((cap) => (
              <label
                key={cap.key}
                className={`flex cursor-pointer items-start gap-2 rounded-md p-2 text-xs transition-colors ios-glass-sm ${
                  capabilities.includes(cap.key) ? "border-northstar/40 bg-northstar/5" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={capabilities.includes(cap.key)}
                  onChange={() => toggleCapability(cap.key)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-foreground">{cap.label}</div>
                  <div className="text-[11px] text-muted-foreground">{cap.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 自动启动 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-foreground">随系统自动启动</div>
            <div className="text-[11px] text-muted-foreground">服务启动时自动拉起 Lynx Agent</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoStart}
            onClick={() => setAutoStart(!autoStart)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-northstar focus-visible:ring-opacity-75 ${
              autoStart ? "bg-northstar" : "bg-muted-foreground/30"
            }`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              autoStart ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            保存配置
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testing || !isInstalled}
            className="gap-1.5"
          >
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
            测试连接
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ============ Lynx Agent 使用说明弹窗 ============

function HermesHelpModal({ onClose }: { onClose: () => void }) {
  const content = HELP_CONTENT["hermes-agent"];
  if (!content) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <div
        className="glass-modal max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <BookOpen className="h-5 w-5 text-northstar" />
            Lynx Agent 使用说明
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="space-y-5 px-6 py-5 text-muted-foreground">
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-graveyard">
              <span className="ios-glass-sm flex h-5 w-5 items-center justify-center rounded-full text-xs">!</span>
              痛点
            </h3>
            <p className="text-sm leading-relaxed">{content.painPoint}</p>
          </section>

          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-campaign">
              <span className="ios-glass-sm flex h-5 w-5 items-center justify-center rounded-full text-xs">?</span>
              需求
            </h3>
            <p className="text-sm leading-relaxed">{content.need}</p>
          </section>

          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-northstar">
              <span className="ios-glass-sm flex h-5 w-5 items-center justify-center rounded-full text-xs">✓</span>
              解决方案
            </h3>
            <p className="text-sm leading-relaxed">{content.solution}</p>
          </section>

          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-task">
              <span className="ios-glass-sm flex h-5 w-5 items-center justify-center rounded-full text-xs">→</span>
              使用方法
            </h3>
            <ol className="space-y-2">
              {content.usage.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="ios-glass-sm flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-task">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* 底部 */}
        <div className="sticky bottom-0 border-t border-border/60 px-6 py-3">
          <div className="mb-2 text-[10px] text-muted-foreground/70">
            版本 v{content.version} · 更新于 {content.updatedAt}
          </div>
          <button
            onClick={onClose}
            className="btn-primary w-full rounded-lg py-2 text-sm font-medium text-primary-foreground transition"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

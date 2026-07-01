"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
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
  Terminal,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Image as ImageIcon,
  Video,
  Volume2,
  Mic,
  Edit3,
  Trash2,
  Star,
  Power,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";
import { isDesktop, installAiEnv, startHermesAgent } from "@/lib/desktop-client";

// 三个 tab 内容组件改为 dynamic 懒加载：仅在用户首次访问对应 tab 时才下载
// 配合下方 visitedTabs 机制，未访问的 tab 不会触发 chunk 请求
const UserAIKeyConfig = dynamic(
  () => import("@/components/settings/UserAIKeyConfig").then((m) => m.UserAIKeyConfig),
  { ssr: false, loading: () => <LoadingState title="AI 模型 Key 配置" /> }
);
const DesktopHermesSection = dynamic(
  () => import("@/components/settings/DesktopHermesSection").then((m) => m.DesktopHermesSection),
  { ssr: false, loading: () => <LoadingState title="桌面端 Lynx Agent" /> }
);
const AuthConfigSection = dynamic(
  () => import("@/components/settings/AuthConfigSection").then((m) => m.AuthConfigSection),
  { ssr: false, loading: () => <LoadingState title="认证配置" /> }
);

/** 设置页 Tab */
type SettingsTab = "ai" | "agent" | "auth" | "system" | "files";

const TABS: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { key: "ai", label: "AI 模型", icon: <KeyRound className="h-3.5 w-3.5" /> },
  { key: "agent", label: "Lynx Agent", icon: <img src="/lynx-icon-64.png" alt="" className="h-3.5 w-3.5 rounded-sm" /> },
  { key: "auth", label: "认证", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { key: "system", label: "系统状态", icon: <Database className="h-3.5 w-3.5" /> },
  { key: "files", label: "配置文件", icon: <FileText className="h-3.5 w-3.5" /> },
];

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
  const [activeTab, setActiveTab] = useState<SettingsTab>("ai");
  // 已访问过的 tab，避免重复 mount/unmount 造成频繁请求
  // 默认仅含首屏可见的 ai，其他 tab 点击后才加载对应 dynamic chunk
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTab>>(new Set(["ai"]));

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

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  };

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
        action={<HelpButton contentKey="settings" />}
      />

      {/* Tab 导航 - 液态玻璃风格，sticky 固定 */}
      <div className="sticky top-0 z-20 mb-5 -mx-1 px-1">
        <div className="glass-card flex gap-1 overflow-x-auto rounded-2xl p-1.5">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
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
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 内容 - 仅渲染已访问过的 tab，避免切回时重新 mount */}
      {/* AI 模型 Tab */}
      {visitedTabs.has("ai") && (
        <div className={activeTab === "ai" ? "block" : "hidden"}>
          <AIConfigSection dbSettings={settings.dbSettings} envSettings={settings.envSettings} />
          <UserAIKeyConfig />
          {/* 环境变量状态提示（精简版） */}
          <Section
            icon={<Brain className="h-4 w-4 text-task" />}
            title="环境变量与运行状态"
          >
            <Row
              label="对话模型"
              value={settings.ai.chatProvider ? `${settings.ai.chatModel}` : "未配置（AI 提取不可用）"}
              ok={settings.ai.chatProvider}
            />
            <Row
              label="Embedding"
              value={settings.ai.embeddingEnabled ? `${settings.ai.embeddingModel}（${settings.ai.embeddingMode}）` : "TF-IDF 降级模式"}
              ok={settings.ai.embeddingEnabled}
            />
            {!settings.ai.chatProvider && (
              <div className="ios-glass-sm mt-2 rounded-xl border-graveyard/30 p-3 text-xs text-foreground/80">
                ⚠️ 未配置 LLM API Key 时，对话资产和认知库的 AI 提取会跳过。点击上方模型卡片「编辑」按钮配置 API Key。
              </div>
            )}
            {!settings.ai.embeddingEnabled && (
              <div className="ios-glass-sm mt-2 rounded-xl border-campaign/30 p-3 text-xs text-foreground/80">
                ℹ️ 未配置 Embedding 时，记忆图谱使用 TF-IDF 关键词匹配（可用但精度较低）。在「向量模型」分类中配置后启用语义搜索。
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Lynx Agent Tab */}
      {visitedTabs.has("agent") && (
        <div className={activeTab === "agent" ? "block" : "hidden"}>
          <DesktopHermesSection />
          <HermesConfigSection />
        </div>
      )}

      {/* 认证 Tab：万能验证码 + 邀请码管理（仅 admin 可见 API 数据） */}
      {visitedTabs.has("auth") && (
        <div className={activeTab === "auth" ? "block" : "hidden"}>
          <AuthConfigSection />
        </div>
      )}

      {/* 系统 Tab */}
      {visitedTabs.has("system") && (
        <div className={activeTab === "system" ? "block" : "hidden"}>
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
          <Section icon={<Zap className="h-4 w-4 text-northstar" />} title="快捷键">
            <Row label="闪电输入" value="Ctrl + J（Mac: Cmd + J）" ok />
            <Row
              label="说明"
              value="原 Ctrl+Space 在 Windows 被输入法占用，已改为 Ctrl+J"
            />
          </Section>
        </div>
      )}

      {/* 配置文件 Tab */}
      {visitedTabs.has("files") && (
        <div className={activeTab === "files" ? "block" : "hidden"}>
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
      )}
    </div>
  );
}

// ============ AI 模型配置区块（卡片列表模式） ============

/** 模型分类 */
type ModelCategory = "text" | "multimodal" | "image" | "video" | "embedding" | "tts" | "asr";

const MODEL_CATEGORIES: { key: ModelCategory; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "text", label: "单模态", icon: <MessageSquare className="h-3.5 w-3.5" />, desc: "文本对话与推理" },
  { key: "multimodal", label: "多模态", icon: <Sparkles className="h-3.5 w-3.5" />, desc: "文本+图片+文件" },
  { key: "image", label: "图片生成", icon: <ImageIcon className="h-3.5 w-3.5" />, desc: "文生图 / 图生图" },
  { key: "video", label: "视频生成", icon: <Video className="h-3.5 w-3.5" />, desc: "文生视频" },
  { key: "embedding", label: "向量模型", icon: <Brain className="h-3.5 w-3.5" />, desc: "语义搜索与记忆图谱" },
  { key: "tts", label: "TTS", icon: <Volume2 className="h-3.5 w-3.5" />, desc: "文本转语音" },
  { key: "asr", label: "ASR", icon: <Mic className="h-3.5 w-3.5" />, desc: "语音转文本" },
];

/** 模型定义 */
interface ModelDef {
  id: string;
  category: ModelCategory;
  name: string;
  desc: string;
  provider: string;
  defaultBaseUrl: string;
  defaultModel: string;
  /** 是否支持设为默认对话模型（仅对话类模型支持） */
  canBeDefault?: boolean;
  /** 是否为自定义模型（存 localStorage） */
  isCustom?: boolean;
  /** 自定义模型的 API Key（仅 isCustom 时有效，存 localStorage） */
  _customApiKey?: string;
}

/** 内置模型定义 */
const BUILTIN_MODEL_DEFS: ModelDef[] = [
  {
    id: "deepseek",
    category: "text",
    name: "DeepSeek",
    desc: "深度推理模型，适合对话提取 / 认知提取",
    provider: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    canBeDefault: true,
  },
  {
    id: "mimo",
    category: "multimodal",
    name: "小米 MiMo",
    desc: "多模态模型，支持图片/文件输入",
    provider: "MiMo",
    defaultBaseUrl: "https://api.xiaomimimo.com/v1",
    defaultModel: "mimo-v2.5",
    canBeDefault: true,
  },
  {
    id: "mimo-tts",
    category: "tts",
    name: "MiMo TTS",
    desc: "小米 MiMo 语音合成，复用 MiMo API Key",
    provider: "MiMo",
    defaultBaseUrl: "https://api.xiaomimimo.com/v1",
    defaultModel: "mimo-v2.5-tts",
  },
  {
    id: "mimo-asr",
    category: "asr",
    name: "MiMo ASR",
    desc: "小米 MiMo 语音识别，复用 MiMo API Key",
    provider: "MiMo",
    defaultBaseUrl: "https://api.xiaomimimo.com/v1",
    defaultModel: "mimo-v2.5-asr",
  },
  {
    id: "embedding",
    category: "embedding",
    name: "BAAI/bge-m3",
    desc: "向量模型，用于记忆图谱语义搜索",
    provider: "SiliconFlow",
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    defaultModel: "BAAI/bge-m3",
  },
];

/** localStorage 自定义模型存储 key */
const CUSTOM_MODELS_KEY = "lynnhub:custom-models";

/** 加载自定义模型 */
function loadCustomModels(): ModelDef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ModelDef[];
    return Array.isArray(arr) ? arr.map((m) => ({ ...m, isCustom: true })) : [];
  } catch {
    return [];
  }
}

/** 保存自定义模型 */
function saveCustomModels(models: ModelDef[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models.map(({ isCustom, ...rest }) => rest)));
  } catch {
    // ignore
  }
}

function AIConfigSection({
  dbSettings,
  envSettings,
}: {
  dbSettings: Record<string, FieldStatus>;
  envSettings: Record<string, boolean>;
}) {
  const [activeCategory, setActiveCategory] = useState<ModelCategory>("text");
  // 编辑弹窗状态
  const [editingModel, setEditingModel] = useState<ModelDef | null>(null);
  const [editForm, setEditForm] = useState<{ apiKey: string; baseUrl: string; model: string }>({
    apiKey: "",
    baseUrl: "",
    model: "",
  });
  const [saving, setSaving] = useState(false);
  // 自定义模型
  const [customModels, setCustomModels] = useState<ModelDef[]>([]);
  // 新增模型弹窗
  const [showAddModal, setShowAddModal] = useState(false);
  const [newModel, setNewModel] = useState<{
    name: string;
    desc: string;
    category: ModelCategory;
    provider: string;
    baseUrl: string;
    model: string;
    apiKey: string;
  }>({
    name: "",
    desc: "",
    category: "text",
    provider: "",
    baseUrl: "",
    model: "",
    apiKey: "",
  });

  // 初次挂载加载自定义模型
  useEffect(() => {
    setCustomModels(loadCustomModels());
  }, []);

  // 当前默认 Provider
  const defaultProvider = dbSettings.defaultProvider?.value === "mimo" ? "mimo" : "deepseek";

  // 合并内置+自定义模型
  const allModels = useMemo(() => [...BUILTIN_MODEL_DEFS, ...customModels], [customModels]);

  // 当前分类下的模型
  const categoryModels = allModels.filter((m) => m.category === activeCategory);

  // 判断模型是否已配置
  const isConfigured = (model: ModelDef) => {
    if (model.isCustom) {
      // 自定义模型：检查 localStorage 里的 apiKey 是否存在
      return Boolean(model._customApiKey);
    }
    // mimo-tts/mimo-asr 检查 tts/asr 字段（共用 MIMO_API_KEY）
    if (model.id === "mimo-tts") {
      const dbKey = dbSettings.ttsApiKey;
      return dbKey?.configured || envSettings.ttsApiKey || envSettings.mimoApiKey || false;
    }
    if (model.id === "mimo-asr") {
      const dbKey = dbSettings.asrApiKey;
      return dbKey?.configured || envSettings.asrApiKey || envSettings.mimoApiKey || false;
    }
    const dbKey = dbSettings[`${model.id}ApiKey`];
    return dbKey?.configured || envSettings[`${model.id}ApiKey`] || false;
  };

  // 打开编辑弹窗
  const handleEdit = (model: ModelDef) => {
    setEditingModel(model);
    if (model.isCustom) {
      setEditForm({
        apiKey: "",
        baseUrl: model.defaultBaseUrl,
        model: model.defaultModel,
      });
    } else {
      setEditForm({
        apiKey: "",
        baseUrl: dbSettings[`${model.id}BaseUrl`]?.value || "",
        model: dbSettings[`${model.id}Model`]?.value || "",
      });
    }
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingModel) return;
    setSaving(true);
    try {
      if (editingModel.isCustom) {
        // 自定义模型：更新 localStorage
        const updated = customModels.map((m) => {
          if (m.id !== editingModel.id) return m;
          return {
            ...m,
            defaultBaseUrl: editForm.baseUrl || m.defaultBaseUrl,
            defaultModel: editForm.model || m.defaultModel,
            _customApiKey: editForm.apiKey || m._customApiKey,
          } as ModelDef;
        });
        setCustomModels(updated);
        saveCustomModels(updated);
        toast(`${editingModel.name} 配置已保存`, "success");
        setEditingModel(null);
      } else {
        // 内置模型：保存到数据库
        const body: Record<string, unknown> = {};
        if (editForm.apiKey) body[`${editingModel.id}ApiKey`] = editForm.apiKey;
        if (editForm.baseUrl) body[`${editingModel.id}BaseUrl`] = editForm.baseUrl;
        if (editForm.model) body[`${editingModel.id}Model`] = editForm.model;

        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast(`${editingModel.name} 配置已保存`, "success");
          setEditingModel(null);
          setTimeout(() => window.location.reload(), 600);
        } else {
          toast("保存失败", "error");
        }
      }
    } catch {
      toast("网络错误", "error");
    }
    setSaving(false);
  };

  // 设为默认
  const handleSetDefault = async (model: ModelDef) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultProvider: model.id }),
      });
      if (res.ok) {
        toast(`${model.name} 已设为默认对话模型`, "success");
        setTimeout(() => window.location.reload(), 600);
      } else {
        toast("设置默认失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
  };

  // 删除配置（清除 API Key）
  const handleRemove = async (model: ModelDef) => {
    if (model.isCustom) {
      // 自定义模型：从 localStorage 移除整个模型
      if (!confirm(`确定要移除自定义模型「${model.name}」吗？`)) return;
      const updated = customModels.filter((m) => m.id !== model.id);
      setCustomModels(updated);
      saveCustomModels(updated);
      toast(`${model.name} 已移除`, "success");
      return;
    }
    if (!confirm(`确定要移除 ${model.name} 的配置吗？这将清除已保存的 API Key。`)) return;
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [`${model.id}ApiKey`]: "" }),
      });
      if (res.ok) {
        toast(`${model.name} 配置已移除`, "success");
        setTimeout(() => window.location.reload(), 600);
      } else {
        toast("移除失败", "error");
      }
    } catch {
      toast("网络错误", "error");
    }
  };

  // 新增自定义模型
  const handleAddModel = () => {
    if (!newModel.name.trim() || !newModel.provider.trim()) {
      toast("模型名称和提供商不能为空", "error");
      return;
    }
    const id = `custom-${Date.now()}`;
    const model: ModelDef = {
      id,
      category: newModel.category,
      name: newModel.name.trim(),
      desc: newModel.desc.trim() || "自定义模型",
      provider: newModel.provider.trim(),
      defaultBaseUrl: newModel.baseUrl.trim() || "https://api.example.com/v1",
      defaultModel: newModel.model.trim() || "custom-model",
      canBeDefault: newModel.category === "text" || newModel.category === "multimodal",
      isCustom: true,
      _customApiKey: newModel.apiKey.trim() || undefined,
    } as ModelDef;
    const updated = [...customModels, model];
    setCustomModels(updated);
    saveCustomModels(updated);
    toast(`${model.name} 已添加`, "success");
    setShowAddModal(false);
    setActiveCategory(newModel.category);
    setNewModel({ name: "", desc: "", category: "text", provider: "", baseUrl: "", model: "", apiKey: "" });
  };

  return (
    <Card className="mb-5">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-cognition" />
        <h2 className="text-sm font-semibold text-foreground">AI 模型管理</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddModal(true)}
          className="ml-auto gap-1.5"
        >
          <Plus className="h-3 w-3" />
          新增模型
        </Button>
      </div>

      {/* 分类 Tab */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {MODEL_CATEGORIES.map((cat) => {
          const active = activeCategory === cat.key;
          const count = allModels.filter((m) => m.category === cat.key).length;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "ios-glass-sm text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.icon}
              {cat.label}
              {count > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-muted-foreground/15"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 模型卡片列表 */}
      {categoryModels.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {categoryModels.map((model) => {
            const configured = isConfigured(model);
            const isDefault = model.canBeDefault && defaultProvider === model.id;
            // mimo-tts/mimo-asr 共用 MIMO_API_KEY，需查 tts/asr 字段而非 mimo-ttsApiKey
            const dbKey = !model.isCustom
              ? (model.id === "mimo-tts"
                  ? dbSettings.ttsApiKey
                  : model.id === "mimo-asr"
                    ? dbSettings.asrApiKey
                    : dbSettings[`${model.id}ApiKey`])
              : undefined;
            const envConfigured = !model.isCustom
              ? (model.id === "mimo-tts"
                  ? (envSettings.ttsApiKey || envSettings.mimoApiKey || false)
                  : model.id === "mimo-asr"
                    ? (envSettings.asrApiKey || envSettings.mimoApiKey || false)
                    : (envSettings[`${model.id}ApiKey`] || false))
              : false;

            return (
              <div
                key={model.id}
                className={`ios-glass-sm rounded-xl p-4 transition-all ${
                  isDefault ? "ring-1 ring-northstar/40" : ""
                }`}
              >
                {/* 卡片头部 */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{model.name}</span>
                      {model.isCustom && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-cognition/15 px-1.5 py-0.5 text-[10px] font-medium text-cognition">
                          自定义
                        </span>
                      )}
                      {isDefault && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-northstar/15 px-1.5 py-0.5 text-[10px] font-medium text-northstar">
                          <Star className="h-2.5 w-2.5" /> 默认
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{model.desc}</div>
                  </div>
                  {/* 状态徽章 */}
                  <div className="ml-2 shrink-0">
                    {model.isCustom ? (
                      configured ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-task/10 px-2 py-0.5 text-[10px] font-medium text-task">
                          <CheckCircle2 className="h-2.5 w-2.5" /> 已配置
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-graveyard/10 px-2 py-0.5 text-[10px] font-medium text-graveyard">
                          <XCircle className="h-2.5 w-2.5" /> 未配置
                        </span>
                      )
                    ) : dbKey?.configured ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-task/10 px-2 py-0.5 text-[10px] font-medium text-task">
                        <CheckCircle2 className="h-2.5 w-2.5" /> 已配置
                      </span>
                    ) : envConfigured ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-cognition/10 px-2 py-0.5 text-[10px] font-medium text-cognition">
                        环境变量
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-graveyard/10 px-2 py-0.5 text-[10px] font-medium text-graveyard">
                        <XCircle className="h-2.5 w-2.5" /> 未配置
                      </span>
                    )}
                  </div>
                </div>

                {/* 配置摘要 */}
                {(configured || model.isCustom) && (
                  <div className="mb-3 space-y-0.5 text-xs text-muted-foreground">
                    {model.isCustom ? (
                      <>
                        {model._customApiKey && (
                          <div className="flex items-center gap-1.5">
                            <KeyRound className="h-3 w-3" />
                            <span>Key: {model._customApiKey.slice(0, 6)}***</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground/60">URL:</span>
                          <span className="truncate">{model.defaultBaseUrl}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground/60">模型:</span>
                          <span>{model.defaultModel}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        {dbKey?.configured && (
                          <div className="flex items-center gap-1.5">
                            <KeyRound className="h-3 w-3" />
                            <span>Key: {dbKey.value}</span>
                          </div>
                        )}
                        {(() => {
                          // mimo-tts/mimo-asr 共用 MIMO 的 BaseUrl/Model
                          const baseUrlKey = model.id === "mimo-tts" ? "ttsBaseUrl" : model.id === "mimo-asr" ? "asrBaseUrl" : `${model.id}BaseUrl`;
                          const modelKey = model.id === "mimo-tts" ? "ttsModel" : model.id === "mimo-asr" ? "asrModel" : `${model.id}Model`;
                          const baseUrlConfigured = dbSettings[baseUrlKey]?.configured || envSettings[baseUrlKey] || envSettings.mimoBaseUrl || false;
                          const modelConfigured = dbSettings[modelKey]?.configured || envSettings[modelKey] || false;
                          return (
                            <>
                              {baseUrlConfigured && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground/60">URL:</span>
                                  <span className="truncate">{dbSettings[baseUrlKey]?.value || model.defaultBaseUrl}</span>
                                </div>
                              )}
                              {modelConfigured && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground/60">模型:</span>
                                  <span>{dbSettings[modelKey]?.value || model.defaultModel}</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(model)}
                    className="gap-1.5"
                  >
                    <Edit3 className="h-3 w-3" />
                    编辑
                  </Button>
                  {model.canBeDefault && !isDefault && configured && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetDefault(model)}
                      className="gap-1.5"
                    >
                      <Star className="h-3 w-3" />
                      设为默认
                    </Button>
                  )}
                  {(configured || model.isCustom) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(model)}
                      className="ml-auto gap-1.5 text-graveyard hover:bg-graveyard/10"
                    >
                      <Trash2 className="h-3 w-3" />
                      移除
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 空状态 - 该分类暂无模型 */
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
            {MODEL_CATEGORIES.find((c) => c.key === activeCategory)?.icon}
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">该分类暂无模型</div>
            <div className="mt-1 text-xs text-muted-foreground">
              点击下方按钮添加 {MODEL_CATEGORIES.find((c) => c.key === activeCategory)?.desc} 模型
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAddModal(true)} className="gap-1.5">
            <Plus className="h-3 w-3" />
            添加自定义模型
          </Button>
        </div>
      )}

      {/* 编辑弹窗 - z-[200] 确保最上层可见 */}
      {editingModel && (
        <Modal
          open={true}
          onClose={() => setEditingModel(null)}
          title={`配置 ${editingModel.name}`}
          className="z-[200]"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">API Key</label>
              <input
                type="password"
                value={editForm.apiKey}
                onChange={(e) => setEditForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={
                  editingModel.isCustom
                    ? editingModel._customApiKey
                      ? `已配置 ${editingModel._customApiKey.slice(0, 6)}***，输入新值可覆盖`
                      : `输入 ${editingModel.name} API Key`
                    : dbSettings[`${editingModel.id}ApiKey`]?.configured
                      ? `已配置 ${dbSettings[`${editingModel.id}ApiKey`].value}，输入新值可覆盖`
                      : `输入 ${editingModel.name} API Key`
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
              />
              <p className="mt-1 text-xs text-muted-foreground">留空表示不修改已保存的 Key</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Base URL</label>
              <input
                type="text"
                value={editForm.baseUrl}
                onChange={(e) => setEditForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder={editingModel.defaultBaseUrl}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">模型名称</label>
              <input
                type="text"
                value={editForm.model}
                onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
                placeholder={editingModel.defaultModel}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingModel(null)}>
                取消
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 保存中...</>
                ) : (
                  <><Save className="h-3.5 w-3.5" /> 保存</>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 新增模型弹窗 */}
      {showAddModal && (
        <Modal
          open={true}
          onClose={() => setShowAddModal(false)}
          title="新增自定义模型"
          size="lg"
          className="z-[200]"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">模型名称 *</label>
                <input
                  type="text"
                  value={newModel.name}
                  onChange={(e) => setNewModel((f) => ({ ...f, name: e.target.value }))}
                  placeholder="如：通义千问"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">提供商 *</label>
                <input
                  type="text"
                  value={newModel.provider}
                  onChange={(e) => setNewModel((f) => ({ ...f, provider: e.target.value }))}
                  placeholder="如：阿里云"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">模型分类</label>
              <select
                value={newModel.category}
                onChange={(e) => setNewModel((f) => ({ ...f, category: e.target.value as ModelCategory }))}
                className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
              >
                {MODEL_CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>{cat.label} - {cat.desc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">描述</label>
              <input
                type="text"
                value={newModel.desc}
                onChange={(e) => setNewModel((f) => ({ ...f, desc: e.target.value }))}
                placeholder="简要描述模型用途"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Base URL</label>
              <input
                type="text"
                value={newModel.baseUrl}
                onChange={(e) => setNewModel((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://api.example.com/v1"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">模型 ID</label>
              <input
                type="text"
                value={newModel.model}
                onChange={(e) => setNewModel((f) => ({ ...f, model: e.target.value }))}
                placeholder="如：qwen-turbo"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">API Key</label>
              <input
                type="password"
                value={newModel.apiKey}
                onChange={(e) => setNewModel((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="sk-xxxxxxxxxxxx（可选，稍后也可在编辑中填写）"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-cognition"
              />
            </div>
            <div className="ios-glass-sm rounded-lg p-3 text-xs text-foreground/80">
              💡 自定义模型保存在浏览器本地（localStorage），仅供展示与配置管理。实际调用需后端适配对应 Provider。
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                取消
              </Button>
              <Button onClick={handleAddModel}>
                <Plus className="h-3.5 w-3.5" /> 添加模型
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
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
      className="ios-glass-sm flex items-center gap-3 rounded-md p-3 text-xs transition-colors hover:border-northstar/50 hover:bg-primary/10"
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
  // 安装引导弹窗
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [dashboardOnline, setDashboardOnline] = useState<boolean | null>(null);
  const [checkingDashboard, setCheckingDashboard] = useState(false);
  const [installCmdCopied, setInstallCmdCopied] = useState(false);
  const [startCmdCopied, setStartCmdCopied] = useState(false);
  const [installViaDashboardLoading, setInstallViaDashboardLoading] = useState(false);

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
    // 每 30 秒自动刷新状态（仅在页面可见时执行，避免后台 tab 持续请求）
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(loadStatus, 30_000);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        start();
        loadStatus();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
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

  // 检测本地 Dashboard (127.0.0.1:9119) 是否在线
  const checkLocalDashboard = async (): Promise<boolean> => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const resp = await fetch("http://127.0.0.1:9119/", { signal: ctrl.signal });
      clearTimeout(timer);
      return resp.ok || resp.status === 200 || resp.status === 404;
    } catch {
      return false;
    }
  };

  // 通过 Dashboard HTTP API 安装/升级 HermesAgent（Dashboard 已在线时）
  const installViaDashboard = async () => {
    setInstallViaDashboardLoading(true);
    try {
      const resp = await fetch("http://127.0.0.1:9119/api/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install" }),
        signal: AbortSignal.timeout(180_000),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success !== false) {
        toast(data.message || "HermesAgent 安装/升级成功", "success");
        await loadStatus();
        setShowInstallGuide(false);
      } else {
        toast(data.error || data.message || "Dashboard 安装失败", "error");
      }
    } catch (e: any) {
      toast("通过 Dashboard 安装失败：" + e.message + "。请改用命令行 pip install hermes-agent", "error");
    } finally {
      setInstallViaDashboardLoading(false);
    }
  };

  // 打开安装引导弹窗时自动检测本地 Dashboard
  const openInstallGuide = async () => {
    setShowInstallGuide(true);
    setDashboardOnline(null);
    setCheckingDashboard(true);
    const online = await checkLocalDashboard();
    setDashboardOnline(online);
    setCheckingDashboard(false);
  };

  // 在弹窗内点击"重新检测"
  const recheckDashboard = async () => {
    setCheckingDashboard(true);
    setDashboardOnline(null);
    const online = await checkLocalDashboard();
    setDashboardOnline(online);
    setCheckingDashboard(false);
    if (online) {
      toast("检测到本地 Dashboard 已在线，可直接安装/升级", "success");
      await loadStatus();
    }
  };

  const copyToClipboard = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      // 降级方案
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setter(true);
      setTimeout(() => setter(false), 2000);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      if (isDesktop()) {
        // 桌面端：调用 Tauri command 在用户本地执行 pip install
        const result = await installAiEnv();
        if (result.success) {
          toast(result.message || "Lynx Agent 安装成功", "success");
          await loadStatus();
        } else {
          toast(result.message || "安装失败", "error");
        }
      } else {
        // Web 端：打开安装引导弹窗（不是只弹个提示）
        // 弹窗会自动检测本地 Dashboard，在线则调用 Dashboard 安装 API，不在线则显示命令行步骤
        await openInstallGuide();
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
      if (isDesktop()) {
        // 桌面端：调用 Tauri command 启动 Dashboard + WS 注册
        await startHermesAgent();
        toast("Lynx Agent 已启动，PC 已上线", "success");
        await loadStatus();
      } else {
        // Web 端：浏览器无法 spawn 进程，提示命令行启动方式
        // Web 端打开后会自动探测本地 Dashboard 并通过 WS 注册为在线设备
        toast(
          "浏览器无法直接启动 HermesAgent。\n" +
          "请在命令行运行 `hermes dashboard --port 9119` 启动 Dashboard，\n" +
          "Web 端会自动探测到本地 Dashboard 并注册为在线设备。",
          "error"
        );
      }
    } catch (e: any) {
      toast("启动请求失败：" + e.message, "error");
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (isDesktop()) {
      // 桌面端：调用 Tauri command 停止本地 hermes
      try {
        await startHermesAgent(); // TODO: 桌面端应提供 stop_hermes_agent command
        toast("Lynx Agent 已停止", "success");
        await loadStatus();
      } catch (e: any) {
        toast("停止失败：" + e.message, "error");
      }
    } else {
      // Web 端：浏览器无法停止本地进程，提示命令行停止方式
      toast(
        "浏览器无法直接停止 HermesAgent。\n" +
        "请在运行 Dashboard 的命令行按 Ctrl+C 停止，" +
        "或在桌面端「设置 → Lynx Agent」点击「停止 Lynx Agent」。",
        "error"
      );
    }
  };

  // 打开 Dashboard
  // - 桌面端：通过 Tauri 启动 Dashboard + 打开 endpoint
  // - Web 端：直接探测本地 127.0.0.1:9119，在线则打开，不在线则提示启动方式
  //   （Web 端本身可以单独使用 HermesAgent，只要本机 Dashboard 在运行）
  const handleOpenDashboard = async () => {
    setOpeningDashboard(true);
    try {
      if (isDesktop()) {
        // 桌面端：通过 Tauri 启动 Dashboard（如果未运行）+ 打开 endpoint
        const running = status?.config?.status === "running";
        if (!running) {
          await startHermesAgent();
          toast("Lynx Agent 已启动，正在打开 Dashboard...", "success");
          await loadStatus();
          // 等待 1.5 秒让 HTTP 服务完全就绪
          await new Promise((r) => setTimeout(r, 1500));
        }
        window.open(endpoint, "_blank", "noopener,noreferrer");
      } else {
        // Web 端：探测本地 HermesAgent Dashboard（127.0.0.1:9119）
        // 浏览器 fetch localhost 需要 Dashboard 支持 CORS
        const dashboardUrl = "http://127.0.0.1:9119";
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 3000);
          await fetch(dashboardUrl + "/", { signal: ctrl.signal });
          clearTimeout(timer);
          // Dashboard 在线，直接打开
          window.open(dashboardUrl, "_blank", "noopener,noreferrer");
        } catch {
          // Dashboard 不在线：提示用户启动方式
          toast(
            "未检测到本地 HermesAgent Dashboard（127.0.0.1:9119）。\n" +
            "请在命令行运行 `hermes dashboard --port 9119` 启动，" +
            "或在桌面端「设置 → Lynx Agent」点击「启动 Lynx Agent」。",
            "error"
          );
        }
      }
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
      <Section icon={<img src="/lynx-icon-64.png" alt="Lynx" className="h-4 w-4 rounded-sm" />} title="Lynx Agent（本地 AI 代理）">
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
      icon={<img src="/lynx-icon-64.png" alt="Lynx" className="h-4 w-4 rounded-sm" />}
      title="Lynx Agent（本地 AI 代理）"
    >
      {/* 说明 */}
      <div className="mb-4 rounded-xl border border-northstar/20 bg-northstar/5 p-4 text-sm text-foreground/80">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <img src="/lynx-icon-64.png" alt="Lynx" className="h-5 w-5 rounded-sm" />
            Lynx Agent 是什么？
          </div>
          <button
            type="button"
            onClick={handleOpenDashboard}
            disabled={openingDashboard}
            className="inline-flex items-center gap-1 text-xs text-campaign hover:underline disabled:opacity-50"
            title={isInstalled ? "确保 Dashboard 服务已启动并在新标签页打开" : "请先安装 Lynx Agent"}
          >
            {openingDashboard ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> 启动中...</>
            ) : (
              <><ExternalLink className="h-3 w-3" /> 打开 Dashboard</>
            )}
          </button>
        </div>
        <p className="leading-relaxed">
          基于 Hermes Agent 技术深度定制开发，让 AI 助理升级为 Lynx 超级助理，可以直接操控你的电脑（桌面控制、Shell 命令、浏览器控制），并拥有自主学习与自我成长能力。所有操作在本地执行，数据不出本机。
        </p>
      </div>

      {/* 安装状态 - 卡片式 */}
      <div className="mb-4 space-y-2">
        <div className="ios-glass-sm flex items-center justify-between rounded-xl p-4">
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full ${
              isRunning ? "bg-green-500" : isInstalled ? "bg-yellow-500" : "bg-gray-400"
            }`} />
            <div>
              <span className="text-sm font-medium text-foreground">
                {isRunning ? "运行中" : isInstalled ? "已安装（未运行）" : "未安装"}
              </span>
              {status?.installVersion && (
                <span className="ml-2 text-xs text-muted-foreground">v{status.installVersion}</span>
              )}
              {isConnected && status?.version && (
                <span className="ml-2 text-xs text-green-600">· 已连接</span>
              )}
            </div>
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
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 安装中...</>
                ) : (
                  <><Rocket className="h-3.5 w-3.5" /> 一键安装</>
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
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 启动中...</>
                ) : (
                  <><Play className="h-3.5 w-3.5" /> 启动服务</>
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
                <Square className="h-3.5 w-3.5" /> 停止
              </Button>
            )}
          </div>
        </div>

        {status?.config?.lastError && (
          <div className="rounded-lg border border-red-300/30 bg-red-50/50 p-2.5 text-xs text-red-600">
            ⚠️ {status.config.lastError}
          </div>
        )}
      </div>

      {/* 模型配置（LLM Provider）— 卡片式 */}
      {isInstalled && (
        <div className="mb-4 rounded-xl glass-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${
                modelConfigured === true ? "bg-green-500" : modelConfigured === false ? "bg-red-500" : "bg-gray-400"
              }`} />
              <div>
                <span className="text-sm font-medium text-foreground">LLM 模型配置</span>
                {modelConfigured === true ? (
                  <span className="ml-2 text-xs text-green-600">· 已配置</span>
                ) : modelConfigured === false ? (
                  <span className="ml-2 text-xs text-red-600">· 未配置（任务会失败）</span>
                ) : (
                  <span className="ml-2 text-xs text-muted-foreground">· 检测中</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 模型 provider 选择器 */}
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as "deepseek" | "mimo" | "auto")}
                disabled={configuringModel}
                className="h-8 appearance-none rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-campaign disabled:opacity-50"
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
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 配置中...</>
                ) : modelConfigured ? (
                  <><RefreshCw className="h-3.5 w-3.5" /> 重新配置</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> 一键配置模型</>
                )}
              </Button>
            </div>
          </div>
          {modelConfigured === false && (
            <div className="mt-2 text-xs text-foreground/80">
              Hermes 需要配置 LLM 模型才能执行任务。点击「一键配置模型」会自动复用上方 AI 模型管理中的 DeepSeek / MiMo API Key。
            </div>
          )}
          {availableModels.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              已配置的 Provider：
              {availableModels.map((m) => ` ${m.provider}（${m.model}）`).join("、")}
              {defaultProvider && defaultProvider !== "auto" ? `　默认：${defaultProvider}` : ""}
            </div>
          )}
        </div>
      )}

      {/* 快速执行（仅在运行中时显示） */}
      {isRunning && (
        <div className="mb-4 rounded-xl border border-campaign/30 bg-campaign/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-campaign" />
            <span className="text-sm font-medium text-foreground">快速执行任务</span>
            <span className="text-xs text-muted-foreground">直接在这里让 Lynx Agent 执行任务</span>
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
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              disabled={quickExecuting}
            />
            <Button
              size="sm"
              onClick={handleQuickExecute}
              disabled={quickExecuting || !quickTask.trim()}
              className="gap-1.5"
            >
              {quickExecuting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 执行中...</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> 执行</>
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
                className="rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-campaign/40 hover:text-campaign disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>

          {/* 执行结果 */}
          {quickResult && (
            <div className="mt-3 rounded-lg border border-border bg-background p-3">
              <div className="mb-1 flex items-center justify-between text-xs">
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
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs text-foreground">
                  {quickResult.output}
                </pre>
              ) : (
                <div className="text-xs text-graveyard">{quickResult.error}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 配置表单 - 卡片式 */}
      <div className="space-y-4">
        {/* 启用开关 */}
        <div className="ios-glass-sm flex items-center justify-between rounded-xl p-3">
          <div>
            <div className="text-sm font-medium text-foreground">启用 Lynx Agent 集成</div>
            <div className="text-xs text-muted-foreground">开启后 AI 助理和工作流可调用 Lynx Agent</div>
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

        {/* 端点和 API Key - 网格布局 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Lynx Agent 端点</label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="http://localhost:9119"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">API Key（可选）</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="如启用了鉴权则填写"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
        </div>

        {/* 能力配置 - 卡片网格 */}
        <div>
          <div className="mb-2 text-sm font-medium text-foreground">能力配置</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ALL_CAPABILITIES.map((cap) => (
              <label
                key={cap.key}
                className={`flex cursor-pointer items-start gap-2 rounded-xl p-3 text-sm transition-colors ios-glass-sm ${
                  capabilities.includes(cap.key) ? "border border-northstar/40 bg-northstar/5" : ""
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
                  <div className="text-xs text-muted-foreground">{cap.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 自动启动 */}
        <div className="ios-glass-sm flex items-center justify-between rounded-xl p-3">
          <div>
            <div className="text-sm font-medium text-foreground">随系统自动启动</div>
            <div className="text-xs text-muted-foreground">服务启动时自动拉起 Lynx Agent</div>
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
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存配置
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testing || !isInstalled}
            className="gap-1.5"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            测试连接
          </Button>
        </div>
      </div>

      {/* 安装引导弹窗（Web 端独立安装 HermesAgent） */}
      <Modal
        open={showInstallGuide}
        onClose={() => setShowInstallGuide(false)}
        title="安装 Lynx Agent（HermesAgent）"
        size="lg"
      >
        <div className="space-y-4 text-sm">
          {/* 状态检测 */}
          <div className="ios-glass-sm rounded-xl p-4">
            <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <Cpu className="h-4 w-4 text-northstar" />
              本地 Dashboard 状态检测
            </div>
            {checkingDashboard ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在检测 127.0.0.1:9119 ...
              </div>
            ) : dashboardOnline === null ? (
              <div className="text-muted-foreground">未检测</div>
            ) : dashboardOnline ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Dashboard 在线（127.0.0.1:9119）
                </div>
                <p className="text-xs text-foreground/70">
                  检测到本地 Dashboard 已运行，可直接通过 Dashboard 安装/升级 HermesAgent。
                </p>
                <Button
                  onClick={installViaDashboard}
                  disabled={installViaDashboardLoading}
                  className="gap-1.5"
                >
                  {installViaDashboardLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 安装中（pip install 可能需要 1-3 分钟）...</>
                  ) : (
                    <><Rocket className="h-3.5 w-3.5" /> 通过 Dashboard 一键安装/升级</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-orange-600">
                  <XCircle className="h-4 w-4" />
                  Dashboard 未运行
                </div>
                <p className="text-xs text-foreground/70">
                  本地未检测到 HermesAgent Dashboard。请按下方步骤安装并启动。
                </p>
              </div>
            )}
            <button
              onClick={recheckDashboard}
              disabled={checkingDashboard}
              className="mt-2 inline-flex items-center gap-1 text-xs text-campaign hover:underline disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" />
              重新检测
            </button>
          </div>

          {/* 命令行安装步骤 */}
          <div className="space-y-3">
            <div className="font-medium text-foreground">命令行安装步骤</div>

            {/* 步骤1 */}
            <div className="ios-glass-sm rounded-xl p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-medium text-foreground">① 安装 HermesAgent</span>
                <button
                  onClick={() => copyToClipboard("pip install hermes-agent", setInstallCmdCopied)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                >
                  {installCmdCopied ? <CheckCircle2 className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
                  {installCmdCopied ? "已复制" : "复制"}
                </button>
              </div>
              <code className="block rounded-md bg-black/5 px-3 py-2 text-xs text-foreground">
                pip install hermes-agent
              </code>
              <p className="mt-1 text-xs text-muted-foreground">
                在命令行（CMD / PowerShell / Terminal）中执行。需要已安装 Python 3.9+ 和 pip。
              </p>
            </div>

            {/* 步骤2 */}
            <div className="ios-glass-sm rounded-xl p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-medium text-foreground">② 启动 Dashboard 服务</span>
                <button
                  onClick={() => copyToClipboard("hermes dashboard --port 9119", setStartCmdCopied)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                >
                  {startCmdCopied ? <CheckCircle2 className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
                  {startCmdCopied ? "已复制" : "复制"}
                </button>
              </div>
              <code className="block rounded-md bg-black/5 px-3 py-2 text-xs text-foreground">
                hermes dashboard --port 9119
              </code>
              <p className="mt-1 text-xs text-muted-foreground">
                启动后保持命令行窗口不关闭。Web 端会自动探测到本地 Dashboard 并注册为在线设备。
              </p>
            </div>

            {/* 步骤3 */}
            <div className="ios-glass-sm rounded-xl p-3">
              <div className="mb-1.5 font-medium text-foreground">③ 安装完成后回到这里</div>
              <p className="text-xs text-muted-foreground">
                启动 Dashboard 后，点击上方「重新检测」按钮，确认 Dashboard 在线后即可使用。
                Web 端和桌面端共享同一个 HermesAgent，无需重复安装。
              </p>
            </div>
          </div>

          {/* 底部操作 */}
          <div className="flex items-center justify-between border-t border-border/40 pt-3">
            <span className="text-xs text-muted-foreground">
              Web 端和桌面端共用一个 HermesAgent，只需在一端安装。
            </span>
            <Button variant="outline" size="sm" onClick={() => setShowInstallGuide(false)}>
              关闭
            </Button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

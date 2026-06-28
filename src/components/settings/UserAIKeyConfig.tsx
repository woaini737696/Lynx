"use client";

import { useEffect, useState } from "react";
import { Key, Loader2, Save, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Card, Button, Badge } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/toast";

/**
 * 用户级 AI Key 配置组件
 * 允许用户配置自己的 DeepSeek/MiMo API Key，优先于管理员全局配置
 */
export function UserAIKeyConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deepseekKey, setDeepseekKey] = useState("");
  const [mimoKey, setMimoKey] = useState("");
  const [preferredProvider, setPreferredProvider] = useState<string>("");
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [showMimoKey, setShowMimoKey] = useState(false);
  const [maskedDeepseek, setMaskedDeepseek] = useState<string | null>(null);
  const [maskedMimo, setMaskedMimo] = useState<string | null>(null);
  const [allowedProviders, setAllowedProviders] = useState<string[] | null>(null);
  const [hasDeepseek, setHasDeepseek] = useState(false);
  const [hasMimo, setHasMimo] = useState(false);
  // 清除 Key 二次确认
  const [confirmClear, setConfirmClear] = useState<"deepseek" | "mimo" | null>(null);

  useEffect(() => {
    void loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/ai-keys");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setMaskedDeepseek(data.deepseekApiKey);
      setMaskedMimo(data.mimoApiKey);
      setPreferredProvider(data.preferredProvider || "");
      setAllowedProviders(data.allowedProviders);
      setHasDeepseek(data.hasDeepseekKey);
      setHasMimo(data.hasMimoKey);
    } catch (e) {
      toast("加载 AI Key 配置失败：" + (e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (deepseekKey !== "") body.deepseekApiKey = deepseekKey;
      if (mimoKey !== "") body.mimoApiKey = mimoKey;
      if (preferredProvider !== undefined) body.preferredProvider = preferredProvider || null;

      const res = await fetch("/api/user/ai-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "保存失败");
      }
      toast("AI Key 配置已保存", "success");
      setDeepseekKey("");
      setMimoKey("");
      void loadConfig();
    } catch (e) {
      toast("保存失败：" + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  // 触发清除二次确认（用自定义 Modal 替代 confirm()）
  const handleClear = (provider: "deepseek" | "mimo") => {
    setConfirmClear(provider);
  };

  // 实际执行清除
  const performClear = async (provider: "deepseek" | "mimo") => {
    setSaving(true);
    try {
      const body = provider === "deepseek"
        ? { deepseekApiKey: "" }
        : { mimoApiKey: "" };
      const res = await fetch("/api/user/ai-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("清除失败");
      toast(`${provider === "deepseek" ? "DeepSeek" : "MiMo"} Key 已清除`, "success");
      setConfirmClear(null);
      void loadConfig();
    } catch (e) {
      toast("清除失败：" + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-5 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载 AI Key 配置...
        </div>
      </Card>
    );
  }

  const isProviderAllowed = (p: string) => !allowedProviders || allowedProviders.includes(p);

  return (
    <>
    <Card className="mb-5">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-cognition" />
          <h3 className="text-sm font-semibold text-foreground">我的 AI 大模型 Key</h3>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          配置自己的 API Key 后将优先使用你的 Key（不再消耗管理员配额）。留空则使用管理员配置的全局 Key。
        </p>
        {allowedProviders && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">职业允许的模型：</span>
            {allowedProviders.map((p) => (
              <Badge key={p} color="cognition">{p}</Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 p-4">
        {/* 默认 Provider 选择 */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-foreground">默认大模型</label>
          <select
            value={preferredProvider}
            onChange={(e) => setPreferredProvider(e.target.value)}
            className="ios-glass-sm w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">（使用全局默认）</option>
            {isProviderAllowed("deepseek") && <option value="deepseek">DeepSeek</option>}
            {isProviderAllowed("mimo") && <option value="mimo">MiMo</option>}
          </select>
        </div>

        {/* DeepSeek Key */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">DeepSeek API Key</label>
            {hasDeepseek && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-cognition">已配置：{maskedDeepseek}</span>
                <button
                  onClick={() => handleClear("deepseek")}
                  className="text-[10px] text-graveyard hover:underline"
                >
                  清除
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <input
              type={showDeepseekKey ? "text" : "password"}
              value={deepseekKey}
              onChange={(e) => setDeepseekKey(e.target.value)}
              placeholder={hasDeepseek ? "输入新 Key 覆盖（留空保持不变）" : "sk-xxxxxxxxxxxxxxxxxxxx"}
              className="ios-glass-sm w-full rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={!isProviderAllowed("deepseek")}
            />
            <button
              type="button"
              onClick={() => setShowDeepseekKey(!showDeepseekKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showDeepseekKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* MiMo Key */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">MiMo API Key</label>
            {hasMimo && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-cognition">已配置：{maskedMimo}</span>
                <button
                  onClick={() => handleClear("mimo")}
                  className="text-[10px] text-graveyard hover:underline"
                >
                  清除
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <input
              type={showMimoKey ? "text" : "password"}
              value={mimoKey}
              onChange={(e) => setMimoKey(e.target.value)}
              placeholder={hasMimo ? "输入新 Key 覆盖（留空保持不变）" : "xxxxxxxxxxxxxxxxxxxx"}
              className="ios-glass-sm w-full rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={!isProviderAllowed("mimo")}
            />
            <button
              type="button"
              onClick={() => setShowMimoKey(!showMimoKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showMimoKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving || (deepseekKey === "" && mimoKey === "" && preferredProvider === undefined)}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            保存配置
          </Button>
        </div>

        {/* 提示 */}
        <div className="ios-glass-sm rounded-lg p-3 text-[11px] text-muted-foreground">
          <p className="mb-1 flex items-center gap-1 font-medium text-foreground">
            <CheckCircle2 className="h-3 w-3 text-cognition" />
            配置提示
          </p>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>配置你自己的 Key 后，AI 对话将消耗你的配额，不影响管理员配额</li>
            <li>Key 加密存储在数据库中，仅你本人可查看和修改</li>
            <li>如职业工作空间限制了允许的模型，只能使用允许列表内的模型</li>
            <li>留空则使用管理员配置的全局 Key（默认无需配置）</li>
          </ul>
        </div>
      </div>
    </Card>

    {/* 清除 Key 二次确认弹窗（替代 confirm()） */}
    <Modal
      open={confirmClear !== null}
      onClose={() => setConfirmClear(null)}
      title="确认清除 Key"
      size="sm"
    >
      {confirmClear && (
        <>
          <p className="text-sm text-muted-foreground">
            确定要清除{confirmClear === "deepseek" ? "DeepSeek" : "MiMo"}的 API Key 吗？清除后将使用管理员配置的全局 Key。
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmClear(null)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={saving}
              onClick={() => performClear(confirmClear)}
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 清除中...
                </>
              ) : (
                "确认清除"
              )}
            </Button>
          </div>
        </>
      )}
    </Modal>
    </>
  );
}

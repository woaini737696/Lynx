"use client";

import { Plus, Settings, MessageSquare, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { ModelSwitcher } from "@/components/ui/ModelSwitcher";
import type { ModelSwitcherValue } from "@/components/ui/ModelSwitcher";
import type { AISettings } from "../types";

interface HeaderProps {
  settings: AISettings;
  showSessionList: boolean;
  setShowSessionList: React.Dispatch<React.SetStateAction<boolean>>;
  createNewSession: () => Promise<void>;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  modelConfig: ModelSwitcherValue;
  setModelConfig: React.Dispatch<React.SetStateAction<ModelSwitcherValue>>;
  confirmClear: boolean;
  clearConversation: () => void;
}

export function Header(props: HeaderProps) {
  const { settings, setShowSessionList, createNewSession, setSettingsOpen, modelConfig, setModelConfig, confirmClear, clearConversation } = props;
  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm">
            {settings.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-base leading-none">{settings.assistantAvatar}</span>
            )}
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">奇思超级助理 {settings.assistantName !== "Lynn" && <span className="text-cognition">· {settings.assistantName}</span>}</h1>
            <p className="text-xs text-muted-foreground">基于你的记忆图谱和认知库提供个性化协助</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowSessionList((v) => !v)} title="历史对话">
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={createNewSession} title="新对话">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)} title="设置">
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <ModelSwitcher value={modelConfig} onChange={setModelConfig} />
          <HelpButton contentKey="ai-assistant" />
          <Button
            size="sm"
            variant={confirmClear ? "danger" : "ghost"}
            onClick={clearConversation}
            title="清空对话"
          >
            {confirmClear ? <><Check className="h-3 w-3" /> 确认清空</> : <><Trash2 className="h-3 w-3" /> 清空</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

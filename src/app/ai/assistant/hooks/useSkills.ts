"use client";

import { useState, useMemo } from "react";
import { toast } from "@/components/ui/toast";
import type { Skill, Message } from "../types";
import type { ModelSwitcherValue } from "@/components/ui/ModelSwitcher";

interface UseSkillsParams {
  modelConfig: ModelSwitcherValue;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  currentSessionId: string | null;
}

/** 技能面板：技能列表、收藏、历史、Hermes 技能、执行 */
export function useSkills(params: UseSkillsParams) {
  const { modelConfig, setMessages, currentSessionId } = params;
  const [showSkillPanel, setShowSkillPanel] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [skillParams, setSkillParams] = useState<Record<string, string>>({});
  const [skillExecuting, setSkillExecuting] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [skillCategory, setSkillCategory] = useState("all");
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillTab, setSkillTab] = useState<"all" | "favorites" | "history" | "hermes">("all");
  const [favorites, setFavorites] = useState<Array<{ skillId: string; skillName: string; source: string; category: string }>>([]);
  const [executions, setExecutions] = useState<Array<{ id: string; skillId: string; skillName: string; source: string; success: boolean; durationMs: number; result: string; error: string | null; createdAt: string }>>([]);
  const [hermesSkills, setHermesSkills] = useState<Skill[]>([]);
  const [hermesSource, setHermesSource] = useState<"hermes" | "database" | "filesystem">("hermes");
  const [hermesRunning, setHermesRunning] = useState<boolean>(false);
  const [hermesPreloading, setHermesPreloading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const fetchSkills = async () => {
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      const skillsList = Array.isArray(data.data) ? data.data : (Array.isArray(data.skills) ? data.skills : (Array.isArray(data) ? data : []));
      setSkills(skillsList);
    } catch {
      toast("加载技能失败", "error");
    } finally {
      setSkillsLoading(false);
    }
  };

  const executeSkill = async () => {
    if (!selectedSkill) return;
    for (const p of selectedSkill.parameters) {
      if (p.required && !skillParams[p.key]?.trim()) {
        toast(`请填写 ${p.label}`, "error");
        return;
      }
    }
    setSkillExecuting(true);
    try {
      let resultText = "";
      if (selectedSkill.source === "hermes" && selectedSkill.originalId) {
        const res = await fetch("/api/hermes/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: Object.entries(skillParams).map(([k, v]) => `${k}: ${v}`).join("\n"),
            mode: "auto",
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast(data.error || "Hermes 执行失败", "error");
          return;
        }
        resultText = data.output || "（无输出）";
      } else {
        const res = await fetch("/api/ai/distill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selectedSkill.id,
            parameters: skillParams,
            provider: modelConfig.provider === "mimo" ? "mimo" : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error || "执行失败", "error");
          return;
        }
        resultText = data.result;
      }
      const newMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `**已执行技能：${selectedSkill.name}**\n\n${resultText}`,
        time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, newMsg]);
      if (currentSessionId) {
        fetch(`/api/ai/chat/sessions/${currentSessionId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "assistant", content: newMsg.content }),
        }).then((r) => r.json()).then((data) => {
          if (data.message?.id) {
            setMessages((prev) => prev.map((m) => (m.id === newMsg.id ? { ...m, id: data.message.id } : m)));
          }
        }).catch(() => {});
      }
      setShowSkillPanel(false);
      setSelectedSkill(null);
      setSkillParams({});
      toast("技能执行完成", "success");
    } catch (e) {
      toast("执行错误：" + (e as Error).message, "error");
    } finally {
      setSkillExecuting(false);
    }
  };

  const openSkillPanel = () => {
    setShowSkillPanel(true);
    setSelectedSkill(null);
    setSkillParams({});
    setSkillSearch("");
    setSkillCategory("all");
    setSkillTab("all");
    fetchSkills();
    fetchFavorites();
    fetchExecutions();
  };

  const fetchFavorites = async () => {
    try {
      const res = await fetch("/api/skills/favorites");
      const data = await res.json();
      if (Array.isArray(data.favorites)) {
        setFavorites(data.favorites);
        setFavoriteIds(new Set(data.favorites.map((f: { skillId: string }) => f.skillId)));
      }
    } catch { /* 静默失败 */ }
  };

  const fetchExecutions = async () => {
    try {
      const res = await fetch("/api/skills/executions?limit=30");
      const data = await res.json();
      if (Array.isArray(data.executions)) {
        setExecutions(data.executions);
      }
    } catch { /* 静默失败 */ }
  };

  const fetchHermesSkills = async () => {
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/hermes/skills");
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "加载 Hermes 技能失败", "error");
        setHermesSkills([]);
        return;
      }
      setHermesSource((data.source as "hermes" | "database" | "filesystem") || "hermes");
      setHermesRunning(data.hermesRunning === true);
      if (Array.isArray(data.skills)) {
        setHermesSkills(data.skills.map((s: { id: string; name: string; description: string; category: string; parameters?: Array<{ name?: string; key?: string; label?: string; type?: string; description?: string; required?: boolean; default?: unknown; defaultValue?: string; placeholder?: string; options?: string[] }>; tags?: string[]; usageCount?: number }) => ({
          id: `hermes-${s.id}`,
          name: s.name,
          description: s.description || "",
          category: s.category || "hermes",
          tags: s.tags || [],
          parameters: (s.parameters || []).map((p) => ({
            key: p.key || p.name || "",
            label: p.label || p.name || p.key || "",
            type: p.type === "number" ? "number" : p.type === "select" ? "select" : "text",
            required: p.required || false,
            placeholder: p.placeholder || p.description || "",
            defaultValue: typeof (p.defaultValue ?? p.default) === "string" ? ((p.defaultValue ?? p.default) as string) : "",
            options: p.options || [],
          })),
          usageCount: s.usageCount || 0,
          source: "hermes" as const,
          originalId: s.id,
        })));
      }
    } catch {
      toast("加载 Hermes 技能失败", "error");
      setHermesSkills([]);
    } finally {
      setSkillsLoading(false);
    }
  };

  const handlePreloadHermesSkills = async () => {
    setHermesPreloading(true);
    try {
      const res = await fetch("/api/hermes/skills/preload", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(`已预加载 ${data.count} 个默认技能`, "success");
        await fetchHermesSkills();
      } else {
        toast(data.error || "预加载失败", "error");
      }
    } catch {
      toast("预加载技能失败", "error");
    } finally {
      setHermesPreloading(false);
    }
  };

  const toggleFavorite = async (skillId: string, skillName: string, category: string, source: string = "local") => {
    const isFav = favoriteIds.has(skillId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
    try {
      if (isFav) {
        await fetch(`/api/skills/favorites?skillId=${encodeURIComponent(skillId)}`, { method: "DELETE" });
        setFavorites((prev) => prev.filter((f) => f.skillId !== skillId));
      } else {
        await fetch("/api/skills/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillId, skillName, category, source }),
        });
        setFavorites((prev) => [{ skillId, skillName, source, category }, ...prev]);
      }
    } catch {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(skillId);
        else next.delete(skillId);
        return next;
      });
    }
  };

  const onSelectSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    const initParams: Record<string, string> = {};
    for (const p of skill.parameters) {
      initParams[p.key] = p.defaultValue || "";
    }
    setSkillParams(initParams);
  };

  const filteredSkills = useMemo(() => skills.filter((s) => {
    const matchCategory = skillCategory === "all" || s.category === skillCategory;
    const q = skillSearch.trim().toLowerCase();
    const matchSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q));
    return matchCategory && matchSearch;
  }), [skills, skillCategory, skillSearch]);

  const skillCategories = useMemo(() => Array.from(new Set(skills.map((s) => s.category).filter(Boolean))), [skills]);

  return {
    showSkillPanel, setShowSkillPanel,
    skills, selectedSkill, setSelectedSkill,
    skillParams, setSkillParams,
    skillExecuting,
    skillSearch, setSkillSearch,
    skillCategory, setSkillCategory,
    skillsLoading,
    skillTab, setSkillTab,
    favorites, executions, hermesSkills,
    hermesSource, hermesRunning, hermesPreloading,
    favoriteIds,
    filteredSkills, skillCategories,
    fetchSkills, executeSkill, openSkillPanel,
    fetchFavorites, fetchExecutions, fetchHermesSkills,
    handlePreloadHermesSkills, toggleFavorite, onSelectSkill,
  };
}

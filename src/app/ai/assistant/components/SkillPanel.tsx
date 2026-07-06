"use client";

import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/layout/PageHeader";
import {
  X, Wrench, ChevronRight, Star, History, CheckCircle2, AlertCircle,
  Loader2, Sparkles, Zap,
} from "lucide-react";
import type { Skill } from "../types";

interface FavoriteItem { skillId: string; skillName: string; source: string; category: string; }
interface ExecutionItem { id: string; skillId: string; skillName: string; source: string; success: boolean; durationMs: number; result: string; error: string | null; createdAt: string; }

interface SkillPanelProps {
  showSkillPanel: boolean;
  setShowSkillPanel: React.Dispatch<React.SetStateAction<boolean>>;
  selectedSkill: Skill | null;
  setSelectedSkill: React.Dispatch<React.SetStateAction<Skill | null>>;
  skillParams: Record<string, string>;
  setSkillParams: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  skillExecuting: boolean;
  skillSearch: string;
  setSkillSearch: React.Dispatch<React.SetStateAction<string>>;
  skillCategory: string;
  setSkillCategory: React.Dispatch<React.SetStateAction<string>>;
  skillsLoading: boolean;
  skillTab: "all" | "favorites" | "history" | "hermes";
  setSkillTab: React.Dispatch<React.SetStateAction<"all" | "favorites" | "history" | "hermes">>;
  skills: Skill[];
  favorites: FavoriteItem[];
  executions: ExecutionItem[];
  hermesSkills: Skill[];
  hermesRunning: boolean;
  hermesPreloading: boolean;
  favoriteIds: Set<string>;
  filteredSkills: Skill[];
  skillCategories: string[];
  executeSkill: () => Promise<void>;
  fetchHermesSkills: () => Promise<void>;
  handlePreloadHermesSkills: () => Promise<void>;
  toggleFavorite: (skillId: string, skillName: string, category: string, source?: string) => Promise<void>;
  onSelectSkill: (skill: Skill) => void;
}

export function SkillPanel(props: SkillPanelProps) {
  const {
    showSkillPanel, setShowSkillPanel, selectedSkill, setSelectedSkill,
    skillParams, setSkillParams, skillExecuting, skillSearch, setSkillSearch,
    skillCategory, setSkillCategory, skillsLoading, skillTab, setSkillTab,
    skills, favorites, executions, hermesSkills, hermesRunning, hermesPreloading,
    favoriteIds, filteredSkills, skillCategories, executeSkill,
    fetchHermesSkills, handlePreloadHermesSkills, toggleFavorite, onSelectSkill,
  } = props;

  if (!showSkillPanel) return null;

  const closePanel = () => {
    if (!skillExecuting) {
      setShowSkillPanel(false);
      setSelectedSkill(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={closePanel}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl glass-modal" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            {selectedSkill && (
              <button
                onClick={() => { setSelectedSkill(null); setSkillParams({}); }}
                className="text-muted-foreground hover:text-foreground"
                title="返回技能列表"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
            )}
            <Wrench className="h-4 w-4 text-cognition" />
            <h2 className="text-sm font-semibold">{selectedSkill ? selectedSkill.name : "选择技能"}</h2>
          </div>
          <button onClick={closePanel} className="rounded-full p-1 hover:bg-primary/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容区 */}
        {!selectedSkill ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Tab 导航 */}
            <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 pt-2">
              {([
                { key: "all", label: "全部" },
                { key: "favorites", label: `收藏${favorites.length > 0 ? ` (${favorites.length})` : ""}` },
                { key: "history", label: "历史" },
                { key: "hermes", label: "Hermes" },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setSkillTab(tab.key);
                    if (tab.key === "hermes" && hermesSkills.length === 0) fetchHermesSkills();
                  }}
                  className={cn(
                    "border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                    skillTab === tab.key
                      ? "border-cognition text-cognition"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 全部技能 / Hermes 技能：搜索 + 分类筛选 + 列表 */}
            {(skillTab === "all" || skillTab === "hermes") && (
              <>
                <div className="shrink-0 space-y-2 border-b border-border px-5 py-3">
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    placeholder="搜索技能名称、描述或标签..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                  />
                  {skillTab === "all" && skillCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSkillCategory("all")}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] transition-colors",
                          skillCategory === "all" ? "bg-cognition/10 text-cognition" : "ios-glass-sm text-muted-foreground hover:text-primary"
                        )}
                      >
                        全部
                      </button>
                      {skillCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSkillCategory(cat)}
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] transition-colors",
                            skillCategory === cat ? "bg-cognition/10 text-cognition" : "ios-glass-sm text-muted-foreground hover:text-primary"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                  {skillTab === "hermes" && (
                    <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-2 text-[10px] text-primary">
                      奇思 Skills Hub 提供 672+ 官方技能，需先在设置中启用奇思 Agent。
                    </div>
                  )}
                  {skillsLoading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="text-sm">加载中...</span>
                    </div>
                  ) : (skillTab === "all" ? filteredSkills : hermesSkills).length === 0 ? (
                    skillTab === "hermes" ? (
                      <div className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">
                          {hermesRunning
                            ? "暂无 Hermes 技能。点击「预加载默认技能」加载 6 个奇思专用技能。"
                            : "奇思 Agent 未运行，显示已学习的技能。点击「预加载默认技能」可添加技能。"}
                        </p>
                        <Button size="sm" variant="outline" onClick={handlePreloadHermesSkills} disabled={hermesPreloading}>
                          {hermesPreloading ? (
                            <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> 预加载中...</>
                          ) : (
                            <><Sparkles className="mr-1 h-3 w-3" /> 预加载默认技能</>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        {skills.length === 0 ? "暂无可用技能" : "未找到匹配的技能"}
                      </div>
                    )
                  ) : (
                    <div className="space-y-2">
                      {(skillTab === "all" ? filteredSkills : hermesSkills).map((skill) => (
                        <div key={skill.id} className="w-full rounded-xl border border-border bg-background p-3 transition-all hover:border-cognition/40 hover:bg-cognition/5">
                          <div className="flex items-start justify-between gap-2">
                            <button onClick={() => onSelectSkill(skill)} className="min-w-0 flex-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">{skill.name}</span>
                                {skill.category && (
                                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{skill.category}</span>
                                )}
                                {skill.source === "hermes" && (
                                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Hermes</span>
                                )}
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                                <span>{skill.parameters.length} 个参数</span>
                                <span>·</span>
                                <span>已使用 {skill.usageCount} 次</span>
                              </div>
                            </button>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(skill.id, skill.name, skill.category, skill.source === "hermes" ? "hermes" : "local");
                                }}
                                className={cn(
                                  "rounded-md p-1 transition-colors",
                                  favoriteIds.has(skill.id) ? "text-yellow-500 hover:bg-yellow-50" : "text-muted-foreground hover:bg-primary/10 hover:text-yellow-500"
                                )}
                                title={favoriteIds.has(skill.id) ? "取消收藏" : "收藏"}
                              >
                                <Star className={cn("h-3.5 w-3.5", favoriteIds.has(skill.id) && "fill-current")} />
                              </button>
                              <ChevronRight className="h-4 w-4 cursor-pointer text-muted-foreground" onClick={() => onSelectSkill(skill)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 收藏列表 */}
            {skillTab === "favorites" && (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                {favorites.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                    暂无收藏的技能
                    <div className="mt-1 text-[11px]">点击技能右侧的星标按钮即可收藏</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {favorites.map((fav) => {
                      const skill = skills.find((s) => s.id === fav.skillId);
                      return (
                        <button
                          key={fav.skillId}
                          onClick={() => skill ? onSelectSkill(skill) : toast("技能不存在", "info")}
                          className="w-full rounded-xl border border-border bg-background p-3 text-left transition-all hover:border-cognition/40 hover:bg-cognition/5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />
                                <span className="truncate text-sm font-medium">{fav.skillName}</span>
                                {fav.source === "hermes" && (
                                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Hermes</span>
                                )}
                              </div>
                              <div className="mt-0.5 text-[10px] text-muted-foreground">{fav.category}</div>
                            </div>
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 执行历史 */}
            {skillTab === "history" && (
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
                {executions.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                    暂无执行历史
                  </div>
                ) : (
                  <div className="space-y-2">
                    {executions.map((exec) => (
                      <div key={exec.id} className="rounded-xl border border-border bg-background p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {exec.success ? <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" /> : <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />}
                              <span className="truncate text-sm font-medium">{exec.skillName}</span>
                              {exec.source === "hermes" && (
                                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">Hermes</span>
                              )}
                            </div>
                            <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                              {exec.success ? exec.result.slice(0, 100) : exec.error}
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground/70">
                              {new Date(exec.createdAt).toLocaleString("zh-CN")} · {exec.durationMs}ms
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* 技能说明 */}
            <div className="shrink-0 border-b border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">{selectedSkill.description}</p>
              {selectedSkill.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {selectedSkill.tags.map((tag, i) => (
                    <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* 参数表单 */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {selectedSkill.parameters.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">此技能无需填写参数，可直接执行。</p>
              ) : (
                <div className="space-y-3">
                  {selectedSkill.parameters.map((param) => (
                    <div key={param.key}>
                      <label className="mb-1 block text-xs font-medium">
                        {param.label}
                        {param.required && <span className="ml-1 text-graveyard">*</span>}
                      </label>
                      {param.type === "textarea" ? (
                        <textarea
                          value={skillParams[param.key] || ""}
                          onChange={(e) => setSkillParams((prev) => ({ ...prev, [param.key]: e.target.value }))}
                          placeholder={param.placeholder}
                          rows={3}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                        />
                      ) : param.type === "select" ? (
                        <select
                          value={skillParams[param.key] || ""}
                          onChange={(e) => setSkillParams((prev) => ({ ...prev, [param.key]: e.target.value }))}
                          className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                        >
                          <option value="">请选择...</option>
                          {(param.options || []).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={param.type === "number" ? "number" : param.type === "date" ? "date" : "text"}
                          value={skillParams[param.key] || ""}
                          onChange={(e) => setSkillParams((prev) => ({ ...prev, [param.key]: e.target.value }))}
                          placeholder={param.placeholder}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-cognition"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 执行按钮 */}
            <div className="shrink-0 border-t border-border px-5 py-3">
              <Button onClick={executeSkill} disabled={skillExecuting} className="w-full">
                {skillExecuting ? (
                  <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> 执行中...</>
                ) : (
                  <><Zap className="mr-1 h-3.5 w-3.5" /> 执行技能</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

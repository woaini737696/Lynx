// ============ Lynx 超级助理页面 ============
// 核心功能：AI 聊天 + 工具调用 + SSE 流式回复
// 调用 POST /api/ai/chat 接收 SSE 流，支持中止、模型切换、跳转语音通话
// 深邃星空蓝深色主题（对齐 Kotlin 端，背景 Void，气泡 BubbleUserDeep/BubbleAssistantDeep）

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
  Keyboard,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Send,
  Phone,
  Sparkles,
  Square,
  ChevronDown,
  ChevronRight,
  Cpu,
  Wrench,
  Brain,
  X,
  Check,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { API_BASE_URL } from '@/config/env';
import { getToken } from '@/lib/auth';
import { api } from '@/lib/api-client';
import {
  readSSEStream,
  parseSSELine,
  type SSEEvent,
  type SSEMetaEvent,
  type SSEThinkingEvent,
  type SSEToolStartEvent,
  type SSEToolDoneEvent,
  type SSEDeltaEvent,
  type SSEDoneEvent,
  type SSEErrorEvent,
} from '@lynnhub/shared';
import type { AssistantStackParamList } from '@/navigation/AssistantStack';
import {
  Void,
  Deep,
  Primary,
  PrimaryGlow,
  Think,
  Agent,
  Danger,
  TextPrimary,
  TextMuted,
  Liquid2,
  Liquid3,
  LiquidBorder,
  BubbleUserDeep,
  BubbleAssistantDeep,
  DialogDeepPrimary,
} from '@/theme/colors';

// ============ 类型定义 ============

/** 推理模式 */
type ReasoningMode = 'fast' | 'standard' | 'deep';

/** 模型配置 */
interface ModelConfig {
  provider: string;
  model: string;
  reasoningMode: ReasoningMode;
}

/** 模型目录（来自 /api/ai/models） */
interface ModelCatalog {
  providers: Array<{
    id: string;
    name?: string;
    models: Array<{ id: string; name?: string; multimodal?: boolean }>;
  }>;
}

/** 工具调用信息 */
interface ToolCalledInfo {
  tool: string;
  args?: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
  /** 阶段：start / done */
  stage: 'start' | 'done';
}

/** 聊天消息（扩展自共享层 ChatMessage，加入思考过程与工具调用列表） */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  provider?: string;
  model?: string;
  error?: boolean;
  streaming?: boolean;
  /** 思考过程文本（来自 thinking 事件，可折叠展示） */
  thinking?: string;
  /** 工具调用列表（一条 AI 回复可能伴随多次工具调用） */
  tools?: ToolCalledInfo[];
  /** 是否展开思考过程 */
  thinkingExpanded?: boolean;
}

/** API 消息格式（OpenAI 兼容） */
interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============ 常量 ============

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  reasoningMode: 'standard',
};

const REASONING_MODES: Array<{ id: ReasoningMode; label: string; desc: string }> = [
  { id: 'fast', label: '快速', desc: '最低延迟' },
  { id: 'standard', label: '标准', desc: '平衡' },
  { id: 'deep', label: '深度', desc: '最强能力' },
];

// ============ 工具函数 ============

/** 生成简易 ID */
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 格式化时间 */
function nowLabel(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

/** 工具调用结果摘要（截断长字符串） */
function summarizeToolResult(result: unknown): string {
  if (result === null || result === undefined) return '(无返回)';
  let text: string;
  if (typeof result === 'string') {
    text = result;
  } else {
    try {
      text = JSON.stringify(result);
    } catch {
      text = String(result);
    }
  }
  // 去掉首尾空白与多余换行
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > 120) return text.slice(0, 120) + '…';
  return text;
}

/**
 * 调用 /api/ai/chat 并以 SSE 流式回调事件。
 * 优先使用 response.body.getReader()（RN polyfill 支持），降级到 response.text() 手动解析。
 */
async function streamChat(
  messages: ApiMessage[],
  modelConfig: ModelConfig,
  signal: AbortSignal,
  onEvent: (event: SSEEvent) => void
): Promise<void> {
  const token = await getToken();

  const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      messages,
      provider: modelConfig.provider,
      model: modelConfig.model,
      reasoningMode: modelConfig.reasoningMode,
      stream: true,
      assistantMode: true,
    }),
    signal,
  });

  if (!res.ok) {
    // 尝试读取错误信息
    let errMsg = `请求失败（${res.status}）`;
    try {
      const data = await res.json();
      if (data?.error?.message) errMsg = data.error.message;
      else if (typeof data?.error === 'string') errMsg = data.error;
    } catch {
      // 非 JSON 响应
    }
    throw new Error(errMsg);
  }

  // 优先尝试 ReadableStream 流式读取
  const body: ReadableStream<Uint8Array> | null | undefined = (res as unknown as {
    body?: ReadableStream<Uint8Array> | null;
  }).body;
  if (body && typeof body.getReader === 'function') {
    try {
      const reader = body.getReader();
      for await (const event of readSSEStream(reader)) {
        onEvent(event);
      }
      return;
    } catch (streamErr) {
      // 流式读取失败，降级到 text()
      // 如果是 abort 错误，向上抛
      if ((streamErr as Error)?.name === 'AbortError') throw streamErr;
    }
  }

  // 降级：一次性读取完整 text 后按行解析
  const text = await res.text();
  const lines = text.split('\n');
  for (const line of lines) {
    if (signal.aborted) {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) continue;
    const event = parseSSELine(trimmed);
    if (event) onEvent(event);
  }
}

// ============ 简易 Markdown 渲染 ============

/** Markdown 段落类型 */
type MdSegment =
  | { kind: 'code'; lang: string; content: string }
  | { kind: 'text'; content: string };

/**
 * 将 Markdown 文本拆分为段落：代码块（``` 包裹）与普通文本。
 * 简化版：不解析行内格式（粗体/链接等），只保留换行与代码块。
 * 支持流式输出中未闭合的代码块（最后一个 ``` 视为代码块开始）。
 */
function splitMarkdown(text: string): MdSegment[] {
  const segments: MdSegment[] = [];
  const fenceRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ kind: 'code', lang: match[1] || '', content: match[2] || '' });
    lastIndex = fenceRegex.lastIndex;
  }
  // 处理剩余文本（可能包含未闭合的代码块）
  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    const openFenceIdx = tail.indexOf('```');
    if (openFenceIdx >= 0) {
      // 有未闭合的代码块
      if (openFenceIdx > 0) {
        segments.push({ kind: 'text', content: tail.slice(0, openFenceIdx) });
      }
      const afterFence = tail.slice(openFenceIdx + 3);
      const langMatch = afterFence.match(/^(\w*)\n?/);
      const lang = langMatch ? langMatch[1] : '';
      const codeContent = langMatch ? afterFence.slice(langMatch[0].length) : afterFence;
      segments.push({ kind: 'code', lang, content: codeContent });
    } else {
      segments.push({ kind: 'text', content: tail });
    }
  }
  return segments.length > 0 ? segments : [{ kind: 'text', content: text }];
}

/** 渲染单段文本（保留换行） */
function TextSegment({ content, style }: { content: string; style: ViewStyle | any }) {
  const lines = content.replace(/\n$/, '').split('\n');
  return (
    <View>
      {lines.map((line, i) => (
        <Text key={i} style={style}>
          {line || ' '}
        </Text>
      ))}
    </View>
  );
}

/** 渲染代码块（深色背景 + 等宽字体 + 语言标签） */
function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const lines = content.replace(/\n$/, '').split('\n');
  return (
    <View style={styles.codeBlock}>
      {lang ? (
        <Text style={styles.codeLang} selectable>
          {lang}
        </Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {lines.map((line, i) => (
            <Text key={i} style={styles.codeText} selectable>
              {line || ' '}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** Markdown 渲染组件（简化版） */
function MarkdownView({ text, textColor }: { text: string; textColor: string }) {
  const segments = useMemo(() => splitMarkdown(text), [text]);
  return (
    <View style={styles.mdContainer}>
      {segments.map((seg, i) =>
        seg.kind === 'code' ? (
          <CodeBlock key={i} lang={seg.lang} content={seg.content} />
        ) : (
          <TextSegment
            key={i}
            content={seg.content}
            style={[styles.mdText, { color: textColor }]}
          />
        )
      )}
    </View>
  );
}

// ============ 思考过程（可折叠） ============

function ThinkingBlock({
  text,
  expanded,
  onToggle,
}: {
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.thinkingBlock}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={styles.thinkingHeader}>
        <Brain size={14} color={TextMuted} />
        <Text style={styles.thinkingLabel}>思考过程</Text>
        {expanded ? (
          <ChevronDown size={14} color={TextMuted} />
        ) : (
          <ChevronRight size={14} color={TextMuted} />
        )}
      </View>
      {expanded ? (
        <Text style={styles.thinkingText} selectable>
          {text}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ============ 工具调用卡片 ============

function ToolCard({ tool }: { tool: ToolCalledInfo }) {
  const done = tool.stage === 'done';
  return (
    <View style={styles.toolCard}>
      <View style={styles.toolHeader}>
        <Wrench size={13} color={done ? Agent : Think} />
        <Text style={styles.toolName} numberOfLines={1}>
          {tool.tool}
        </Text>
        {done ? (
          <Check size={13} color={Agent} />
        ) : (
          <ActivityIndicator size={11} color={Think} />
        )}
      </View>
      {done && tool.result !== undefined ? (
        <Text style={styles.toolResult} numberOfLines={3}>
          {summarizeToolResult(tool.result)}
        </Text>
      ) : null}
    </View>
  );
}

// ============ 消息气泡 ============

function MessageBubble({
  message,
  onToggleThinking,
}: {
  message: ChatMessage;
  onToggleThinking: (id: string) => void;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText} selectable>
            {message.content}
          </Text>
        </View>
      </View>
    );
  }

  // AI 消息
  return (
    <View style={styles.aiRow}>
      <View style={styles.aiAvatar}>
        <Sparkles size={16} color={Primary} />
      </View>
      <View
        style={[
          styles.aiBubble,
          message.error && styles.aiBubbleError,
        ]}
      >
        {/* 思考过程 */}
        {message.thinking ? (
          <ThinkingBlock
            text={message.thinking}
            expanded={Boolean(message.thinkingExpanded)}
            onToggle={() => onToggleThinking(message.id)}
          />
        ) : null}

        {/* 工具调用列表 */}
        {message.tools && message.tools.length > 0 ? (
          <View style={styles.toolList}>
            {message.tools.map((t, i) => (
              <ToolCard key={i} tool={t} />
            ))}
          </View>
        ) : null}

        {/* 主文本内容（Markdown 渲染） */}
        {message.content ? (
          <MarkdownView
            text={message.content}
            textColor={message.error ? Danger : TextPrimary}
          />
        ) : message.streaming ? (
          <View style={styles.streamingRow}>
            <ActivityIndicator size={14} color={Primary} />
            <Text style={styles.streamingText}>正在生成…</Text>
          </View>
        ) : null}

        {/* 元信息 */}
        {!message.streaming && (message.provider || message.model) ? (
          <View style={styles.metaRow}>
            {message.provider ? (
              <Text style={styles.metaText}>{message.provider}</Text>
            ) : null}
            {message.model ? (
              <Text style={styles.metaText}>· {message.model}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ============ 模型切换弹窗 ============

function ModelSwitcherModal({
  visible,
  catalog,
  current,
  onClose,
  onSelect,
}: {
  visible: boolean;
  catalog: ModelCatalog | null;
  current: ModelConfig;
  onClose: () => void;
  onSelect: (cfg: ModelConfig) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
          {/* 标题栏 */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>切换模型</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={20} color={TextMuted} />
            </TouchableOpacity>
          </View>

          {/* 推理模式 */}
          <Text style={styles.sectionLabel}>推理模式</Text>
          <View style={styles.modeRow}>
            {REASONING_MODES.map((m) => {
              const active = current.reasoningMode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  onPress={() => onSelect({ ...current, reasoningMode: m.id })}
                >
                  <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 模型列表 */}
          <Text style={styles.sectionLabel}>模型</Text>
          <ScrollView style={styles.modelList} showsVerticalScrollIndicator>
            {catalog?.providers?.map((provider) => (
              <View key={provider.id} style={styles.providerGroup}>
                <Text style={styles.providerName}>{provider.name || provider.id}</Text>
                {provider.models.map((model) => {
                  const active =
                    current.provider === provider.id && current.model === model.id;
                  return (
                    <TouchableOpacity
                      key={model.id}
                      style={[styles.modelItem, active && styles.modelItemActive]}
                      onPress={() =>
                        onSelect({
                          provider: provider.id,
                          model: model.id,
                          reasoningMode: current.reasoningMode,
                        })
                      }
                    >
                      <View style={styles.modelItemLeft}>
                        <Cpu size={15} color={active ? Primary : TextMuted} />
                        <View>
                          <Text
                            style={[
                              styles.modelItemId,
                              active && styles.modelItemIdActive,
                            ]}
                          >
                            {model.id}
                          </Text>
                          {model.name ? (
                            <Text style={styles.modelItemName}>{model.name}</Text>
                          ) : null}
                          {model.multimodal ? (
                            <Text style={styles.multimodalTag}>多模态</Text>
                          ) : null}
                        </View>
                      </View>
                      {active ? <Check size={16} color={Primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
            {!catalog ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={Primary} />
                <Text style={styles.loadingText}>加载模型列表…</Text>
              </View>
            ) : null}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ============ 主组件 ============

type NavProp = NativeStackNavigationProp<AssistantStackParamList, 'Assistant'>;

export function AssistantScreen() {
  const navigation = useNavigation<NavProp>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(DEFAULT_MODEL_CONFIG);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalog | null>(null);
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // 加载模型目录
  useEffect(() => {
    let cancelled = false;
    api
      .get<ModelCatalog>('/api/ai/models')
      .then((data) => {
        if (!cancelled && data) setModelCatalog(data);
      })
      .catch(() => {
        // 静默失败，用户仍可使用默认模型
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 卸载时中止请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // 切换思考过程展开
  const toggleThinking = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, thinkingExpanded: !m.thinkingExpanded } : m))
    );
  }, []);

  // 中止生成
  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // 发送消息
  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text || input).trim();
      if (!content || thinking) return;

      const userMsg: ChatMessage = {
        id: genId('u'),
        role: 'user',
        content,
        time: nowLabel(),
      };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setInput('');
      setThinking(true);
      Keyboard.dismiss();

      const aiMsgId = genId('a');
      const aiPlaceholder: ChatMessage = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        time: nowLabel(),
        streaming: true,
        tools: [],
      };
      setMessages((prev) => [...prev, aiPlaceholder]);

      // 中止之前的请求
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // 构造 API 消息（保留上下文，过滤错误消息）
        const apiMessages: ApiMessage[] = nextMessages
          .filter((m) => !m.error)
          .map((m) => ({ role: m.role, content: m.content }));

        // 局部变量累积，避免每个 delta 触发 setState 过频
        let aiContent = '';
        let aiProvider: string | undefined;
        let aiModel: string | undefined;
        let thinkingText = '';
        let tools: ToolCalledInfo[] = [];
        let firstDeltaReceived = false;
        let streamEnded = false;

        // 节流 flush：合并多个 delta 到一次 setState
        let flushScheduled = false;
        let flushTimer: ReturnType<typeof setTimeout> | null = null;
        const flush = () => {
          flushScheduled = false;
          flushTimer = null;
          if (streamEnded) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    content: aiContent,
                    thinking: thinkingText || undefined,
                    tools: tools.length > 0 ? [...tools] : undefined,
                  }
                : m
            )
          );
        };
        const scheduleFlush = () => {
          if (flushScheduled || streamEnded) return;
          flushScheduled = true;
          flushTimer = setTimeout(flush, 0);
        };
        const cancelFlush = () => {
          if (flushTimer !== null) {
            clearTimeout(flushTimer);
            flushTimer = null;
          }
          flushScheduled = false;
        };

        await streamChat(apiMessages, modelConfig, controller.signal, (event) => {
          switch (event.type) {
            case 'meta': {
              const meta = event as SSEMetaEvent;
              aiProvider = meta.provider;
              aiModel = meta.model;
              break;
            }
            case 'thinking': {
              const t = event as SSEThinkingEvent;
              thinkingText += t.content || '';
              scheduleFlush();
              break;
            }
            case 'tool_start': {
              const ts = event as SSEToolStartEvent;
              tools = [...tools, { tool: ts.tool, args: ts.args, stage: 'start' }];
              scheduleFlush();
              break;
            }
            case 'tool_done': {
              const td = event as SSEToolDoneEvent;
              tools = tools.map((t) =>
                t.tool === td.tool && t.stage === 'start'
                  ? { ...t, result: td.result, durationMs: td.durationMs, stage: 'done' }
                  : t
              );
              // 若 start 没有对应记录，则补一条 done
              if (!tools.some((t) => t.tool === td.tool)) {
                tools = [...tools, { tool: td.tool, result: td.result, durationMs: td.durationMs, stage: 'done' }];
              }
              scheduleFlush();
              break;
            }
            case 'delta': {
              const d = event as SSEDeltaEvent;
              if (typeof d.content !== 'string') break;
              if (!firstDeltaReceived) {
                firstDeltaReceived = true;
                aiContent = d.content;
              } else {
                aiContent += d.content;
              }
              scheduleFlush();
              break;
            }
            case 'done': {
              const dn = event as SSEDoneEvent;
              if (dn.usage) {
                // usage 不在此展示
              }
              if (dn.provider) aiProvider = dn.provider;
              if (dn.model) aiModel = dn.model;
              break;
            }
            case 'error': {
              const er = event as SSEErrorEvent;
              const errMsg = er.message || '流式响应异常';
              streamEnded = true;
              cancelFlush();
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: errMsg, error: true, streaming: false }
                    : m
                )
              );
              return;
            }
          }
        });

        // 流结束
        streamEnded = true;
        cancelFlush();
        const finalContent = aiContent || '(空回复)';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: finalContent,
                  streaming: false,
                  provider: aiProvider,
                  model: aiModel,
                  thinking: thinkingText || undefined,
                  tools: tools.length > 0 ? tools : undefined,
                }
              : m
          )
        );
      } catch (e) {
        const err = e as Error;
        if (err.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, streaming: false } : m))
          );
        } else {
          const msg = '网络错误：' + err.message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: msg, error: true, streaming: false }
                : m
            )
          );
        }
      } finally {
        setThinking(false);
        abortRef.current = null;
      }
    },
    [input, thinking, messages, modelConfig]
  );

  // 跳转语音通话
  const goVoiceCall = useCallback(() => {
    navigation.navigate('VoiceCall');
  }, [navigation]);

  // 当前模型显示标签
  const modelLabel = useMemo(() => {
    return `${modelConfig.provider}/${modelConfig.model}`;
  }, [modelConfig]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ============ 顶部标题栏 ============ */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Sparkles size={20} color={Primary} />
            <Text style={styles.headerTitle}>Lynx 超级助理</Text>
          </View>
          <TouchableOpacity
            style={styles.modelBtn}
            onPress={() => setShowModelSwitcher(true)}
            activeOpacity={0.7}
          >
            <Cpu size={14} color={Primary} />
            <Text style={styles.modelBtnText} numberOfLines={1}>
              {modelLabel}
            </Text>
            <ChevronDown size={13} color={Primary} />
          </TouchableOpacity>
        </View>

        {/* ============ 消息列表（倒序，自动滚动到底部） ============ */}
        <FlatList
          ref={listRef}
          data={[...messages].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} onToggleThinking={toggleThinking} />
          )}
          inverted
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Sparkles size={32} color={Primary} />
              </View>
              <Text style={styles.emptyTitle}>开始与 Lynx 对话</Text>
              <Text style={styles.emptyDesc}>
                智能对话 · 工具调用 · 任务执行
              </Text>
            </View>
          }
        />

        {/* ============ 底部输入栏 ============ */}
        <View style={styles.inputBar}>
          {/* 语音通话入口 */}
          <TouchableOpacity
            style={styles.voiceBtn}
            onPress={goVoiceCall}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Phone size={22} color={Primary} />
          </TouchableOpacity>

          {/* 文本输入框 */}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="输入消息…"
              placeholderTextColor={TextMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={4000}
              editable={!thinking}
            />
          </View>

          {/* 发送 / 停止按钮 */}
          {thinking ? (
            <TouchableOpacity
              style={[styles.sendBtn, styles.stopBtn]}
              onPress={stopGeneration}
              activeOpacity={0.7}
            >
              <Square size={18} color={TextPrimary} fill={TextPrimary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!input.trim()}
              activeOpacity={0.7}
            >
              <Send size={18} color={TextPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ============ 模型切换弹窗 ============ */}
      <ModelSwitcherModal
        visible={showModelSwitcher}
        catalog={modelCatalog}
        current={modelConfig}
        onClose={() => setShowModelSwitcher(false)}
        onSelect={(cfg) => {
          setModelConfig(cfg);
          setShowModelSwitcher(false);
        }}
      />
    </SafeAreaView>
  );
}

// ============ 样式（深邃星空蓝深色主题，背景 Void） ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Void,
  },
  flex: {
    flex: 1,
  },
  // 顶部标题栏（液态玻璃）
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Liquid2,
    borderBottomWidth: 1,
    borderBottomColor: LiquidBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TextPrimary,
  },
  modelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: PrimaryGlow,
    borderRadius: 14,
    maxWidth: 180,
  },
  modelBtnText: {
    fontSize: 12,
    color: Primary,
    fontWeight: '600',
    maxWidth: 120,
  },
  // 消息列表
  listContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    transform: [{ scaleY: -1 }], // inverted 列表空状态需要翻转回来
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: PrimaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: TextPrimary,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: TextMuted,
  },
  // 用户消息（深色气泡）
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: 6,
  },
  userBubble: {
    maxWidth: '78%',
    backgroundColor: BubbleUserDeep,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: LiquidBorder,
    shadowColor: Primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
    color: TextPrimary,
  },
  // AI 消息（品牌蓝气泡）
  aiRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
    gap: 8,
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PrimaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBubble: {
    flex: 1,
    maxWidth: '82%',
    backgroundColor: BubbleAssistantDeep,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: LiquidBorder,
    shadowColor: Primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 1,
  },
  aiBubbleError: {
    backgroundColor: 'rgba(255, 90, 90, 0.18)',
    borderColor: 'rgba(255, 90, 90, 0.35)',
  },
  streamingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  streamingText: {
    fontSize: 14,
    color: TextMuted,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: TextMuted,
  },
  // 思考过程
  thinkingBlock: {
    backgroundColor: Liquid3,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  thinkingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thinkingLabel: {
    fontSize: 12,
    color: TextMuted,
    fontWeight: '500',
    flex: 1,
    fontStyle: 'italic',
  },
  thinkingText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: TextMuted,
    fontStyle: 'italic',
  },
  // 工具调用
  toolList: {
    gap: 6,
    marginBottom: 8,
  },
  toolCard: {
    backgroundColor: Liquid3,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: LiquidBorder,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: TextPrimary,
  },
  toolResult: {
    marginTop: 4,
    fontSize: 11,
    color: TextMuted,
    lineHeight: 16,
  },
  // Markdown
  mdContainer: {
    gap: 4,
  },
  mdText: {
    fontSize: 15,
    lineHeight: 22,
    color: TextPrimary,
  },
  codeBlock: {
    backgroundColor: Deep, // 代码块用次级背景，与 Void 区分
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: LiquidBorder,
  },
  codeLang: {
    fontSize: 11,
    color: TextMuted,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeText: {
    fontSize: 13,
    lineHeight: 18,
    color: TextPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // 底部输入栏（液态玻璃）
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Liquid2,
    borderTopWidth: 1,
    borderTopColor: LiquidBorder,
  },
  voiceBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PrimaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Liquid3,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LiquidBorder,
  },
  input: {
    fontSize: 15,
    color: TextPrimary,
    padding: 0,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  sendBtnDisabled: {
    backgroundColor: TextMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  stopBtn: {
    backgroundColor: Danger,
    shadowColor: Danger,
  },
  // 模型切换弹窗（深色玻璃）
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 4, 12, 0.6)', // Void 半透明遮罩
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: DialogDeepPrimary,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: LiquidBorder,
    shadowColor: Primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TextPrimary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TextMuted,
    marginBottom: 8,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Liquid3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeChipActive: {
    backgroundColor: PrimaryGlow,
    borderColor: Primary,
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TextMuted,
  },
  modeChipTextActive: {
    color: Primary,
  },
  modelList: {
    maxHeight: 320,
  },
  providerGroup: {
    marginBottom: 12,
  },
  providerName: {
    fontSize: 13,
    fontWeight: '700',
    color: TextPrimary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: Liquid3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modelItemActive: {
    backgroundColor: PrimaryGlow,
    borderColor: Primary,
  },
  modelItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modelItemId: {
    fontSize: 14,
    fontWeight: '600',
    color: TextPrimary,
  },
  modelItemIdActive: {
    color: Primary,
  },
  modelItemName: {
    fontSize: 11,
    color: TextMuted,
    marginTop: 2,
  },
  multimodalTag: {
    fontSize: 10,
    color: Think,
    marginTop: 2,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 13,
    color: TextMuted,
  },
});

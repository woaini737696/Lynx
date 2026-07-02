// ============ 灵感速记页（IdeaPanel 浮层） ============
// 作为全屏浮层使用（不再作为 Tab）
// 顶部：闪电输入框（点击展开快速输入灵感）
// 中部：灵感列表（按时间倒序，支持滑动删除）
// 底部：浮动"+"按钮
// 数据：GET/POST /api/ideas，DELETE /api/ideas/[id]
// 深邃星空蓝深色主题（对齐 Kotlin 端）

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Zap, Plus, ChevronDown, Tag } from 'lucide-react-native';
import useSWR, { useSWRConfig } from 'swr';
import { swrFetcher, api } from '@/lib/api-client';
import { SwipeableRow } from '@/components/SwipeableRow';
import {
  Void,
  Primary,
  Think,
  TextPrimary,
  TextMuted,
  Liquid2,
  Liquid3,
  LiquidBorder,
  Danger,
} from '@/theme/colors';

/** 灵感数据结构 */
interface Idea {
  id: string;
  content: string;
  source?: string;
  createdAt: string;
}

/** 相对时间格式化 */
function formatTime(iso: string): string {
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '';
  const diff = Date.now() - t.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  if (diff < 2 * 86400_000) return '昨天';
  return `${t.getMonth() + 1}月${t.getDate()}日`;
}

export function InboxScreen() {
  const { data, error, isLoading } = useSWR<Idea[]>('/api/ideas', swrFetcher);
  const { mutate } = useSWRConfig();

  const [inputExpanded, setInputExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 按时间倒序
  const ideas = (data ?? [])
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // 创建新灵感
  const handleSubmit = useCallback(async () => {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/api/ideas', { content: text, source: 'manual' });
      setDraft('');
      setInputExpanded(false);
      await mutate('/api/ideas');
    } catch {
      // 静默失败：列表保持原状
    } finally {
      setSubmitting(false);
    }
  }, [draft, submitting, mutate]);

  // 删除灵感
  const handleDelete = useCallback(
    async (id: string) => {
      await api.delete(`/api/ideas/${id}`);
      await mutate('/api/ideas');
    },
    [mutate]
  );

  const renderItem = ({ item }: { item: Idea }) => {
    const expanded = expandedId === item.id;
    return (
      <SwipeableRow
        rightAction={{ label: '删除', color: Danger, onPress: () => handleDelete(item.id) }}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => setExpandedId(expanded ? null : item.id)}
        >
          <Text style={styles.cardContent} numberOfLines={expanded ? undefined : 2}>
            {item.content}
          </Text>
          <View style={styles.cardMeta}>
            {item.source ? (
              <View style={styles.sourceTag}>
                <Tag size={11} color={TextMuted} />
                <Text style={styles.sourceText}>{item.source}</Text>
              </View>
            ) : null}
            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ============ 顶部标题 + 闪电输入框 ============ */}
        <View style={styles.header}>
          <Text style={styles.title}>灵感速记</Text>
          <TouchableOpacity
            style={styles.lightningInput}
            activeOpacity={0.9}
            onPress={() => setInputExpanded(true)}
          >
            <Zap size={18} color={Think} />
            {inputExpanded ? (
              <TextInput
                style={styles.input}
                placeholder="记下此刻的灵感…"
                placeholderTextColor={TextMuted}
                value={draft}
                autoFocus
                multiline
                onChangeText={setDraft}
              />
            ) : (
              <Text style={styles.inputPlaceholder}>记下此刻的灵感…</Text>
            )}
            {inputExpanded && (
              <TouchableOpacity
                style={[styles.sendBtn, (!draft.trim() || submitting) && styles.sendBtnDisabled]}
                onPress={handleSubmit}
                disabled={!draft.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendText}>保存</Text>
                )}
              </TouchableOpacity>
            )}
            {inputExpanded && (
              <TouchableOpacity
                onPress={() => {
                  setInputExpanded(false);
                  setDraft('');
                }}
              >
                <ChevronDown size={18} color={TextMuted} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {/* ============ 灵感列表 ============ */}
        <FlatList
          data={ideas}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onRefresh={() => mutate('/api/ideas')}
          refreshing={isLoading}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={Primary} />
            ) : error ? (
              <Text style={styles.emptyText}>加载失败，下拉重试</Text>
            ) : (
              <View style={styles.emptyState}>
                <Zap size={40} color={TextMuted} />
                <Text style={styles.emptyText}>还没有灵感，点击下方"+"开始记录</Text>
              </View>
            )
          }
        />

        {/* ============ 底部浮动 + 按钮 ============ */}
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => setInputExpanded(true)}
        >
          <Plus size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============ 样式（深邃星空蓝深色主题） ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Void,
  },
  flex: {
    flex: 1,
  },
  // 顶部
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: TextPrimary,
    marginBottom: 12,
  },
  lightningInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Liquid2,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: LiquidBorder,
    gap: 10,
  },
  inputPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: TextMuted,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: TextPrimary,
    paddingVertical: 0,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: Primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // 列表
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
  },
  // 灵感卡片
  card: {
    backgroundColor: Liquid2,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: LiquidBorder,
  },
  cardContent: {
    fontSize: 15,
    color: TextPrimary,
    lineHeight: 22,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Liquid3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  sourceText: {
    fontSize: 11,
    color: TextMuted,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 11,
    color: TextMuted,
  },
  // 空状态
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: TextMuted,
    textAlign: 'center',
  },
  // 浮动按钮
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});

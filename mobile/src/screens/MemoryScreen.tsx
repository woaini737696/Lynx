// ============ 记忆图谱页 ============
// 顶部：搜索框（语义搜索）
// 中部：记忆节点列表（按相似度排序）
// 每条记忆显示：内容摘要、来源类型、相似度分数
// 点击展开详情
// 数据：GET /api/memory/search?query=xxx
// 深邃星空蓝深色主题（对齐 Kotlin 端）

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Brain, Tag, ChevronDown } from 'lucide-react-native';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/api-client';
import {
  Void,
  Primary,
  TextPrimary,
  TextMuted,
  Liquid2,
  Liquid3,
  LiquidBorder,
} from '@/theme/colors';

/** 记忆条目 */
interface MemoryItem {
  id: string;
  content: string;
  sourceType?: string;
  /** 相似度分数 0.0 ~ 1.0 */
  score?: number;
  createdAt?: string;
}

/** 来源类型标签文案映射 */
const SOURCE_LABEL: Record<string, string> = {
  chat: '对话',
  idea: '灵感',
  task: '任务',
  note: '笔记',
  doc: '文档',
};

export function MemoryScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 输入防抖 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  // 仅在有查询词时发起搜索
  const swrKey = debouncedQuery
    ? `/api/memory/search?query=${encodeURIComponent(debouncedQuery)}`
    : null;
  const { data, error, isLoading } = useSWR<MemoryItem[]>(swrKey, swrFetcher);

  // 按相似度倒序
  const memories = (data ?? [])
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const onSearchFocus = useCallback(() => setExpandedId(null), []);

  const renderItem = ({ item }: { item: MemoryItem }) => {
    const expanded = expandedId === item.id;
    const score = item.score ?? 0;
    const scorePct = Math.round(score * 100);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => setExpandedId(expanded ? null : item.id)}
      >
        <Text style={styles.cardContent} numberOfLines={expanded ? undefined : 3}>
          {item.content}
        </Text>
        <View style={styles.cardMeta}>
          {item.sourceType ? (
            <View style={styles.sourceTag}>
              <Tag size={11} color={TextMuted} />
              <Text style={styles.sourceText}>
                {SOURCE_LABEL[item.sourceType] ?? item.sourceType}
              </Text>
            </View>
          ) : null}
          {item.score != null && (
            <View style={styles.scoreWrap}>
              <View style={styles.scoreTrack}>
                <View style={[styles.scoreFill, { width: `${scorePct}%` }]} />
              </View>
              <Text style={styles.scoreText}>{scorePct}%</Text>
            </View>
          )}
          {expanded && <ChevronDown size={14} color={TextMuted} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ============ 顶部标题 + 搜索框 ============ */}
      <View style={styles.header}>
        <Text style={styles.title}>记忆图谱</Text>
        <View style={styles.searchBox}>
          <Search size={18} color={TextMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="语义搜索你的记忆…"
            placeholderTextColor={TextMuted}
            value={query}
            onChangeText={setQuery}
            onFocus={onSearchFocus}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <ChevronDown size={18} color={TextMuted} style={{ transform: [{ rotate: '90deg' }] }} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ============ 记忆列表 ============ */}
      <FlatList
        data={memories}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !debouncedQuery ? (
            <View style={styles.emptyState}>
              <Brain size={40} color={TextMuted} />
              <Text style={styles.emptyText}>输入关键词，语义搜索你的记忆</Text>
            </View>
          ) : isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={Primary} />
          ) : error ? (
            <Text style={styles.emptyText}>搜索失败，请重试</Text>
          ) : (
            <View style={styles.emptyState}>
              <Brain size={40} color={TextMuted} />
              <Text style={styles.emptyText}>未找到相关记忆</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

// ============ 样式（深邃星空蓝深色主题） ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Void,
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Liquid2,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: LiquidBorder,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TextPrimary,
    paddingVertical: 0,
  },
  // 列表
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  // 记忆卡片
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
    marginTop: 12,
    gap: 10,
    flexWrap: 'wrap',
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
  // 相似度
  scoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 100,
  },
  scoreTrack: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(75, 159, 255, 0.18)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    backgroundColor: Primary,
    borderRadius: 3,
  },
  scoreText: {
    fontSize: 11,
    color: Primary,
    fontWeight: '600',
    minWidth: 32,
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
});

// ============ 飞书任务管理页（Tasks Tab） ============
// 顶部：Tab 切换（北极星 / 战役 / 任务 三列）
// 中部：任务列表（每列最多 3 / 5 / 10 条）
// 底部：浮动"+"按钮添加任务
// 左滑完成，右滑删除
// 数据：GET/POST /api/tasks，PATCH/DELETE /api/tasks/[id]
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
import { Plus, Check, Circle, Flag } from 'lucide-react-native';
import useSWR, { useSWRConfig } from 'swr';
import { swrFetcher, api } from '@/lib/api-client';
import { SwipeableRow } from '@/components/SwipeableRow';
import {
  Void,
  Primary,
  Agent,
  Think,
  Danger,
  TextPrimary,
  TextMuted,
  Liquid2,
  Liquid3,
  LiquidBorder,
} from '@/theme/colors';

/** 任务级别 */
type TaskLevel = 'north_star' | 'campaign' | 'task';
/** 任务状态 */
type TaskStatus = 'todo' | 'in_progress' | 'done';

interface Task {
  id: string;
  content: string;
  status: TaskStatus;
  level: TaskLevel;
  createdAt: string;
}

/** 三列配置：label + 数量上限 */
const LEVELS: { key: TaskLevel; label: string; limit: number }[] = [
  { key: 'north_star', label: '北极星', limit: 3 },
  { key: 'campaign', label: '战役', limit: 5 },
  { key: 'task', label: '任务', limit: 10 },
];

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
};

/** 相对时间格式化 */
function formatTime(iso: string): string {
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '';
  const diff = Date.now() - t.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  return `${t.getMonth() + 1}月${t.getDate()}日`;
}

export function BoardScreen() {
  const { data, error, isLoading } = useSWR<Task[]>('/api/tasks', swrFetcher);
  const { mutate } = useSWRConfig();

  const [activeLevel, setActiveLevel] = useState<TaskLevel>('north_star');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 当前列任务（过滤 + 数量上限）
  const tasks = (data ?? [])
    .filter((t) => t.level === activeLevel)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const activeConfig = LEVELS.find((l) => l.key === activeLevel)!;
  const limitedTasks = tasks.slice(0, activeConfig.limit);
  const reachedLimit = tasks.length >= activeConfig.limit;

  // 创建任务
  const handleAdd = useCallback(async () => {
    const text = draft.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/api/tasks', { content: text, level: activeLevel, status: 'todo' });
      setDraft('');
      setAdding(false);
      await mutate('/api/tasks');
    } catch {
      // 静默失败
    } finally {
      setSubmitting(false);
    }
  }, [draft, submitting, activeLevel, mutate]);

  // 切换完成状态
  const handleToggleDone = useCallback(
    async (task: Task) => {
      const next: TaskStatus = task.status === 'done' ? 'todo' : 'done';
      await api.patch(`/api/tasks/${task.id}`, { status: next });
      await mutate('/api/tasks');
    },
    [mutate]
  );

  // 删除任务
  const handleDelete = useCallback(
    async (id: string) => {
      await api.delete(`/api/tasks/${id}`);
      await mutate('/api/tasks');
    },
    [mutate]
  );

  const renderItem = ({ item }: { item: Task }) => {
    const done = item.status === 'done';
    return (
      <SwipeableRow
        leftAction={{ label: done ? '取消' : '完成', color: Agent, onPress: () => handleToggleDone(item) }}
        rightAction={{ label: '删除', color: Danger, onPress: () => handleDelete(item.id) }}
      >
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <TouchableOpacity
              style={[styles.checkBtn, done && styles.checkBtnDone]}
              activeOpacity={0.7}
              onPress={() => handleToggleDone(item)}
            >
              {done ? <Check size={16} color="#FFFFFF" /> : <Circle size={16} color={TextMuted} />}
            </TouchableOpacity>
            <Text
              style={[styles.cardContent, done && styles.cardContentDone]}
              numberOfLines={2}
            >
              {item.content}
            </Text>
            {item.level === 'north_star' && <Flag size={14} color={Think} />}
          </View>
          <View style={styles.cardMeta}>
            <View style={[styles.statusTag, done && styles.statusTagDone]}>
              <Text style={[styles.statusText, done && styles.statusTextDone]}>
                {STATUS_LABEL[item.status]}
              </Text>
            </View>
            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ============ 顶部标题 + Tab 切换 ============ */}
        <View style={styles.header}>
          <Text style={styles.title}>任务看板</Text>
          <View style={styles.segmented}>
            {LEVELS.map((lvl) => {
              const active = lvl.key === activeLevel;
              const count = (data ?? []).filter((t) => t.level === lvl.key).length;
              return (
                <TouchableOpacity
                  key={lvl.key}
                  style={[styles.segItem, active && styles.segItemActive]}
                  activeOpacity={0.85}
                  onPress={() => {
                    setActiveLevel(lvl.key);
                    setAdding(false);
                  }}
                >
                  <Text style={[styles.segText, active && styles.segTextActive]}>
                    {lvl.label}
                  </Text>
                  <Text style={[styles.segCount, active && styles.segTextActive]}>
                    {count}/{lvl.limit}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 添加输入框 */}
          {adding && (
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                placeholder={`添加${activeConfig.label}…`}
                placeholderTextColor={TextMuted}
                value={draft}
                autoFocus
                onChangeText={setDraft}
                onSubmitEditing={handleAdd}
              />
              <TouchableOpacity
                style={[styles.addBtn, (!draft.trim() || submitting) && styles.addBtnDisabled]}
                onPress={handleAdd}
                disabled={!draft.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.addBtnText}>添加</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
          {reachedLimit && !adding && (
            <Text style={styles.limitHint}>当前列已达上限（{activeConfig.limit} 条）</Text>
          )}
        </View>

        {/* ============ 任务列表 ============ */}
        <FlatList
          data={limitedTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onRefresh={() => mutate('/api/tasks')}
          refreshing={isLoading}
          ListEmptyComponent={
            isLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={Primary} />
            ) : error ? (
              <Text style={styles.emptyText}>加载失败，下拉重试</Text>
            ) : (
              <View style={styles.emptyState}>
                <Flag size={40} color={TextMuted} />
                <Text style={styles.emptyText}>
                  {reachedLimit ? '已达上限，无法新增' : '暂无任务，点击"+"添加'}
                </Text>
              </View>
            )
          }
        />

        {/* ============ 底部浮动 + 按钮 ============ */}
        <TouchableOpacity
          style={[styles.fab, reachedLimit && styles.fabDisabled]}
          activeOpacity={0.85}
          disabled={reachedLimit}
          onPress={() => setAdding(true)}
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
  // 分段控件
  segmented: {
    flexDirection: 'row',
    backgroundColor: Liquid2,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: LiquidBorder,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  segItemActive: {
    backgroundColor: Primary,
  },
  segText: {
    fontSize: 14,
    fontWeight: '600',
    color: TextMuted,
  },
  segTextActive: {
    color: '#FFFFFF',
  },
  segCount: {
    fontSize: 11,
    color: TextMuted,
    marginTop: 2,
  },
  // 添加行
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Liquid2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
    borderWidth: 1,
    borderColor: LiquidBorder,
    gap: 8,
  },
  addInput: {
    flex: 1,
    fontSize: 15,
    color: TextPrimary,
    paddingVertical: 6,
  },
  addBtn: {
    backgroundColor: Primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  limitHint: {
    fontSize: 12,
    color: Think,
    marginTop: 8,
  },
  // 列表
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
  },
  // 任务卡片
  card: {
    backgroundColor: Liquid2,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: LiquidBorder,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: LiquidBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: {
    backgroundColor: Agent,
    borderColor: Agent,
  },
  cardContent: {
    flex: 1,
    fontSize: 15,
    color: TextPrimary,
    lineHeight: 22,
  },
  cardContentDone: {
    color: TextMuted,
    textDecorationLine: 'line-through',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 36,
    gap: 10,
  },
  statusTag: {
    backgroundColor: 'rgba(75, 159, 255, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusTagDone: {
    backgroundColor: 'rgba(48, 214, 181, 0.16)',
  },
  statusText: {
    fontSize: 11,
    color: Primary,
    fontWeight: '500',
  },
  statusTextDone: {
    color: Agent,
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
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabDisabled: {
    backgroundColor: TextMuted,
    shadowOpacity: 0.1,
    elevation: 2,
  },
});

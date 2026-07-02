// ============ 首页（今日工作台） ============
// 与 Kotlin 端 HomeScreen.kt 对齐
// 内容：
// - 顶部：问候 + 头像（设置入口）
// - Agent 状态 pill
// - 中央呼吸球（点击进通话浮层，渐变动画）
// - 今日概览：3 个统计胶囊（进行中 / 今日完成 / 待处理飞书）
// - 快捷入口：灵感速记 / Lynx 助理 / 语音通话
// - 最近飞书任务 Top 3
// - 右下角 FAB：灵感速记
// 数据：GET /api/tasks、GET /api/lark-tasks
// 深邃星空蓝深色主题

import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Sparkles,
  Lightbulb,
  Phone,
  ChevronRight,
  Zap,
  CircleDot,
  CheckCircle2,
  ListChecks,
  type LucideIcon,
} from 'lucide-react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import useSWR from 'swr';
import { swrFetcher } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import type { RootStackParamList, MainTabParamList } from '@/navigation/AppNavigator';
import {
  Void,
  Primary,
  PrimaryDeep,
  PrimaryGlow,
  Agent,
  Think,
  TextPrimary,
  TextMuted,
  Liquid2,
  Liquid3,
  LiquidBorder,
  LiquidHighlight,
} from '@/theme/colors';

// ============ 类型定义 ============

/** 本地任务（/api/tasks 返回项的子集，与 BoardScreen 对齐） */
interface LocalTask {
  id: string;
  content: string;
  status: 'todo' | 'in_progress' | 'done';
  level: 'north_star' | 'campaign' | 'task';
  createdAt: string;
}

/** 飞书任务（/api/lark-tasks 返回项 NormalizedTask 的子集） */
interface LarkTask {
  guid: string;
  summary: string;
  completed: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  due: string | null;
  url?: string;
}

/** 统计胶囊配置 */
interface StatCapsule {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: string;
}

/** 快捷入口配置 */
interface QuickEntry {
  label: string;
  desc: string;
  icon: LucideIcon;
  accent: string;
  onPress: () => void;
}

// ============ 导航类型 ============

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ============ 工具函数 ============

/** 判断 ISO 时间字符串是否为今天 */
function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** 根据当前小时生成问候语 */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

/** 相对时间格式化 */
function formatTime(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '';
  const diff = Date.now() - t.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  return `${t.getMonth() + 1}月${t.getDate()}日`;
}

// ============ 呼吸球组件 ============

/** 中央呼吸球：渐变光晕 + 缩放呼吸动画，点击进入语音通话浮层 */
function BreathingBall({ onPress }: { onPress: () => void }) {
  // 呼吸缩放
  const scale = useRef<Animated.Value>(new Animated.Value(1)).current;
  // 外层辉光透明度
  const glow = useRef<Animated.Value>(new Animated.Value(0.35)).current;

  useEffect(() => {
    // 呼吸循环：1.0 → 1.08 → 1.0，辉光同步明暗
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(scale, {
            toValue: 1.0,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 0.7,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(glow, {
            toValue: 0.35,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, glow]);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.ballWrap}>
      {/* 外层辉光 */}
      <Animated.View
        style={[
          styles.ballGlow,
          {
            opacity: glow,
            transform: [{ scale }],
          },
        ]}
      />
      {/* 主体球 */}
      <Animated.View style={[styles.ball, { transform: [{ scale }] }]}>
        <Sparkles size={32} color={TextPrimary} />
        <Text style={styles.ballLabel}>开始对话</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ============ 主组件 ============

export function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const user = useAuth((s) => s.user);

  // 拉取本地任务（/api/tasks）
  const { data: tasksData } = useSWR<LocalTask[]>('/api/tasks', swrFetcher);
  // 拉取飞书任务（/api/lark-tasks，db_only 移动端友好模式）
  const { data: larkTasksData } = useSWR<LarkTask[]>(
    '/api/lark-tasks?db_only=true&view=my',
    swrFetcher
  );

  const tasks = tasksData ?? [];
  const larkTasks = larkTasksData ?? [];

  // 统计胶囊数据
  const stats: StatCapsule[] = useMemo(() => {
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const doneToday = tasks.filter(
      (t) => t.status === 'done' && isToday(t.createdAt)
    ).length;
    const pendingLark = larkTasks.filter((t) => !t.completed).length;
    return [
      { label: '进行中', value: inProgress, icon: CircleDot, accent: Primary },
      { label: '今日完成', value: doneToday, icon: CheckCircle2, accent: Agent },
      { label: '待处理飞书', value: pendingLark, icon: ListChecks, accent: Think },
    ];
  }, [tasks, larkTasks]);

  // 最近飞书任务 Top 3（按 updatedAt/createdAt 倒序）
  const recentLarkTasks = useMemo(() => {
    return larkTasks
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
        const tb = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
        return tb - ta;
      })
      .slice(0, 3);
  }, [larkTasks]);

  // ============ 跳转 ============

  // 进入个人中心 / 设置浮层（Root stack modal）
  const goProfile = () => navigation.navigate('Profile');

  // 进入灵感速记浮层（跨 Tab 嵌套跳转至 AssistantStack.IdeaPanel）
  const goIdeaPanel = () =>
    navigation.navigate('Assistant', { screen: 'IdeaPanel' });

  // 进入语音通话浮层（跨 Tab 嵌套跳转至 AssistantStack.VoiceCall）
  const goVoiceCall = () =>
    navigation.navigate('Assistant', { screen: 'VoiceCall' });

  // 切换到 Lynx 助理 Tab（指定 AssistantStack 默认屏幕）
  const goAssistant = () =>
    navigation.navigate('Assistant', { screen: 'Assistant' });

  // 打开飞书任务链接
  const openLarkTask = (url?: string) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  // 快捷入口
  const quickEntries: QuickEntry[] = [
    {
      label: '灵感速记',
      desc: '随手记录',
      icon: Lightbulb,
      accent: Think,
      onPress: goIdeaPanel,
    },
    {
      label: 'Lynx 助理',
      desc: '智能对话',
      icon: Sparkles,
      accent: Primary,
      onPress: goAssistant,
    },
    {
      label: '语音通话',
      desc: '全双工对话',
      icon: Phone,
      accent: Agent,
      onPress: goVoiceCall,
    },
  ];

  // 用户名 / 头像首字母
  const displayName = user?.displayName || user?.username || '未登录';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ============ 顶部：问候 + 头像 ============ */}
        <View style={styles.topBar}>
          <View style={styles.greetingWrap}>
            <Text style={styles.greeting}>{greeting()}，{displayName}</Text>
            <Text style={styles.subGreeting}>今天是专注与创造的好日子</Text>
          </View>
          <TouchableOpacity activeOpacity={0.85} onPress={goProfile} style={styles.avatarBtn}>
            <Text style={styles.avatarText}>{initial}</Text>
          </TouchableOpacity>
        </View>

        {/* ============ Agent 状态 pill ============ */}
        <View style={styles.agentPillRow}>
          <View style={styles.agentPill}>
            <View style={[styles.agentDot, { backgroundColor: Agent }]} />
            <Text style={styles.agentPillText}>Lynx Agent 就绪</Text>
          </View>
        </View>

        {/* ============ 中央呼吸球 ============ */}
        <View style={styles.ballContainer}>
          <BreathingBall onPress={goVoiceCall} />
          <Text style={styles.ballHint}>点击开始全双工语音通话</Text>
        </View>

        {/* ============ 今日概览：3 个统计胶囊 ============ */}
        <View style={styles.statsRow}>
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <View key={s.label} style={styles.statCapsule}>
                <Icon size={14} color={s.accent} />
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            );
          })}
        </View>

        {/* ============ 快捷入口 ============ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快捷入口</Text>
          <View style={styles.quickRow}>
            {quickEntries.map((q) => {
              const Icon = q.icon;
              return (
                <TouchableOpacity
                  key={q.label}
                  style={styles.quickCard}
                  activeOpacity={0.85}
                  onPress={q.onPress}
                >
                  <View style={[styles.quickIcon, { backgroundColor: `${q.accent}22` }]}>
                    <Icon size={20} color={q.accent} />
                  </View>
                  <Text style={styles.quickLabel}>{q.label}</Text>
                  <Text style={styles.quickDesc}>{q.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ============ 最近飞书任务 Top 3 ============ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>最近飞书任务</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Tasks')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.moreText}>看全部</Text>
            </TouchableOpacity>
          </View>

          {recentLarkTasks.length === 0 ? (
            <View style={styles.emptyCard}>
              <ListChecks size={28} color={TextMuted} />
              <Text style={styles.emptyText}>暂无飞书任务</Text>
            </View>
          ) : (
            <View style={styles.taskList}>
              {recentLarkTasks.map((t, idx) => (
                <TouchableOpacity
                  key={t.guid}
                  style={[styles.taskCard, idx === recentLarkTasks.length - 1 && styles.taskCardLast]}
                  activeOpacity={0.85}
                  onPress={() => openLarkTask(t.url)}
                  disabled={!t.url}
                >
                  <View
                    style={[
                      styles.taskIndicator,
                      { backgroundColor: t.completed ? Agent : Primary },
                    ]}
                  />
                  <View style={styles.taskContent}>
                    <Text
                      style={[styles.taskSummary, t.completed && styles.taskSummaryDone]}
                      numberOfLines={1}
                    >
                      {t.summary || '(无标题)'}
                    </Text>
                    <Text style={styles.taskMeta}>
                      {t.completed ? '已完成' : '待处理'} · {formatTime(t.updatedAt ?? t.createdAt)}
                    </Text>
                  </View>
                  {t.url ? <ChevronRight size={16} color={TextMuted} /> : null}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ============ 右下角 FAB：灵感速记 ============ */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={goIdeaPanel}
      >
        <Zap size={26} color={TextPrimary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ============ 样式（深邃星空蓝深色主题） ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Void,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
  },
  // 顶部栏
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  greetingWrap: {
    flex: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: TextPrimary,
  },
  subGreeting: {
    fontSize: 13,
    color: TextMuted,
    marginTop: 4,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LiquidHighlight,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: TextPrimary,
  },
  // Agent 状态 pill
  agentPillRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  agentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Liquid2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LiquidBorder,
  },
  agentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  agentPillText: {
    fontSize: 12,
    color: TextPrimary,
    fontWeight: '500',
  },
  // 中央呼吸球
  ballContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  ballWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 180,
    height: 180,
  },
  ballGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: PrimaryGlow,
  },
  ball: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Primary,
    borderWidth: 1,
    borderColor: LiquidHighlight,
    shadowColor: PrimaryDeep,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  ballLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TextPrimary,
    marginTop: 6,
  },
  ballHint: {
    fontSize: 12,
    color: TextMuted,
    marginTop: 12,
  },
  // 统计胶囊
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  statCapsule: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Liquid2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LiquidBorder,
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: TextPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: TextMuted,
  },
  // 区块
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TextPrimary,
    marginBottom: 10,
  },
  moreText: {
    fontSize: 13,
    color: Primary,
  },
  // 快捷入口
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: Liquid2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LiquidBorder,
    gap: 6,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TextPrimary,
  },
  quickDesc: {
    fontSize: 11,
    color: TextMuted,
  },
  // 飞书任务列表
  taskList: {
    backgroundColor: Liquid3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LiquidBorder,
    overflow: 'hidden',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LiquidBorder,
  },
  taskCardLast: {
    borderBottomWidth: 0,
  },
  taskIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  taskContent: {
    flex: 1,
    gap: 3,
  },
  taskSummary: {
    fontSize: 14,
    fontWeight: '500',
    color: TextPrimary,
  },
  taskSummaryDone: {
    color: TextMuted,
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    fontSize: 11,
    color: TextMuted,
  },
  // 空状态
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: Liquid3,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LiquidBorder,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: TextMuted,
  },
  // 右下角 FAB
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
    borderWidth: 1,
    borderColor: LiquidHighlight,
    shadowColor: PrimaryDeep,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});

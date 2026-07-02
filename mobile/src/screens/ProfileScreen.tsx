// ============ 个人中心页（Profile 浮层） ============
// 顶部：用户头像 + 用户名
// 中部：设置项列表（主题模式 / 通知设置 / AI 模型设置 / 关于 / 退出登录）
// 深邃星空蓝深色主题（对齐 Kotlin 端，背景 Void，作为模态浮层使用）

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Sun,
  Moon,
  Monitor,
  Bell,
  Cpu,
  Info,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import {
  Void,
  Primary,
  Think,
  Agent,
  Danger,
  TextPrimary,
  TextMuted,
  Liquid2,
  LiquidBorder,
} from '@/theme/colors';

/** 主题模式 */
type ThemeMode = 'light' | 'dark' | 'system';

const THEME_LABEL: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
};

/** 设置项定义 */
interface SettingItem {
  key: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  /** 右侧副文案（可选） */
  value?: string;
  /** 点击回调（可选；无则仅展示） */
  onPress?: () => void;
  /** 是否危险操作（红色文字） */
  danger?: boolean;
}

export function ProfileScreen() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const [theme, setTheme] = useState<ThemeMode>('system');
  const [notifyEnabled, setNotifyEnabled] = useState(true);

  // 切换主题模式（浅色 → 深色 → 跟随系统 → 浅色）
  const cycleTheme = useCallback(() => {
    setTheme((prev) =>
      prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'
    );
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('退出登录', '确定要退出当前账号吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => logout() },
    ]);
  }, [logout]);

  // 用户名 / 头像首字母
  const displayName = user?.displayName || user?.username || '未登录';
  const initial = displayName.charAt(0).toUpperCase();

  // 主设置组
  const mainItems: SettingItem[] = [
    {
      key: 'theme',
      label: '主题模式',
      icon: theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor,
      iconColor: Primary,
      value: THEME_LABEL[theme],
      onPress: cycleTheme,
    },
    {
      key: 'notify',
      label: '通知设置',
      icon: Bell,
      iconColor: Think,
      value: notifyEnabled ? '已开启' : '已关闭',
      onPress: () => setNotifyEnabled((v) => !v),
    },
    {
      key: 'ai',
      label: 'AI 模型设置',
      icon: Cpu,
      iconColor: Agent,
      value: '默认',
      onPress: () => Alert.alert('提示', 'AI 模型设置功能即将上线'),
    },
  ];

  // 关于 / 退出登录
  const footerItems: SettingItem[] = [
    {
      key: 'about',
      label: '关于',
      icon: Info,
      iconColor: TextMuted,
      onPress: () => Alert.alert('关于 LynxHub', 'Lynx AI 超级助理\n桌面端补充版本\nv0.1.0'),
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: LogOut,
      iconColor: Danger,
      onPress: handleLogout,
      danger: true,
    },
  ];

  const renderRow = (item: SettingItem) => {
    const Icon = item.icon;
    return (
      <TouchableOpacity
        key={item.key}
        style={styles.row}
        activeOpacity={0.85}
        onPress={item.onPress}
        disabled={!item.onPress}
      >
        <View style={[styles.rowIcon, { backgroundColor: `${item.iconColor}1A` }]}>
          <Icon size={18} color={item.iconColor} />
        </View>
        <Text style={[styles.rowLabel, item.danger && styles.rowLabelDanger]}>
          {item.label}
        </Text>
        {item.value && (
          <Text style={[styles.rowValue, item.danger && styles.rowValueDanger]}>
            {item.value}
          </Text>
        )}
        {item.onPress && !item.danger && <ChevronRight size={16} color={TextMuted} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ============ 用户信息卡片 ============ */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.role}>
              {user?.role ? `角色：${user.role}` : '点击登录以同步数据'}
            </Text>
          </View>
        </View>

        {/* ============ 主设置组 ============ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>偏好设置</Text>
          <View style={styles.groupCard}>
            {mainItems.map((item, idx) => (
              <React.Fragment key={item.key}>
                {renderRow(item)}
                {idx < mainItems.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ============ 其他 ============ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>其他</Text>
          <View style={styles.groupCard}>
            {footerItems.map((item, idx) => (
              <React.Fragment key={item.key}>
                {renderRow(item)}
                {idx < footerItems.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        <Text style={styles.footerText}>LynxHub Mobile · v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============ 样式（深邃星空蓝深色主题，背景 Void） ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Void,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  // 用户卡片（液态玻璃）
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Liquid2,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: LiquidBorder,
    shadowColor: Primary,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: TextPrimary,
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: TextPrimary,
    marginBottom: 4,
  },
  role: {
    fontSize: 13,
    color: TextMuted,
  },
  // 分组
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TextMuted,
    marginLeft: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupCard: {
    backgroundColor: Liquid2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LiquidBorder,
    shadowColor: Primary,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  // 行
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: TextPrimary,
  },
  rowLabelDanger: {
    color: Danger,
  },
  rowValue: {
    fontSize: 14,
    color: TextMuted,
  },
  rowValueDanger: {
    color: Danger,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LiquidBorder,
    marginLeft: 60,
  },
  // 底部
  footerText: {
    fontSize: 12,
    color: TextMuted,
    textAlign: 'center',
    marginTop: 32,
  },
});

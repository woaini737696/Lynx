// ============ 占位页面 ============
// 5 个核心功能页面暂用占位，后续逐步实现

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PlaceholderScreenProps {
  /** 功能名称 */
  title: string;
  /** 功能描述 */
  subtitle?: string;
}

export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        {/* 功能名称 */}
        <Text style={styles.title}>{title}</Text>

        {/* 功能描述 */}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        {/* 开发中标识 */}
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>开发中</Text>
        </View>

        {/* 提示文案 */}
        <Text style={styles.hint}>此功能正在开发中，敬请期待</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0B1220',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
  },
  // 开发中徽章
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)', // 琥珀金 10% 透明度
    borderRadius: 20,
    gap: 6,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B', // 琥珀金
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  hint: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 16,
  },
});

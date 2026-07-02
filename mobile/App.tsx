// ============ LynxHub Mobile 入口 ============
// SafeAreaProvider 包裹 → NavigationContainer → AppNavigator
// 启动时从 AsyncStorage 恢复登录状态，根据登录状态路由到登录页或主页
// 深邃星空蓝深色主题（强制深色，对齐 Kotlin 端）

import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { useAuth } from './src/lib/auth';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Void, Primary, TextPrimary, LiquidBorder, Danger } from './src/theme/colors';

// 深色主题（与 Kotlin 端深邃星空蓝深色主题对齐）
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Primary,          // 品牌色 #4B9FFF
    background: Void,          // 页面背景 #02040C
    card: Void,                // 卡片底色
    text: TextPrimary,         // 主文本 #F6F8FF
    border: LiquidBorder,      // 边框 rgba(255,255,255,0.22)
    notification: Danger,      // 危险色 #FF5A5A
  },
};

export default function App() {
  const isLoading = useAuth((s) => s.isLoading);
  const hydrate = useAuth((s) => s.hydrate);

  // App 启动：从 AsyncStorage 恢复登录状态
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 加载中：显示启动屏
  if (isLoading) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={theme}>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Void,
  },
});

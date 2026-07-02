// ============ 导航器 ============
// 根据登录状态切换 LoginScreen / MainTabs
// MainTabs 包含 4 个核心 Tab：首页 / Lynx 助理 / 任务 / 记忆
// 与 Kotlin 端对齐：灵感速记(IdeaPanel) / 语音通话(CallScreen) 作为 Stack 浮层
// Profile 作为从首页头像入口进入的 Root 浮层
// 底部 Tab Bar 使用深色液态玻璃效果

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Sparkles,
  LayoutGrid,
  Brain,
  Home as HomeIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth';
import { LoginScreen } from '@/screens/LoginScreen';
import { BoardScreen } from '@/screens/BoardScreen';
import { MemoryScreen } from '@/screens/MemoryScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import {
  AssistantStackNavigator,
  type AssistantStackParamList,
} from '@/navigation/AssistantStack';
import { Void, Primary, TextMuted, TabBarDarkAndroid } from '@/theme/colors';

// ============ 类型定义 ============

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  /** 个人中心 / 设置浮层（从首页头像入口进入） */
  Profile: undefined;
};

export type MainTabParamList = {
  /** 首页（今日工作台） */
  Home: undefined;
  /** Lynx 助理（嵌套 AssistantStack，含 IdeaPanel / VoiceCall 浮层） */
  Assistant: NavigatorScreenParams<AssistantStackParamList>;
  /** 任务（飞书任务看板） */
  Tasks: undefined;
  /** 记忆（记忆图谱） */
  Memory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// ============ Tab 图标映射 ============

const tabIcons: Record<keyof MainTabParamList, LucideIcon> = {
  Home: HomeIcon,
  Assistant: Sparkles,
  Tasks: LayoutGrid,
  Memory: Brain,
};

// ============ 主 Tab 页（4 个核心功能，对齐 Kotlin 端） ============

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // 深色液态玻璃 Tab Bar 配色（对齐 Kotlin 深色主题）
        tabBarActiveTintColor: Primary,
        tabBarInactiveTintColor: TextMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        // 深色液态玻璃 Tab Bar
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        // iOS 使用 BlurView tint="dark" 实现真实毛玻璃，Android 用半透明深色模拟
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: TabBarDarkAndroid }]} />
          ),
        tabBarIcon: ({ color, size }) => {
          const Icon = tabIcons[route.name as keyof MainTabParamList];
          return <Icon color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Home" options={{ tabBarLabel: '首页' }} component={HomeScreen} />
      <Tab.Screen name="Assistant" options={{ tabBarLabel: 'Lynx 助理' }}>
        {() => <AssistantStackNavigator />}
      </Tab.Screen>
      <Tab.Screen name="Tasks" options={{ tabBarLabel: '任务' }} component={BoardScreen} />
      <Tab.Screen name="Memory" options={{ tabBarLabel: '记忆' }} component={MemoryScreen} />
    </Tab.Navigator>
  );
}

// ============ 根导航器 ============

export function AppNavigator() {
  const isLoggedIn = useAuth((s) => s.isLoggedIn);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isLoggedIn ? (
        <>
          {/* 主 Tab 页（4 个核心功能） */}
          <Stack.Screen name="Main" component={MainTabs} />
          {/* 个人中心 / 设置浮层（从首页头像入口进入，模态呈现） */}
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              headerShown: false,
              contentStyle: { backgroundColor: Void },
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

// ============ 助理模块导航栈 ============
// Stack Navigator：助理页面（主） + 灵感速记浮层 + 语音通话浮层
// 嵌套在 MainTabs 的 Assistant Tab 下
// 与 Kotlin 端对齐：灵感速记(IdeaPanel) / 全双工通话(CallScreen) 作为全屏浮层

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AssistantScreen } from '@/screens/AssistantScreen';
import { InboxScreen } from '@/screens/InboxScreen';
import { VoiceCallScreen } from '@/screens/VoiceCallScreen';

// ============ 类型定义 ============

/** 助理模块导航参数 */
export type AssistantStackParamList = {
  /** 助理主页面（AI 聊天 + 工具调用） */
  Assistant: undefined;
  /** 灵感速记浮层（模态呈现，复用 InboxScreen） */
  IdeaPanel: undefined;
  /** 全双工语音通话浮层（模态呈现） */
  VoiceCall: undefined;
};

const AssistantStack = createNativeStackNavigator<AssistantStackParamList>();

// ============ 导航器组件 ============

/**
 * 助理模块导航栈。
 *
 * - Assistant：助理主页面，作为 Tab 内容平铺展示
 * - IdeaPanel：灵感速记浮层，以全屏模态呈现，复用 InboxScreen 组件
 * - VoiceCall：语音通话浮层，以全屏模态呈现（presentation: 'modal'），
 *   进入时从底部滑入，退出时向下滑出，符合 iOS 26 模态交互规范
 */
export function AssistantStackNavigator() {
  return (
    <AssistantStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* 助理主页面 */}
      <AssistantStack.Screen name="Assistant" component={AssistantScreen} />

      {/* 灵感速记浮层（模态呈现） */}
      <AssistantStack.Screen
        name="IdeaPanel"
        component={InboxScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />

      {/* 语音通话浮层（模态呈现） */}
      <AssistantStack.Screen
        name="VoiceCall"
        component={VoiceCallScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: false, // 禁用下滑关闭（通话中误触）
          headerShown: false,
        }}
      />
    </AssistantStack.Navigator>
  );
}

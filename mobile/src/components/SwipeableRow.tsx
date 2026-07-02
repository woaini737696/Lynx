// ============ 可滑动行组件 ============
// 通用左滑/右滑手势行：右滑触发左侧动作，左滑触发右侧动作。
// 基于 PanResponder + Animated 实现，不依赖 react-native-gesture-handler。
// Inbox/Board 页面复用：传入不同的 leftAction/rightAction 配置即可。

import React, { useRef } from 'react';
import { View, Text, Animated, PanResponder, StyleSheet } from 'react-native';

/** 滑动动作配置 */
export interface SwipeAction {
  /** 按钮文字 */
  label: string;
  /** 按钮背景色 */
  color: string;
  /** 触发回调 */
  onPress: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  /** 右滑露出（左侧按钮） */
  leftAction?: SwipeAction;
  /** 左滑露出（右侧按钮） */
  rightAction?: SwipeAction;
  /** 动作按钮宽度 */
  actionWidth?: number;
}

const DEFAULT_ACTION_WIDTH = 80;

export function SwipeableRow({
  children,
  leftAction,
  rightAction,
  actionWidth = DEFAULT_ACTION_WIDTH,
}: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const offsetX = useRef(0);

  const maxLeft = leftAction ? actionWidth : 0;
  const maxRight = rightAction ? actionWidth : 0;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gesture) => Math.abs(gesture.dx) > 6,
      onPanResponderGrant: () => {
        offsetX.current = (translateX as unknown as { _value: number })._value ?? 0;
      },
      onPanResponderMove: (_e, gesture) => {
        let next = offsetX.current + gesture.dx;
        // 限制滑动范围在两侧动作按钮宽度内
        next = Math.max(-maxRight, Math.min(maxLeft, next));
        translateX.setValue(next);
      },
      onPanResponderRelease: () => {
        const value = (translateX as unknown as { _value: number })._value ?? 0;
        // 释放时根据露出的方向触发对应动作
        if (value >= maxLeft / 2 && leftAction) {
          leftAction.onPress();
        } else if (value <= -maxRight / 2 && rightAction) {
          rightAction.onPress();
        }
        // 回弹到原位
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 7,
        }).start();
        offsetX.current = 0;
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* 动作按钮层（底层） */}
      <View style={styles.actionsLayer}>
        {leftAction && (
          <View style={[styles.actionBtn, { left: 0, backgroundColor: leftAction.color }]}>
            <Text style={styles.actionText}>{leftAction.label}</Text>
          </View>
        )}
        {rightAction && (
          <View style={[styles.actionBtn, { right: 0, backgroundColor: rightAction.color }]}>
            <Text style={styles.actionText}>{rightAction.label}</Text>
          </View>
        )}
      </View>
      {/* 内容层（上层，跟随手势位移） */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.content, { transform: [{ translateX }] }]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  actionsLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  actionBtn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: DEFAULT_ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    backgroundColor: 'transparent',
  },
});

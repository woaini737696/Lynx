package com.lynnhub.app.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.tween

/**
 * Lynx Android UI 重构设计规范 v3 —— 动效系统
 *
 * 来源：docs/specs/2026-06-28-lynx-android-ui-redesign-spec.md
 * 全局缓动：--ease-glass: cubic-bezier(0.22, 1, 0.36, 1)
 * 弹性缓动：--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
 *
 * | 场景           | 时长  | 曲线                          | 说明                       |
 * |---------------|-------|-------------------------------|---------------------------|
 * | 页面切换       | 350ms | cubic-bezier(0.22,1,0.36,1)   | 水平/垂直滑入               |
 * | 按钮按压       | 150ms | ease                          | scale 0.97                |
 * | 卡片浮起       | 300ms | cubic-bezier(0.22,1,0.36,1)   | translateY(-2dp)          |
 * | 呼吸球呼吸     | 4000ms| ease-in-out                   | scale 1 → 1.05            |
 * | 通话波纹       | 2400ms| ease-out                      | scale 0.75 → 1.65         |
 * | 列表删除       | 200ms | ease                          | slide-out                 |
 * | Toast          | 300ms | ease                          | fade + translateY         |
 * | Dock 显隐      | 350ms | cubic-bezier(0.22,1,0.36,1)   | translateY + opacity      |
 * | 设置侧滑       | 400ms | cubic-bezier(0.22,1,0.36,1)   | translateX(110%) → 0      |
 * | 气泡进入       | 350ms | cubic-bezier(0.22,1,0.36,1)   | fadeInUp                  |
 */
object Motion {

    /** 全局 glass 缓动曲线（对应 CSS --ease-glass） */
    val EaseGlass: Easing = CubicBezierEasing(0.22f, 1.0f, 0.36f, 1.0f)

    /** 弹性缓动（对应 CSS --ease-spring） */
    val EaseSpring: Easing = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1.0f)

    // ====== 时长常量（毫秒）======
    const val DURATION_PAGE_TRANSITION = 350   // 页面切换 0.35s
    const val DURATION_BUTTON_PRESS = 150      // 按钮点击 0.15s
    const val DURATION_CARD_HOVER = 300        // 卡片浮起 0.3s
    const val DURATION_BREATH = 4000           // 呼吸球 4s
    const val DURATION_CALL_WAVE = 2400        // 通话波纹 2.4s
    const val DURATION_LIST_DELETE = 200       // 列表删除 0.2s
    const val DURATION_TOAST = 300             // 提示条 0.3s
    const val DURATION_DOCK = 350              // Dock 显隐 0.35s
    const val DURATION_SETTINGS_PANEL = 400    // 设置侧滑 0.4s
    const val DURATION_CHAT_BUBBLE = 350       // 聊天气泡进入 0.35s
    const val DURATION_BACK_BUTTON = 200       // 返回按钮 hover 0.2s

    // ====== 页面切换 Spec（0.35s + EaseGlass）======
    fun <T> pageTransitionSpec() = tween<T>(
        durationMillis = DURATION_PAGE_TRANSITION,
        easing = EaseGlass
    )

    fun <T> pageTransitionExitSpec() = tween<T>(
        durationMillis = DURATION_PAGE_TRANSITION,
        easing = EaseGlass
    )

    // ====== 按钮点击 Spec（0.15s + ease）======
    fun <T> buttonPressSpec() = tween<T>(
        durationMillis = DURATION_BUTTON_PRESS,
        easing = EaseInOut
    )

    // ====== 卡片浮起 Spec（0.3s + EaseGlass）======
    fun <T> cardHoverSpec() = tween<T>(
        durationMillis = DURATION_CARD_HOVER,
        easing = EaseGlass
    )

    // ====== 提示条 Spec（0.3s + ease）======
    fun <T> toastSpec() = tween<T>(
        durationMillis = DURATION_TOAST,
        easing = EaseInOut
    )

    // ====== Dock 显隐 Spec（0.35s + EaseGlass）======
    fun <T> dockSpec() = tween<T>(
        durationMillis = DURATION_DOCK,
        easing = EaseGlass
    )

    // ====== 设置侧滑 Spec（0.4s + EaseGlass）======
    fun <T> settingsPanelSpec() = tween<T>(
        durationMillis = DURATION_SETTINGS_PANEL,
        easing = EaseGlass
    )

    // ====== 聊天气泡进入 Spec（0.35s + EaseGlass）======
    fun <T> chatBubbleSpec() = tween<T>(
        durationMillis = DURATION_CHAT_BUBBLE,
        easing = EaseGlass
    )

    // ====== 通话波纹 Spec（2.4s + ease-out）======
    fun <T> callWaveSpec(delayMillis: Int = 0) = tween<T>(
        durationMillis = DURATION_CALL_WAVE,
        delayMillis = delayMillis,
        easing = EaseOut
    )

    // ====== 呼吸球 Spec（4s + ease-in-out）======
    fun <T> breathSpec() = tween<T>(
        durationMillis = DURATION_BREATH,
        easing = EaseInOut
    )
}

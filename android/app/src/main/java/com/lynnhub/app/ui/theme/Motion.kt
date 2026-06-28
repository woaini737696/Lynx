package com.lynnhub.app.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween

/**
 * Lynx v6 全局动效规范
 *
 * 来自 Lynx_Android_Complete_v6.html 动效系统表：
 *
 * | 场景     | 时长  | 曲线                              | 效果              |
 * |---------|-------|-----------------------------------|-------------------|
 * | 页面切换 | 0.35s | cubic-bezier(0.22,1,0.36,1)       | 滑入/滑出          |
 * | 按钮点击 | 0.15s | ease                              | scale(0.96)       |
 * | 卡片浮起 | 0.3s  | cubic-bezier(0.22,1,0.36,1)       | translateY(-2px)  |
 * | 呼吸球   | 4s    | ease-in-out                       | scale(1.03)       |
 * | 列表删除 | 0.2s  | ease                              | 左滑 + 高度收缩    |
 * | 提示条   | 0.3s  | ease                              | fade + translateY |
 * | 通话波纹 | 2s    | ease-out                          | scale(1.6)+opacity|
 *
 * 全局 easing 变量：--ease-expo: cubic-bezier(0.22, 1, 0.36, 1)
 */
object Motion {

    /** 全局 expo 缓动曲线（对应 CSS --ease-expo） */
    val EaseExpo: Easing = CubicBezierEasing(0.22f, 1.0f, 0.36f, 1.0f)

    // ====== 时长常量（毫秒）======
    const val DURATION_PAGE_TRANSITION = 350   // 页面切换 0.35s
    const val DURATION_BUTTON_PRESS = 150      // 按钮点击 0.15s
    const val DURATION_CARD_HOVER = 300        // 卡片浮起 0.3s
    const val DURATION_BREATH = 4000           // 呼吸球 4s
    const val DURATION_LIST_DELETE = 200       // 列表删除 0.2s
    const val DURATION_TOAST = 300             // 提示条 0.3s
    const val DURATION_CALL_WAVE = 2000        // 通话波纹 2s
    const val DURATION_BACK_BUTTON = 200       // 返回按钮 hover 0.2s

    // ====== 页面切换 Spec（0.35s + EaseExpo）======
    /** 页面切换进入动画 Spec */
    fun <T> pageTransitionSpec() = tween<T>(
        durationMillis = DURATION_PAGE_TRANSITION,
        easing = EaseExpo
    )

    /** 页面切换退出动画 Spec */
    fun <T> pageTransitionExitSpec() = tween<T>(
        durationMillis = DURATION_PAGE_TRANSITION,
        easing = EaseExpo
    )

    // ====== 按钮点击 Spec（0.15s + ease）======
    fun <T> buttonPressSpec() = tween<T>(
        durationMillis = DURATION_BUTTON_PRESS,
        easing = EaseInOut
    )

    // ====== 提示条 Spec（0.3s + ease）======
    fun <T> toastSpec() = tween<T>(
        durationMillis = DURATION_TOAST,
        easing = EaseInOut
    )

    // ====== 通话波纹 Spec（2s + ease-out）======
    fun <T> callWaveSpec(delayMillis: Int = 0) = tween<T>(
        durationMillis = DURATION_CALL_WAVE,
        delayMillis = delayMillis,
        easing = EaseOut
    )
}

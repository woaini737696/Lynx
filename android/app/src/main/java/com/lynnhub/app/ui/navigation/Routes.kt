package com.lynnhub.app.ui.navigation

/**
 * Lynx v6 导航路由
 *
 * 四个核心页面通过底部 Dock 切换，设置面板从右侧滑入（非全屏），
 * 灵感速记和全双工通话为全屏浮层。
 */
object Routes {
    // 四个核心页面（底部 Dock 始终显示）
    const val HOME = "home"
    const val ASSISTANT = "assistant"
    const val TASKS = "tasks"
    const val MEMORY = "memory"

    // 全屏浮层（Dock 隐藏）
    const val IDEA_PANEL = "idea"
    const val CALL = "call"

    // 设置面板（右侧 88% 侧滑，Dock 隐藏）
    const val SETTINGS = "settings"

    // 设置子页面（从右侧滑入）
    const val PROFILE = "profile"
    const val AI_KEY = "ai_key"
    const val DEVICES = "devices"
    const val MEMORY_SETTINGS = "memory_settings"
    const val COGNITION = "cognition"
    const val NOTIFICATION = "notification"
    const val UPDATE = "update"
    const val ABOUT = "about"
}

/** 核心页面路由集合 */
val coreRoutes = setOf(Routes.HOME, Routes.ASSISTANT, Routes.TASKS, Routes.MEMORY)

/** 子页面/浮层路由集合（这些页面隐藏 Dock） */
val childRoutes = setOf(
    Routes.IDEA_PANEL,
    Routes.CALL,
    Routes.SETTINGS,
    Routes.PROFILE,
    Routes.AI_KEY,
    Routes.DEVICES,
    Routes.MEMORY_SETTINGS,
    Routes.COGNITION,
    Routes.NOTIFICATION,
    Routes.UPDATE,
    Routes.ABOUT
)

fun String?.shouldShowDock(): Boolean = this in coreRoutes

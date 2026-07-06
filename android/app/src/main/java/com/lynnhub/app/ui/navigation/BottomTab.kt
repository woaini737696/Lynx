package com.lynnhub.app.ui.navigation

import androidx.compose.ui.graphics.vector.ImageVector
import com.lynnhub.app.ui.component.LynxIcons

/**
 * 底部 Dock 四个核心 Tab
 *
 * 顺序：首页 / 奇思助理 / 任务 / 记忆
 */
sealed class BottomTab(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Home : BottomTab(
        Routes.HOME,
        "首页",
        LynxIcons.Home
    )

    data object Assistant : BottomTab(
        Routes.ASSISTANT,
        "奇思助理",
        LynxIcons.Assistant
    )

    data object Tasks : BottomTab(
        Routes.TASKS,
        "任务",
        LynxIcons.Tasks
    )

    data object Memory : BottomTab(
        Routes.MEMORY,
        "记忆",
        LynxIcons.Memory
    )
}

val bottomTabs = listOf(
    BottomTab.Home,
    BottomTab.Assistant,
    BottomTab.Tasks,
    BottomTab.Memory
)

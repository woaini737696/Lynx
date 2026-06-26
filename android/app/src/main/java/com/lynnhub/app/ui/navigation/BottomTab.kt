package com.lynnhub.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * 底部导航 5 个 Tab
 * 对应 uniapp pages.json 的 tabBar 配置
 */
sealed class BottomTab(
    val route: String,
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    data object Focus : BottomTab(
        "focus",
        "聚焦",
        Icons.Filled.RadioButtonChecked,
        Icons.Outlined.RadioButtonUnchecked
    )

    data object Board : BottomTab(
        "board",
        "看板",
        Icons.Filled.Dashboard,
        Icons.Outlined.Dashboard
    )

    data object Chat : BottomTab(
        "hermes",
        "Hermes",
        Icons.Filled.SmartToy,
        Icons.Outlined.SmartToy
    )

    data object Tasks : BottomTab(
        "tasks",
        "任务",
        Icons.Filled.CheckCircle,
        Icons.Outlined.CheckCircle
    )

    data object Settings : BottomTab(
        "settings",
        "我的",
        Icons.Filled.Person,
        Icons.Outlined.Person
    )
}

val bottomTabs = listOf(
    BottomTab.Focus,
    BottomTab.Board,
    BottomTab.Chat,
    BottomTab.Tasks,
    BottomTab.Settings
)

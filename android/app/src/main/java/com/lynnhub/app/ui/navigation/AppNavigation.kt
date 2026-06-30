package com.lynnhub.app.ui.navigation

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.runtime.Composable
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.lynnhub.app.ui.screen.assistant.AssistantScreen
import com.lynnhub.app.ui.screen.home.HomeScreen
import com.lynnhub.app.ui.screen.memory.MemoryScreen
import com.lynnhub.app.ui.screen.panel.AgentPanel
import com.lynnhub.app.ui.screen.panel.IdeaPanel
import com.lynnhub.app.ui.screen.settings.SettingsScreen
import com.lynnhub.app.ui.screen.tasks.TasksScreen
import com.lynnhub.app.ui.theme.Motion

/**
 * Lynx v6 导航架构
 *
 * 四个核心页面通过底部 Dock 切换，支持左右滑动手势。
 * 灵感速记和全双工通话为全屏浮层。
 * 设置面板从右侧 88% 侧滑进入，子页面从右侧滑入。
 */
@Composable
fun AppNavigation(
    navController: NavHostController,
    onLogout: () -> Unit
) {
    val duration = Motion.DURATION_PAGE_TRANSITION
    val easing = Motion.EaseGlass

    NavHost(
        navController = navController,
        startDestination = Routes.HOME
    ) {
        // ====== 四个核心页面 ======
        coreComposable(Routes.HOME) {
            HomeScreen(
                onOpenSettings = { navController.navigate(Routes.SETTINGS) },
                onOpenIdea = { navController.navigate(Routes.IDEA_PANEL) },
                onOpenCall = { navController.navigate(Routes.CALL) }
            )
        }

        coreComposable(Routes.ASSISTANT) {
            AssistantScreen(
                onOpenSettings = { navController.navigate(Routes.SETTINGS) }
            )
        }

        coreComposable(Routes.TASKS) {
            TasksScreen(
                onOpenSettings = { navController.navigate(Routes.SETTINGS) }
            )
        }

        coreComposable(Routes.MEMORY) {
            MemoryScreen(
                onOpenSettings = { navController.navigate(Routes.SETTINGS) }
            )
        }

        // ====== 灵感速记浮层（统一水平滑入） ======
        composable(
            route = Routes.IDEA_PANEL,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            IdeaPanel(onBack = { navController.popBackStack() })
        }

        // ====== 全双工通话（统一水平滑入） ======
        composable(
            route = Routes.CALL,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            com.lynnhub.app.ui.screen.panel.CallScreen(onBack = { navController.popBackStack() })
        }

        // ====== Agent 远程浮层（统一水平滑入） ======
        composable(
            route = Routes.AGENT,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            AgentPanel(onBack = { navController.popBackStack() })
        }

        // ====== 设置面板（从右侧滑入，88% 宽度侧滑面板，400ms 专用时长） ======
        composable(
            route = Routes.SETTINGS,
            enterTransition = { slideInHorizontally(tween(Motion.DURATION_SETTINGS_PANEL, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(Motion.DURATION_SETTINGS_PANEL, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(Motion.DURATION_SETTINGS_PANEL, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(Motion.DURATION_SETTINGS_PANEL, easing = easing)) { it } }
        ) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onLogout = onLogout,
                onNavigateToProfile = { navController.navigate(Routes.PROFILE) },
                onNavigateToAiKey = { navController.navigate(Routes.AI_KEY) },
                onNavigateToDevices = { navController.navigate(Routes.DEVICES) },
                onNavigateToMemory = { navController.navigate(Routes.MEMORY_SETTINGS) },
                onNavigateToCognition = { navController.navigate(Routes.COGNITION) },
                onNavigateToNotification = { navController.navigate(Routes.NOTIFICATION) },
                onNavigateToUpdate = { navController.navigate(Routes.UPDATE) },
                onNavigateToAbout = { navController.navigate(Routes.ABOUT) },
                onNavigateToTokenAnalysis = { navController.navigate(Routes.TOKEN_ANALYSIS) }
            )
        }

        // ====== 设置子页面（从右侧滑入） ======
        subPageComposable(Routes.PROFILE) {
            com.lynnhub.app.ui.screen.settings.ProfilePage(onBack = { navController.popBackStack() })
        }
        subPageComposable(Routes.AI_KEY) {
            com.lynnhub.app.ui.screen.settings.AiKeyPage(onBack = { navController.popBackStack() })
        }
        subPageComposable(Routes.DEVICES) {
            com.lynnhub.app.ui.screen.settings.DevicesPage(onBack = { navController.popBackStack() })
        }
        subPageComposable(Routes.MEMORY_SETTINGS) {
            com.lynnhub.app.ui.screen.settings.MemoryPage(onBack = { navController.popBackStack() })
        }
        subPageComposable(Routes.COGNITION) {
            com.lynnhub.app.ui.screen.settings.CognitionPage(onBack = { navController.popBackStack() })
        }
        subPageComposable(Routes.NOTIFICATION) {
            com.lynnhub.app.ui.screen.settings.NotificationPage(onBack = { navController.popBackStack() })
        }
        subPageComposable(Routes.UPDATE) {
            com.lynnhub.app.ui.screen.settings.UpdatePage(onBack = { navController.popBackStack() })
        }
        subPageComposable(Routes.ABOUT) {
            com.lynnhub.app.ui.screen.settings.AboutPage(onBack = { navController.popBackStack() })
        }
        subPageComposable(Routes.TOKEN_ANALYSIS) {
            com.lynnhub.app.ui.screen.settings.TokenAnalysisPage(onBack = { navController.popBackStack() })
        }
    }
}

/**
 * 核心页面通用 composable：根据当前 route 在 Dock 顺序中的位置，
 * 自动判断左右滑动方向并应用水平滑入/滑出转场。
 */
private fun androidx.navigation.NavGraphBuilder.coreComposable(
    route: String,
    content: @Composable (NavBackStackEntry) -> Unit
) {
    val duration = Motion.DURATION_PAGE_TRANSITION
    val easing = Motion.EaseGlass

    composable(
        route = route,
        enterTransition = {
            val dir = direction(initialState.destination.route, targetState.destination.route)
            when {
                dir > 0 -> slideInHorizontally(tween(duration, easing = easing)) { it }
                dir < 0 -> slideInHorizontally(tween(duration, easing = easing)) { -it }
                else -> fadeIn(tween(duration, easing = easing))
            }
        },
        exitTransition = {
            val dir = direction(initialState.destination.route, targetState.destination.route)
            when {
                dir > 0 -> slideOutHorizontally(tween(duration, easing = easing)) { -it }
                dir < 0 -> slideOutHorizontally(tween(duration, easing = easing)) { it }
                else -> fadeOut(tween(duration, easing = easing))
            }
        },
        popEnterTransition = {
            val dir = direction(initialState.destination.route, targetState.destination.route)
            when {
                dir > 0 -> slideInHorizontally(tween(duration, easing = easing)) { it }
                dir < 0 -> slideInHorizontally(tween(duration, easing = easing)) { -it }
                else -> fadeIn(tween(duration, easing = easing))
            }
        },
        popExitTransition = {
            val dir = direction(initialState.destination.route, targetState.destination.route)
            when {
                dir > 0 -> slideOutHorizontally(tween(duration, easing = easing)) { -it }
                dir < 0 -> slideOutHorizontally(tween(duration, easing = easing)) { it }
                else -> fadeOut(tween(duration, easing = easing))
            }
        }
    ) { content(it) }
}

/** 设置子页面通用 composable：统一从右侧滑入，400ms 专用时长 */
private fun androidx.navigation.NavGraphBuilder.subPageComposable(
    route: String,
    content: @Composable (NavBackStackEntry) -> Unit
) {
    val duration = Motion.DURATION_SETTINGS_PANEL
    val easing = Motion.EaseGlass

    composable(
        route = route,
        enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
        exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
        popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
        popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
    ) { content(it) }
}

/** 计算两个 route 在 Dock 顺序中的相对方向：+1 向右，-1 向左，0 未知/同页 */
private fun direction(initialRoute: String?, targetRoute: String?): Int {
    val tabs = listOf(Routes.HOME, Routes.ASSISTANT, Routes.TASKS, Routes.MEMORY)
    val initialIndex = tabs.indexOf(initialRoute)
    val targetIndex = tabs.indexOf(targetRoute)
    if (initialIndex == -1 || targetIndex == -1) return 0
    return targetIndex.compareTo(initialIndex)
}

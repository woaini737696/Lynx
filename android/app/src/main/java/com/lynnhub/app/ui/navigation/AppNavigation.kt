package com.lynnhub.app.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.lynnhub.app.ui.screen.home.HomeScreen
import com.lynnhub.app.ui.screen.panel.AgentPanel
import com.lynnhub.app.ui.screen.panel.ChatPanel
import com.lynnhub.app.ui.screen.panel.IdeaPanel
import com.lynnhub.app.ui.screen.panel.TaskPanel
import com.lynnhub.app.ui.screen.settings.SettingsScreen
import com.lynnhub.app.ui.theme.Motion

/**
 * Lynx v6 导航架构
 *
 * 单主页 + 浮层 + 设置面板 + 子页面
 * - 首页为唯一主页面（startDestination）
 * - 浮层通过手势触发，使用 navigate 跳转
 * - 设置面板从右侧滑入
 * - 子页面从设置面板进入
 *
 * 转场动画规范（来自 Lynx_Android_Complete_v6.html）：
 * - 统一 0.35s + cubic-bezier(0.22,1,0.36,1)
 * - 灵感速记（上滑进入）：从底部滑入
 * - 任务视图（下滑进入）：从顶部滑入
 * - AI 对话（左滑进入）：从右侧滑入
 * - Agent 远程（右滑进入）：从左侧滑入
 * - 设置面板/子页面：从右侧滑入
 * - 通话界面：淡入淡出（0.4s ease 特例）
 */
@Composable
fun AppNavigation(
    navController: NavHostController,
    onLogout: () -> Unit
) {
    val duration = Motion.DURATION_PAGE_TRANSITION
    val easing = Motion.EaseExpo

    NavHost(
        navController = navController,
        startDestination = Routes.HOME
    ) {
        // 主页面
        composable(Routes.HOME) {
            HomeScreen(
                onOpenSettings = { navController.navigate(Routes.SETTINGS) },
                onSwipeUp = { navController.navigate(Routes.IDEA_PANEL) },
                onSwipeDown = { navController.navigate(Routes.TASK_PANEL) },
                onSwipeLeft = { navController.navigate(Routes.CHAT_PANEL) },
                onSwipeRight = { navController.navigate(Routes.AGENT_PANEL) },
                onDoubleClick = { navController.navigate(Routes.CALL) }
            )
        }

        // 灵感速记（上滑进入 → 从底部滑入，下滑返回）
        composable(
            route = Routes.IDEA_PANEL,
            enterTransition = { slideInVertically(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutVertically(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInVertically(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutVertically(tween(duration, easing = easing)) { it } }
        ) {
            IdeaPanel(onBack = { navController.popBackStack() })
        }

        // 任务视图（下滑进入 → 从顶部滑入，上滑返回）
        composable(
            route = Routes.TASK_PANEL,
            enterTransition = { slideInVertically(tween(duration, easing = easing)) { -it } },
            exitTransition = { slideOutVertically(tween(duration, easing = easing)) { -it } },
            popEnterTransition = { slideInVertically(tween(duration, easing = easing)) { -it } },
            popExitTransition = { slideOutVertically(tween(duration, easing = easing)) { -it } }
        ) {
            TaskPanel(onBack = { navController.popBackStack() })
        }

        // AI 对话（左滑进入 → 从右侧滑入，右滑返回）
        composable(
            route = Routes.CHAT_PANEL,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            ChatPanel(onBack = { navController.popBackStack() })
        }

        // Agent 远程（右滑进入 → 从左侧滑入，左滑返回）
        composable(
            route = Routes.AGENT_PANEL,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { -it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { -it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { -it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { -it } }
        ) {
            AgentPanel(onBack = { navController.popBackStack() })
        }

        // 全双工通话（淡入淡出特例，0.4s ease）
        composable(
            route = Routes.CALL,
            enterTransition = { fadeIn(tween(400)) },
            exitTransition = { fadeOut(tween(400)) },
            popEnterTransition = { fadeIn(tween(400)) },
            popExitTransition = { fadeOut(tween(400)) }
        ) {
            com.lynnhub.app.ui.screen.panel.CallScreen(onBack = { navController.popBackStack() })
        }

        // 设置面板（从右侧滑入）
        composable(
            route = Routes.SETTINGS,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onLogout = onLogout,
                onNavigateToProfile = { navController.navigate(Routes.PROFILE) },
                onNavigateToAiKey = { navController.navigate(Routes.AI_KEY) },
                onNavigateToDevices = { navController.navigate(Routes.DEVICES) },
                onNavigateToMemory = { navController.navigate(Routes.MEMORY) },
                onNavigateToCognition = { navController.navigate(Routes.COGNITION) },
                onNavigateToNotification = { navController.navigate(Routes.NOTIFICATION) },
                onNavigateToUpdate = { navController.navigate(Routes.UPDATE) },
                onNavigateToAbout = { navController.navigate(Routes.ABOUT) }
            )
        }

        // 设置子页面（从右侧滑入）
        composable(
            route = Routes.PROFILE,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            com.lynnhub.app.ui.screen.settings.ProfilePage(onBack = { navController.popBackStack() })
        }
        composable(
            route = Routes.AI_KEY,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            com.lynnhub.app.ui.screen.settings.AiKeyPage(onBack = { navController.popBackStack() })
        }
        composable(
            route = Routes.DEVICES,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            com.lynnhub.app.ui.screen.settings.DevicesPage(onBack = { navController.popBackStack() })
        }
        composable(
            route = Routes.MEMORY,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            com.lynnhub.app.ui.screen.settings.MemoryPage(onBack = { navController.popBackStack() })
        }
        composable(
            route = Routes.COGNITION,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            com.lynnhub.app.ui.screen.settings.CognitionPage(onBack = { navController.popBackStack() })
        }
        composable(
            route = Routes.NOTIFICATION,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            com.lynnhub.app.ui.screen.settings.NotificationPage(onBack = { navController.popBackStack() })
        }
        composable(
            route = Routes.UPDATE,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            com.lynnhub.app.ui.screen.settings.UpdatePage(onBack = { navController.popBackStack() })
        }
        composable(
            route = Routes.ABOUT,
            enterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            exitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } },
            popEnterTransition = { slideInHorizontally(tween(duration, easing = easing)) { it } },
            popExitTransition = { slideOutHorizontally(tween(duration, easing = easing)) { it } }
        ) {
            com.lynnhub.app.ui.screen.settings.AboutPage(onBack = { navController.popBackStack() })
        }
    }
}

package com.lynnhub.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.interceptor.DynamicBaseUrlInterceptor
import com.lynnhub.app.ui.navigation.AppNavigation
import com.lynnhub.app.ui.navigation.DockBar
import com.lynnhub.app.ui.navigation.Routes
import com.lynnhub.app.ui.navigation.bottomTabs
import com.lynnhub.app.ui.navigation.coreRoutes
import com.lynnhub.app.ui.navigation.shouldShowDock
import com.lynnhub.app.ui.screen.login.LoginScreen
import com.lynnhub.app.ui.theme.LynnHubTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.abs

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var userPreferences: UserPreferences

    @Inject
    lateinit var dynamicBaseUrlInterceptor: DynamicBaseUrlInterceptor

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // 异步加载已保存的 baseUrl 到拦截器（不在主线程阻塞）
        lifecycleScope.launch {
            val savedUrl = userPreferences.getBaseUrl()
            dynamicBaseUrlInterceptor.setBaseUrl(savedUrl)
        }

        setContent {
            val token by userPreferences.tokenFlow.collectAsState(initial = null)
            val isLoggedIn = token != null

            LynnHubTheme(themeMode = com.lynnhub.app.util.Constants.THEME_DARK) {
                if (isLoggedIn) {
                    val navController = rememberNavController()
                    val navBackStackEntry by navController.currentBackStackEntryAsState()
                    val currentRoute = navBackStackEntry?.destination?.route ?: Routes.HOME
                    val showDock = currentRoute.shouldShowDock()

                    Scaffold(
                        modifier = Modifier.fillMaxSize(),
                        containerColor = com.lynnhub.app.ui.theme.Void,
                        bottomBar = {
                            DockBar(
                                currentRoute = currentRoute,
                                onTabSelected = { route ->
                                    navController.navigate(route) {
                                        // 核心页面切换时恢复状态，避免回退栈无限增长
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                visible = showDock
                            )
                        }
                    ) { innerPadding ->
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(innerPadding)
                                // 核心页面支持左右滑动切换
                                .then(
                                    if (currentRoute in coreRoutes) {
                                        Modifier.corePageSwipe(currentRoute) { targetRoute ->
                                            navController.navigate(targetRoute) {
                                                popUpTo(navController.graph.findStartDestination().id) {
                                                    saveState = true
                                                }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        }
                                    } else Modifier
                                )
                        ) {
                            AppNavigation(
                                navController = navController,
                                onLogout = {
                                    lifecycleScope.launch {
                                        userPreferences.clearAuth()
                                    }
                                }
                            )
                        }
                    }
                } else {
                    LoginScreen(
                        onLoginSuccess = {
                            // tokenFlow 会自动更新，触发 recomposition
                        }
                    )
                }
            }
        }
    }
}

/**
 * 核心页面左右滑动手势 Modifier。
 * 仅在当前 route 为核心页面时生效，左右滑动切换到相邻核心页面。
 * 使用 detectHorizontalDragGestures 避免与普通点击/滚动冲突。
 */
private fun Modifier.corePageSwipe(
    currentRoute: String,
    onSwipe: (String) -> Unit
): Modifier = this.pointerInput(currentRoute) {
    detectHorizontalDragGestures { _, dragAmount ->
        val threshold = 60.dp.toPx()
        if (kotlin.math.abs(dragAmount) < threshold) return@detectHorizontalDragGestures

        val currentIndex = bottomTabs.indexOfFirst { it.route == currentRoute }
        if (currentIndex == -1) return@detectHorizontalDragGestures

        val targetIndex = if (dragAmount < 0) {
            // 左滑 → 下一页
            (currentIndex + 1).coerceAtMost(bottomTabs.lastIndex)
        } else {
            // 右滑 → 上一页
            (currentIndex - 1).coerceAtLeast(0)
        }

        if (targetIndex != currentIndex) {
            onSwipe(bottomTabs[targetIndex].route)
        }
    }
}

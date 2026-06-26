package com.lynnhub.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.interceptor.DynamicBaseUrlInterceptor
import com.lynnhub.app.ui.component.CaptureBar
import com.lynnhub.app.ui.navigation.AppNavigation
import com.lynnhub.app.ui.screen.login.LoginScreen
import com.lynnhub.app.ui.theme.LynnHubTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

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
            val themeMode by userPreferences.themeFlow.collectAsState(
                initial = com.lynnhub.app.util.Constants.THEME_SYSTEM
            )
            val token by userPreferences.tokenFlow.collectAsState(initial = null)

            LynnHubTheme(themeMode = themeMode) {
                val isLoggedIn = token != null

                if (isLoggedIn) {
                    val navController = rememberNavController()
                    Box(modifier = Modifier.fillMaxSize()) {
                        AppNavigation(
                            navController = navController,
                            onLogout = {
                                lifecycleScope.launch {
                                    userPreferences.clearAuth()
                                }
                            }
                        )
                        CaptureBar(
                            modifier = Modifier
                                .align(Alignment.BottomCenter)
                                .windowInsetsPadding(
                                    WindowInsets.navigationBars.union(WindowInsets.ime)
                                )
                                .padding(start = 16.dp, end = 16.dp, bottom = 72.dp)
                        )
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

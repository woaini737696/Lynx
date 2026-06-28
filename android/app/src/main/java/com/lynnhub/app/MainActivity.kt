package com.lynnhub.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.compose.rememberNavController
import androidx.lifecycle.lifecycleScope
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.interceptor.DynamicBaseUrlInterceptor
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
            // v6 固定深色主题，themeMode 参数已弃用但保留签名兼容
            val token by userPreferences.tokenFlow.collectAsState(initial = null)

            LynnHubTheme(themeMode = com.lynnhub.app.util.Constants.THEME_DARK) {
                val isLoggedIn = token != null

                if (isLoggedIn) {
                    val navController = rememberNavController()
                    AppNavigation(
                        navController = navController,
                        onLogout = {
                            lifecycleScope.launch {
                                userPreferences.clearAuth()
                            }
                        }
                    )
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

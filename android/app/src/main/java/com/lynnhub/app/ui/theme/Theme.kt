package com.lynnhub.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

// ============ Lynx v6 深色配色方案 ============
// 设计文档明确为纯深色主题，不再支持 light/system 切换
private val LynxColorScheme = darkColorScheme(
    primary = Primary,
    onPrimary = Color.White,
    primaryContainer = PrimaryGlow,
    onPrimaryContainer = Color.White,
    secondary = Agent,
    onSecondary = Color.Black,
    tertiary = Think,
    onTertiary = Color.Black,
    background = Void,
    onBackground = TextPrimary,
    surface = Surface,
    onSurface = TextPrimary,
    surfaceVariant = SurfaceHover,
    onSurfaceVariant = TextMuted,
    outline = BorderHover,
    outlineVariant = Divider,
    error = Danger,
    onError = Color.White,
)

/**
 * Lynx v6 主题
 * 纯深色主题，忽略 themeMode 参数（保留签名兼容旧调用）
 */
@Composable
fun LynnHubTheme(
    @Suppress("UNUSED_PARAMETER") themeMode: String = "dark",
    content: @Composable () -> Unit
) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as android.app.Activity).window
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val controller = WindowInsetsControllerCompat(window, view)
            // 深色背景 → 状态栏图标用浅色
            controller.isAppearanceLightStatusBars = false
            controller.isAppearanceLightNavigationBars = false
        }
    }

    MaterialTheme(
        colorScheme = LynxColorScheme,
        typography = LynnHubTypography,
        content = content
    )
}

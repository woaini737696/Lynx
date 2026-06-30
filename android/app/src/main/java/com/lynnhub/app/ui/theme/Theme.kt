package com.lynnhub.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

// ============ Lynx v6 深色配色方案 ============
private val LynxDarkColorScheme = darkColorScheme(
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

// ============ Lynx v6 浅色配色方案 ============
private val LynxLightColorScheme = lightColorScheme(
    primary = PrimaryDeep,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD6E4FF),
    onPrimaryContainer = Color(0xFF0A1F44),
    secondary = Agent,
    onSecondary = Color.White,
    tertiary = Think,
    onTertiary = Color(0xFF3A2A00),
    background = Color(0xFFF7F9FC),
    onBackground = Color(0xFF0A0F1E),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF0A0F1E),
    surfaceVariant = Color(0xFFEEF2F8),
    onSurfaceVariant = Color(0xFF5A6478),
    outline = Color(0xFFD8DEE8),
    outlineVariant = Color(0xFFE8ECF2),
    error = Danger,
    onError = Color.White,
)

/**
 * Lynx v6 主题
 * @param themeMode "dark"/"light"/"system"，默认 "system" 跟随系统
 */
@Composable
fun LynnHubTheme(
    themeMode: String = "system",
    content: @Composable () -> Unit
) {
    val isDark = when (themeMode) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }
    val colorScheme = if (isDark) LynxDarkColorScheme else LynxLightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as android.app.Activity).window
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val controller = WindowInsetsControllerCompat(window, view)
            controller.isAppearanceLightStatusBars = !isDark
            controller.isAppearanceLightNavigationBars = !isDark
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = LynnHubTypography,
        content = content
    )
}

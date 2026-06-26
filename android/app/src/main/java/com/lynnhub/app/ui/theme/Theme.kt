package com.lynnhub.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

private val LightColorScheme = lightColorScheme(
    primary = Amber500,
    onPrimary = Color.White,
    primaryContainer = Amber400,
    onPrimaryContainer = Amber600,
    secondary = Orange500,
    onSecondary = Color.White,
    tertiary = Blue500,
    onTertiary = Color.White,
    background = LightBgPage,
    onBackground = LightTextPrimary,
    surface = LightBgCard,
    onSurface = LightTextPrimary,
    surfaceVariant = LightBgCardElevated,
    onSurfaceVariant = LightTextSecondary,
    outline = LightBorder,
    outlineVariant = LightDivider,
    error = Red500,
    onError = Color.White,
)

private val DarkColorScheme = darkColorScheme(
    primary = Amber400,
    onPrimary = Color(0xFF1D1D1F),
    primaryContainer = Amber600,
    onPrimaryContainer = Amber400,
    secondary = Orange500,
    onSecondary = Color.White,
    tertiary = Blue500,
    onTertiary = Color.White,
    background = DarkBgPage,
    onBackground = DarkTextPrimary,
    surface = DarkBgCard,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkBgCardElevated,
    onSurfaceVariant = DarkTextSecondary,
    outline = DarkBorder,
    outlineVariant = DarkDivider,
    error = Red500,
    onError = Color.White,
)

/**
 * LynnHub 主题
 * @param themeMode "light" | "dark" | "system"
 */
@Composable
fun LynnHubTheme(
    themeMode: String = "system",
    content: @Composable () -> Unit
) {
    val darkTheme = when (themeMode) {
        "light" -> false
        "dark" -> true
        else -> isSystemInDarkTheme()
    }

    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as android.app.Activity).window
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val controller = WindowInsetsControllerCompat(window, view)
            controller.isAppearanceLightStatusBars = !darkTheme
            controller.isAppearanceLightNavigationBars = !darkTheme
            window.statusBarColor = Color.Transparent.toArgb()
            window.navigationBarColor = Color.Transparent.toArgb()
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = LynnHubTypography,
        content = content
    )
}

package com.lynnhub.app.ui.component

import androidx.compose.runtime.Composable

/**
 * FrostedGlassDialog - 已迁移至 LiquidGlassDialog
 *
 * 历史问题：
 *   旧版使用 MaterialTheme.colorScheme.surface.copy(alpha = 0.95f)
 *   由于 Surface = Color(0x08FFFFFF) 是3% alpha白色，
 *   .copy(alpha = 0.95f) 会覆盖alpha为95%，变成 95% 不透明白色，
 *   导致深色主题下弹窗显示为白色透明渐变。
 *
 * 修复方案：
 *   委托到 LiquidGlassDialog，使用 DialogDeepPrimary (90% Void) 深色叠加
 *   + DialogDeepSecondary (70% Deep) 渐变 + GlassBorderDeep 描边
 *   + 顶部 GlassHighlightDeep 高光线，1:1 还原 iOS26 App Store 弹窗视觉
 *
 * 兼容性：保留旧签名，所有调用方无需改动
 */
@Composable
fun FrostedGlassDialog(
    onDismiss: () -> Unit,
    content: @Composable () -> Unit
) {
    LiquidGlassDialog(onDismiss = onDismiss, content = content)
}

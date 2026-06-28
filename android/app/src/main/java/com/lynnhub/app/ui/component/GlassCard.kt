package com.lynnhub.app.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.lynnhub.app.ui.theme.LiquidBorder
import com.lynnhub.app.ui.theme.LiquidHighlight
import com.lynnhub.app.ui.theme.Liquid2
import com.lynnhub.app.ui.theme.Liquid3

/**
 * iOS 26 液态玻璃卡片
 *
 * @param variant 玻璃强度：strong(0.14) / default(0.08) / subtle(0.04)
 * @param highlight 是否绘制顶部高光边缘
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    variant: GlassVariant = GlassVariant.Default,
    shape: Shape,
    borderWidth: Dp = 1.dp,
    highlight: Boolean = true,
    content: @Composable BoxScope.() -> Unit
) {
    val backgroundColor = when (variant) {
        GlassVariant.Strong -> Liquid2
        GlassVariant.Default -> Liquid3
        GlassVariant.Subtle -> Color.White.copy(alpha = 0.02f)
    }
    Box(
        modifier = modifier
            .background(backgroundColor, shape)
            .border(borderWidth, LiquidBorder, shape)
            .then(
                if (highlight) {
                    Modifier.drawBehind {
                        // 顶部高光：1px 浅色线
                        drawLine(
                            color = LiquidHighlight.copy(alpha = 0.5f),
                            start = Offset(0f, 0f),
                            end = Offset(size.width, 0f),
                            strokeWidth = 1f
                        )
                        // 左上微弱渐变高光
                        drawRect(
                            brush = Brush.linearGradient(
                                colors = listOf(
                                    LiquidHighlight.copy(alpha = 0.12f),
                                    Color.Transparent
                                ),
                                start = Offset(0f, 0f),
                                end = Offset(size.width * 0.6f, size.height * 0.4f)
                            ),
                            size = size
                        )
                    }
                } else Modifier
            ),
        content = content
    )
}

enum class GlassVariant { Strong, Default, Subtle }

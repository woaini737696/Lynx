package com.lynnhub.app.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lynnhub.app.ui.theme.GlassBorderSubtle
import com.lynnhub.app.ui.theme.GlassHighlightDeep
import com.lynnhub.app.ui.theme.TextPrimary
import com.lynnhub.app.ui.theme.TopBarDeep
import com.lynnhub.app.ui.theme.TopBarDeepBlur

/**
 * 四个核心页面通用顶部标题栏（iOS26 液态玻璃风格）
 *
 * 特性：
 * - 半透明深色背景 + 模糊层模拟（TopBarDeep → TopBarDeepBlur 渐变）
 * - 状态栏安全区域（statusBarsPadding）
 * - 顶部高光线 + 底部分隔线
 * - 左侧页面标题
 * - 右侧用户头像（点击进入设置面板）
 * - 不随页面滚动（固定吸附顶部）
 */
@Composable
fun CoreScreenHeader(
    title: String,
    userName: String,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        TopBarDeep,        // 80% Void 顶部
                        TopBarDeepBlur     // 60% Deep 底部
                    )
                )
            )
            .statusBarsPadding()
            .drawBehind {
                // 顶部高光（绘制在状态栏顶部位置）
                drawLine(
                    color = GlassHighlightDeep.copy(alpha = 0.3f),
                    start = Offset(0f, 0f),
                    end = Offset(size.width, 0f),
                    strokeWidth = 1f
                )
                // 底部分隔线
                drawLine(
                    color = GlassBorderSubtle,
                    start = Offset(0f, size.height),
                    end = Offset(size.width, size.height),
                    strokeWidth = 1f
                )
            }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                letterSpacing = (-0.5).sp
            )

            Box(
                modifier = Modifier.clickable(onClick = onOpenSettings)
            ) {
                UserAvatar(
                    name = userName,
                    size = 42.dp,
                    onClick = null
                )
            }
        }
    }
}

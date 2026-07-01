package com.lynnhub.app.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog

/**
 * 深色半透明毛玻璃弹窗容器
 *
 * 背景采用深色叠加（surface 0.95f + 纯黑 0.45f 双层渐变），
 * 确保在深色主题下弹窗内容清晰可读。
 * 24dp 圆角 + 细描边，营造液态玻璃质感。
 * 兼容所有 Android 版本（无 blur 依赖，靠半透明 + 渐变模拟）。
 */
@Composable
fun FrostedGlassDialog(
    onDismiss: () -> Unit,
    content: @Composable () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(24.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.surface.copy(alpha = 0.95f),
                            Color.Black.copy(alpha = 0.45f)
                        )
                    )
                )
                .border(
                    1.dp,
                    MaterialTheme.colorScheme.outline.copy(alpha = 0.25f),
                    RoundedCornerShape(24.dp)
                )
        ) {
            content()
        }
    }
}

package com.lynnhub.app.ui.component

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lynnhub.app.ui.theme.TextPrimary

/**
 * 四个核心页面通用顶部标题栏
 * - 左侧页面标题
 * - 右侧用户头像（点击进入设置面板）
 */
@Composable
fun CoreScreenHeader(
    title: String,
    userName: String,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            letterSpacing = (-0.3).sp
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

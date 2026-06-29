package com.lynnhub.app.ui.component

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.Motion
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.TextPrimary

/**
 * 用户头像组件
 *
 * @param name 显示名称或用户名，取首字母
 * @param size 尺寸，默认 42dp（首页/核心页右上角），设置页用户卡片用 62dp
 * @param onClick 点击回调
 */
@Composable
fun UserAvatar(
    name: String?,
    modifier: Modifier = Modifier,
    size: Dp = 42.dp,
    onClick: (() -> Unit)? = null
) {
    val initial = remember(name) {
        name?.trim()?.firstOrNull()?.uppercaseChar()?.toString() ?: "U"
    }

    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.95f else 1f,
        animationSpec = Motion.buttonPressSpec(),
        label = "avatarScale"
    )

    Box(
        modifier = modifier
            .size(size)
            .scale(scale)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(Primary, Agent)))
            .border(
                width = 2.dp,
                brush = Brush.linearGradient(
                    colors = listOf(
                        Color.White.copy(alpha = 0.2f),
                        Color.White.copy(alpha = 0.1f)
                    )
                ),
                shape = CircleShape
            )
            .then(
                if (onClick != null) {
                    Modifier.clickable(
                        interactionSource = interactionSource,
                        indication = null,
                        onClick = onClick
                    )
                } else Modifier
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = initial,
            color = TextPrimary,
            fontSize = if (size >= 56.dp) 22.sp else 15.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

package com.lynnhub.app.ui.screen.home

import androidx.compose.animation.core.EaseInOutSine
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.R
import com.lynnhub.app.ui.component.GlassCard
import com.lynnhub.app.ui.component.GlassVariant
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.component.Pressable
import com.lynnhub.app.ui.component.UserAvatar
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.BorderHover
import com.lynnhub.app.ui.theme.BorderSubtle
import com.lynnhub.app.ui.theme.Deep
import com.lynnhub.app.ui.theme.GradientPrimary
import com.lynnhub.app.ui.theme.LiquidBorder
import com.lynnhub.app.ui.theme.Liquid3
import com.lynnhub.app.ui.theme.Motion
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.PrimaryDeep
import com.lynnhub.app.ui.theme.Surface
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import com.lynnhub.app.ui.theme.Think
import com.lynnhub.app.ui.theme.Void

/**
 * Lynx v6 首页
 *
 * 设计要点：
 * - 顶部：左侧「早上好，Lynn」，右侧用户头像（进入设置）
 * - Agent 状态：胶囊 pill「Lynx Agent 在线」
 * - 中央 140dp 呼吸球，纯白猞猁 logo 68dp，点击进通话
 * - 时间流：玻璃卡片，顶部渐变消融
 * - 右下角 FAB：灵感速记入口
 */
@Composable
fun HomeScreen(
    onOpenSettings: () -> Unit,
    onOpenIdea: () -> Unit,
    onOpenCall: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
            .background(
                Brush.radialGradient(
                    colors = listOf(
                        Primary.copy(alpha = 0.16f),
                        Color.Transparent
                    ),
                    center = Offset(0.5f, 0.28f),
                    radius = 0.7f
                )
            )
            .background(
                Brush.radialGradient(
                    colors = listOf(
                        Agent.copy(alpha = 0.08f),
                        Color.Transparent
                    ),
                    center = Offset(0.8f, 0.85f),
                    radius = 0.5f
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .padding(horizontal = 22.dp)
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            // 顶部 Header
            HomeHeader(
                greeting = uiState.greeting,
                userName = uiState.userName,
                onOpenSettings = onOpenSettings
            )

            // Agent 状态 pill
            AgentStatusPill(label = uiState.agentLabel)

            Spacer(modifier = Modifier.height(20.dp))

            // 中央呼吸球
            BreathBall(
                onClick = onOpenCall,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )

            Spacer(modifier = Modifier.height(8.dp))

            // 时间流
            Timeline(
                items = uiState.timeline,
                isLoading = uiState.isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(top = 8.dp)
            )
        }

        // 右下角灵感 FAB（按视觉稿：right 22dp, bottom 132dp）
        IdeaFab(
            onClick = onOpenIdea,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 22.dp, bottom = 132.dp)
        )
    }
}

// ============ 顶部 Header ============
@Composable
private fun HomeHeader(
    greeting: String,
    userName: String,
    onOpenSettings: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "$greeting，$userName",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                letterSpacing = (-0.3).sp
            )
        }

        UserAvatar(
            name = userName,
            size = 42.dp,
            onClick = onOpenSettings
        )
    }
}

// ============ Agent 状态 Pill ============
@Composable
private fun AgentStatusPill(label: String) {
    Row(
        modifier = Modifier
            .padding(top = 10.dp)
            .fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(Agent.copy(alpha = 0.1f))
                .border(1.dp, Agent.copy(alpha = 0.22f), RoundedCornerShape(999.dp))
                .padding(horizontal = 14.dp, vertical = 7.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val infiniteTransition = rememberInfiniteTransition(label = "agentDot")
                val alpha by infiniteTransition.animateFloat(
                    initialValue = 0.5f,
                    targetValue = 1f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(2000, easing = EaseInOutSine),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "agentDotAlpha"
                )
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(Agent.copy(alpha = alpha))
                )
                Text(
                    text = label,
                    fontSize = 12.sp,
                    color = Agent
                )
            }
        }
    }
}

// ============ 中央呼吸球 ============
@Composable
private fun BreathBall(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "breath")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = Motion.breathSpec(),
            repeatMode = RepeatMode.Reverse
        ),
        label = "breathScale"
    )

    val orbScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(6000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "orbScale"
    )

    val orb2Scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(
            animation = tween(8000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "orb2Scale"
    )

    Box(
        modifier = modifier.size(140.dp),
        contentAlignment = Alignment.Center
    ) {
        // 第 2 层 orb（212dp，delay -2s，opacity 0.6）
        Box(
            modifier = Modifier
                .size(212.dp)
                .scale(orb2Scale)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(Primary.copy(alpha = 0.05f), Color.Transparent)
                    )
                )
                .border(1.dp, Primary.copy(alpha = 0.08f), CircleShape)
        )

        // 第 1 层 orb（184dp）
        Box(
            modifier = Modifier
                .size(184.dp)
                .scale(orbScale)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(Primary.copy(alpha = 0.08f), Color.Transparent)
                    )
                )
                .border(1.dp, Primary.copy(alpha = 0.12f), CircleShape)
        )

        // 呼吸球（140dp）
        Box(
            modifier = Modifier
                .size(140.dp)
                .scale(scale)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            LiquidBorder,
                            Color.Transparent
                        ),
                        center = Offset(0.3f, 0.25f),
                        radius = 0.45f
                    )
                )
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Primary.copy(alpha = 0.35f),
                            PrimaryDeep.copy(alpha = 0.12f),
                            Color.Transparent
                        ),
                        radius = 0.7f
                    )
                )
                .background(
                    Brush.linearGradient(
                        colors = listOf(Primary.copy(alpha = 0.4f), Agent.copy(alpha = 0.15f))
                    )
                )
                .drawBehind {
                    drawCircle(
                        brush = Brush.linearGradient(
                            colors = listOf(
                                BorderHover,
                                Color.Transparent,
                                Primary.copy(alpha = 0.15f)
                            )
                        ),
                        radius = size.width / 2 + 2.dp.toPx()
                    )
                }
                .border(1.dp, LiquidBorder.copy(alpha = 0.25f), CircleShape)
                .pointerInput(Unit) {
                    detectTapGestures(onTap = { onClick() })
                },
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(id = R.drawable.lynx_logo_white),
                contentDescription = "Lynx",
                modifier = Modifier.size(68.dp)
            )
        }
    }
}

// ============ 灵感速记 FAB ============
@Composable
private fun IdeaFab(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Pressable(
        onClick = onClick,
        modifier = modifier
            .size(52.dp)
            .clip(CircleShape)
            .background(Brush.linearGradient(GradientPrimary))
            .border(1.dp, BorderHover, CircleShape)
    ) { _ ->
        androidx.compose.material3.Icon(
            imageVector = LynxIcons.Add,
            contentDescription = "灵感速记",
            tint = TextPrimary,
            modifier = Modifier.size(24.dp)
        )
    }
}

// ============ 时间流 ============
@Composable
private fun Timeline(
    items: List<TimelineItem>,
    isLoading: Boolean,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        // 标题
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "时间流",
                fontSize = 12.sp,
                color = TextMuted,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.sp
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(1.dp)
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(
                                Liquid3,
                                Color.Transparent
                            )
                        )
                    )
            )
        }

        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxWidth().weight(1f),
                contentAlignment = Alignment.TopCenter
            ) {
                Text(
                    text = "加载中…",
                    fontSize = 12.sp,
                    color = TextMuted,
                    modifier = Modifier.padding(top = 40.dp)
                )
            }
            return
        }

        if (items.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxWidth().weight(1f),
                contentAlignment = Alignment.TopCenter
            ) {
                Text(
                    text = "暂无动态",
                    fontSize = 12.sp,
                    color = TextMuted,
                    modifier = Modifier.padding(top = 40.dp)
                )
            }
            return
        }

        // 时间流列表 + 顶部渐变消融（与呼吸球柔和过渡）
        Box(modifier = Modifier.fillMaxSize().weight(1f)) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(items, key = { it.id }) { item ->
                    TimelineCard(item)
                }
            }
            // 顶部 18dp 渐变消融遮罩
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(18.dp)
                    .align(Alignment.TopCenter)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Void.copy(alpha = 0.9f),
                                Color.Transparent
                            )
                        )
                    )
            )
        }
    }
}

@Composable
private fun TimelineCard(item: TimelineItem) {
    val relativeTime = formatRelativeTime(item.createdAt)
    val badgeColor = when (item.type) {
        "task" -> Agent
        "memory" -> Think
        "cognition" -> Primary
        "report" -> Agent
        else -> Primary
    }

    GlassCard(
        variant = GlassVariant.Default,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(badgeColor.copy(alpha = 0.12f))
                        .border(1.dp, badgeColor.copy(alpha = 0.18f), RoundedCornerShape(999.dp))
                        .padding(horizontal = 9.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = typeLabel(item.type),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = badgeColor
                    )
                }
                if (relativeTime.isNotBlank()) {
                    Text(
                        text = relativeTime,
                        fontSize = 10.sp,
                        color = TextMuted,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = item.title,
                fontSize = 13.5.sp,
                color = TextPrimary,
                lineHeight = 22.sp,
                maxLines = 2
            )
        }
    }
}

private fun typeLabel(type: String): String = when (type.lowercase()) {
    "report" -> "报告"
    "idea" -> "灵感"
    "cognition" -> "认知"
    "task" -> "任务"
    "memory" -> "记忆"
    else -> type
}

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
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.style.TextOverflow
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
import com.lynnhub.app.ui.theme.Liquid2
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
 * Lynx v6 首页 - 今日工作台
 *
 * 重新设计：从"时间流"改为"今日工作台"，更实用
 * - 顶部：问候 + 头像（设置入口）
 * - Agent 状态 pill
 * - 中央呼吸球（点击进通话）
 * - 今日概览：3 个统计胶囊（进行中/今日完成/待处理飞书）
 * - 快捷入口：灵感速记 / Lynx 助理 / Agent 远程
 * - 最近飞书任务 Top 3
 * - 右下角 FAB：灵感速记
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
            .background(MaterialTheme.colorScheme.background)
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
                .statusBarsPadding()
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

            Spacer(modifier = Modifier.height(16.dp))

            // 中央呼吸球
            BreathBall(
                onClick = onOpenCall,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // 今日概览统计
            TodayOverview(
                activeTaskCount = uiState.activeTaskCount,
                todayDoneCount = uiState.todayDoneCount,
                pendingLarkTaskCount = uiState.pendingLarkTaskCount
            )

            Spacer(modifier = Modifier.height(14.dp))

            // 最近飞书任务
            RecentTasksSection(
                tasks = uiState.recentTasks,
                isLoading = uiState.isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            )
        }

        // 右下角灵感 FAB
        IdeaFab(
            onClick = onOpenIdea,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 22.dp, bottom = 12.dp)
        )
    }
}

// ============ 今日概览统计 ============
@Composable
private fun TodayOverview(
    activeTaskCount: Int,
    todayDoneCount: Int,
    pendingLarkTaskCount: Int
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        StatChip(
            label = "进行中",
            value = activeTaskCount,
            color = Primary,
            modifier = Modifier.weight(1f)
        )
        StatChip(
            label = "已完成",
            value = todayDoneCount,
            color = Agent,
            modifier = Modifier.weight(1f)
        )
        StatChip(
            label = "飞书待办",
            value = pendingLarkTaskCount,
            color = Think,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun StatChip(
    label: String,
    value: Int,
    color: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(Liquid2)
            .border(1.dp, LiquidBorder, RoundedCornerShape(14.dp))
            .padding(vertical = 10.dp, horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = value.toString(),
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = label,
            fontSize = 10.sp,
            color = TextMuted
        )
    }
}

// ============ 最近飞书任务 ============
@Composable
private fun RecentTasksSection(
    tasks: List<com.lynnhub.app.data.remote.dto.LarkTaskDto>,
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
                text = "最近任务",
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
                            colors = listOf(Liquid3, Color.Transparent)
                        )
                    )
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxWidth().weight(1f),
                contentAlignment = Alignment.TopCenter
            ) {
                Text(
                    text = "加载中…",
                    fontSize = 12.sp,
                    color = TextMuted,
                    modifier = Modifier.padding(top = 20.dp)
                )
            }
            return
        }

        if (tasks.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxWidth().weight(1f),
                contentAlignment = Alignment.TopCenter
            ) {
                Text(
                    text = "暂无飞书任务",
                    fontSize = 12.sp,
                    color = TextMuted,
                    modifier = Modifier.padding(top = 20.dp)
                )
            }
            return
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(tasks, key = { it.guid }) { task ->
                HomeTaskCard(task = task)
            }
        }
    }
}

@Composable
private fun HomeTaskCard(task: com.lynnhub.app.data.remote.dto.LarkTaskDto) {
    GlassCard(
        variant = GlassVariant.Default,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 状态点
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(if (task.completed) Agent else Primary)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = task.summary,
                    fontSize = 13.sp,
                    color = if (task.completed) TextMuted else TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                task.tasklistName?.let {
                    Text(
                        text = it,
                        fontSize = 10.sp,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
            // 负责人
            if (task.assignees.isNotEmpty()) {
                val name = task.assignees.firstOrNull()?.displayName
                    ?: task.assignees.firstOrNull()?.name
                    ?: "?"
                Text(
                    text = name,
                    fontSize = 10.sp,
                    color = TextMuted
                )
            }
        }
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



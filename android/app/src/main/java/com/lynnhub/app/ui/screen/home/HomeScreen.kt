package com.lynnhub.app.ui.screen.home

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToDown
import androidx.compose.ui.input.pointer.changedToUp
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.ui.theme.*
import kotlin.math.abs

/**
 * Lynx v6 首页 —— 唯一主页面
 *
 * 设计要点：
 * - 右上角低调头像（24px，opacity 0.45）→ 点击进入设置
 * - 顶部环境（问候 + 用户名 + 摘要 + Agent 状态）
 * - 中央呼吸球（120px，4秒慢呼吸）→ 双击通话/长按语音
 * - 手势提示（四向手势说明）
 * - 时间流（最近发生的事）
 * - 四向手势：上滑灵感·下滑任务·左滑对话·右滑远程
 */
@Composable
fun HomeScreen(
    onOpenSettings: () -> Unit,
    onSwipeUp: () -> Unit,       // 灵感速记
    onSwipeDown: () -> Unit,     // 任务视图
    onSwipeLeft: () -> Unit,     // AI 对话
    onSwipeRight: () -> Unit,    // Agent 远程
    onDoubleClick: () -> Unit,   // 全双工通话
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    val threshold = 80.dp
    val thresholdPx = with(LocalDensity.current) { threshold.toPx() }
    var lastTriggerTime by remember { mutableStateOf(0L) }

    // 记录 Timeline 区域在屏幕中的起始 Y 坐标，用于判断手势起始位置是否落在列表内
    var timelineTopY by remember { mutableStateOf(Float.MAX_VALUE) }
    // Timeline 是否可滚动（有内容且非加载态）：仅在可滚动时禁用列表区域的上下滑动
    val timelineScrollable = uiState.timeline.isNotEmpty() && !uiState.isLoading

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
            .systemBarsPadding()
            // 四向手势检测：使用 PointerEventPass.Initial 在子组件之前监听事件，
            // 但不消费事件（不调用 consume），让下层组件正常处理点击/双击/滚动。
            // 仅在累计拖动超过阈值时触发回调。
            // 优化：当 Timeline 可滚动且手势起始位置落在 Timeline 区域内时，
            // 禁用上下滑动（避免与列表滚动冲突），但保留左右滑动（LazyColumn 不处理水平滚动）。
            .pointerInput(timelineScrollable, timelineTopY) {
                awaitPointerEventScope {
                    while (true) {
                        // Initial 阶段等待按下，不消费
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        val down = event.changes.firstOrNull() ?: continue
                        if (!down.changedToDown()) continue

                        val startX = down.position.x
                        val startY = down.position.y
                        var triggered = false

                        // 判断手势起始位置是否落在可滚动的 Timeline 区域内
                        val inScrollableTimeline = timelineScrollable && startY >= timelineTopY

                        // 持续监听移动
                        while (true) {
                            val moveEvent = awaitPointerEvent(PointerEventPass.Initial)
                            val change = moveEvent.changes.firstOrNull() ?: break
                            if (change.changedToUp()) break

                            val dx = change.position.x - startX
                            val dy = change.position.y - startY
                            val absX = abs(dx)
                            val absY = abs(dy)

                            // 超过阈值且未触发过，触发一次
                            if (!triggered && (absX >= thresholdPx || absY >= thresholdPx)) {
                                val now = System.currentTimeMillis()
                                if (now - lastTriggerTime >= 500) {
                                    lastTriggerTime = now
                                    triggered = true
                                    when {
                                        // 在可滚动 Timeline 区域内禁用上下滑动，避免与列表滚动冲突
                                        dy < -thresholdPx && !inScrollableTimeline -> onSwipeUp()      // 上滑
                                        dy > thresholdPx && !inScrollableTimeline -> onSwipeDown()     // 下滑
                                        dx < -thresholdPx -> onSwipeLeft()    // 左滑
                                        dx > thresholdPx -> onSwipeRight()    // 右滑
                                    }
                                }
                            }
                        }
                    }
                }
            }
    ) {
        // 右上角低调头像
        HeaderAvatar(
            onClick = onOpenSettings,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 10.dp, end = 14.dp)
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(36.dp))

            // 顶部环境
            AmbientTop(uiState)

            // 中央呼吸球
            BreathBall(
                onDoubleClick = onDoubleClick,
                modifier = Modifier.padding(vertical = 20.dp)
            )

            // 手势提示
            GestureHint()

            // 时间流
            Timeline(
                items = uiState.timeline,
                isLoading = uiState.isLoading,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(top = 14.dp)
                    .onGloballyPositioned { coords ->
                        // 记录 Timeline 在屏幕中的起始 Y 坐标，用于手势检测判断
                        timelineTopY = coords.positionInWindow().y
                    }
            )
        }
    }
}

// ============ 右上角头像 ============
@Composable
private fun HeaderAvatar(onClick: () -> Unit, modifier: Modifier = Modifier) {
    var hovered by remember { mutableStateOf(false) }
    val alpha by animateFloatAsState(
        targetValue = if (hovered) 0.85f else 0.45f,
        animationSpec = tween(300),
        label = "avatarAlpha"
    )
    Box(
        modifier = modifier
            .size(32.dp)  // 增大点击区域到 32dp（原 24dp 太小）
            .clip(CircleShape)
            .border(1.5.dp, BorderHover.copy(alpha = alpha), CircleShape)
            .clickable {
                hovered = true
                onClick()
            },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Filled.Person,
            contentDescription = "设置",
            tint = TextPrimary.copy(alpha = alpha),
            modifier = Modifier.size(16.dp)
        )
    }
}

// ============ 顶部环境 ============
@Composable
private fun AmbientTop(state: HomeUiState) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        // 时间问候
        Text(
            text = state.greeting,
            fontSize = 11.sp,
            color = TextMuted,
            letterSpacing = 1.sp
        )
        // 用户名
        Text(
            text = state.userName,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )
        // 一句话摘要
        Text(
            text = state.summary,
            fontSize = 12.sp,
            color = TextMuted
        )
        // Agent 状态
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(top = 8.dp)
        ) {
            AgentGlowDot(state.agentStatus)
            Text(
                text = state.agentLabel,
                fontSize = 10.sp,
                color = TextMuted
            )
        }
    }
}

@Composable
private fun AgentGlowDot(status: AgentStatus) {
    val color = when (status) {
        AgentStatus.ONLINE -> Agent
        AgentStatus.BUSY -> Think
        AgentStatus.OFFLINE -> TextMuted
    }
    val infiniteTransition = rememberInfiniteTransition(label = "agentGlow")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "agentGlowAlpha"
    )
    Box(
        modifier = Modifier
            .size(5.dp)
            .clip(CircleShape)
            .background(color.copy(alpha = if (status == AgentStatus.OFFLINE) 0.5f else alpha))
    )
}

// ============ 中央呼吸球 ============
@Composable
private fun BreathBall(
    onDoubleClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    // 4秒慢呼吸动画
    val infiniteTransition = rememberInfiniteTransition(label = "breath")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.03f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "breathScale"
    )

    Box(
        modifier = modifier
            .size(120.dp)
            .scale(scale)
            .clip(CircleShape)
            .background(
                Brush.radialGradient(
                    colors = listOf(PrimaryGlow, Color(0x082B7FFF))
                )
            )
            .border(1.dp, Primary.copy(alpha = 0.18f), CircleShape)
            .pointerInput(Unit) {
                detectTapGestures(
                    onDoubleTap = { onDoubleClick() }
                )
            },
        contentAlignment = Alignment.Center
    ) {
        // 呼吸球中心可放图标或留空
        Text(
            text = "\uD83E\uDD81",
            fontSize = 36.sp
        )
    }
}

// ============ 手势提示 ============
@Composable
private fun GestureHint() {
    var faded by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(3000)
        faded = true
    }
    val alpha by animateFloatAsState(
        targetValue = if (faded) 0.3f else 1f,
        animationSpec = tween(800),
        label = "hintAlpha"
    )
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(top = 8.dp)
    ) {
        Text("上滑 灵感 · 下滑 任务", fontSize = 10.sp, color = TextMuted.copy(alpha = alpha))
        Text("左滑 对话 · 右滑 远程", fontSize = 10.sp, color = TextMuted.copy(alpha = alpha))
        Text("双击 通话", fontSize = 10.sp, color = TextMuted.copy(alpha = alpha))
    }
}

// ============ 时间流 ============
@Composable
private fun Timeline(
    items: List<TimelineItem>,
    isLoading: Boolean,
    modifier: Modifier = Modifier
) {
    if (isLoading) {
        Box(modifier = modifier, contentAlignment = Alignment.TopCenter) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(
                    color = Primary,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "加载中…",
                    fontSize = 11.sp,
                    color = TextMuted
                )
            }
        }
        return
    }
    if (items.isEmpty()) {
        Box(modifier = modifier, contentAlignment = Alignment.TopCenter) {
            Text(
                text = "暂无动态",
                fontSize = 11.sp,
                color = TextMuted,
                modifier = Modifier.padding(top = 20.dp)
            )
        }
        return
    }
    LazyColumn(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(0.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
                horizontalArrangement = Arrangement.Start
            ) {
                Text(
                    text = "时间流",
                    fontSize = 10.sp,
                    color = TextMuted,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp
                )
            }
        }
        items(items, key = { it.id }) { item ->
            TimelineRow(item)
        }
    }
}

@Composable
private fun TimelineRow(item: TimelineItem) {
    val relativeTime = formatRelativeTime(item.createdAt)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.Top
    ) {
        // 颜色点
        Box(
            modifier = Modifier
                .padding(top = 5.dp)
                .size(5.dp)
                .clip(CircleShape)
                .background(item.dotColor)
        )
        Spacer(modifier = Modifier.width(10.dp))
        // 内容
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.title,
                fontSize = 13.sp,
                color = TextPrimary,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = item.desc,
                fontSize = 11.sp,
                color = TextMuted
            )
        }
        // 相对时间
        if (relativeTime.isNotBlank()) {
            Text(
                text = relativeTime,
                fontSize = 10.sp,
                color = TextMuted.copy(alpha = 0.6f),
                modifier = Modifier.padding(start = 8.dp, top = 5.dp)
            )
        }
    }
}

// 注：四向手势检测已内联到 HomeScreen 的父 Box modifier 中，
// 以确保在 Initial 阶段监听拖动事件，且不干扰下层组件的点击/双击。

package com.lynnhub.app.ui.screen.panel

import androidx.compose.animation.core.EaseOutCubic
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.changedToDown
import androidx.compose.ui.input.pointer.changedToUp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lynnhub.app.R
import com.lynnhub.app.ui.theme.*
import kotlinx.coroutines.delay
import kotlin.math.abs

// ============ 统一返回按钮（32px 圆形） ============
@Composable
fun BackButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(Surface)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = "返回",
            tint = TextPrimary,
            modifier = Modifier.size(18.dp)
        )
    }
}

// ============ 滑动提示小字 ============
@Composable
fun SwipeHint(text: String, modifier: Modifier = Modifier) {
    if (text.isBlank()) return
    Text(
        text = text,
        fontSize = 11.sp,
        color = TextMuted,
        letterSpacing = 0.5.sp,
        modifier = modifier
    )
}

// ============ 浮层标题栏 ============
@Composable
fun PanelHeader(
    title: String,
    onBack: () -> Unit,
    swipeHint: String = ""
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        BackButton(onClick = onBack)
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            text = title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            modifier = Modifier.weight(1f)
        )
    }
    SwipeHint(text = swipeHint, modifier = Modifier.padding(start = 42.dp, top = 2.dp))
}

/**
 * 反向滑动手势检测器
 * @param returnDirection 返回方向："down"/"up"/"right"/"left"
 *   - 灵感速记（上滑进入）→ 下滑返回
 *   - 任务视图（下滑进入）→ 上滑返回
 *   - AI 对话（左滑进入）→ 右滑返回
 *   - Agent 远程（右滑进入）→ 左滑返回
 */
@Composable
fun ReturnSwipeDetector(
    returnDirection: String,
    onReturn: () -> Unit,
    modifier: Modifier = Modifier
) {
    val threshold = 80.dp
    val thresholdPx = with(LocalDensity.current) { threshold.toPx() }
    var lastTriggerTime by remember { mutableStateOf(0L) }

    Box(
        modifier = modifier.pointerInput(Unit) {
            awaitPointerEventScope {
                while (true) {
                    val event = awaitPointerEvent(PointerEventPass.Initial)
                    val down = event.changes.firstOrNull() ?: continue
                    if (!down.changedToDown()) continue

                    val startX = down.position.x
                    val startY = down.position.y
                    var triggered = false

                    while (true) {
                        val moveEvent = awaitPointerEvent(PointerEventPass.Initial)
                        val change = moveEvent.changes.firstOrNull() ?: break
                        if (change.changedToUp()) break

                        val dx = change.position.x - startX
                        val dy = change.position.y - startY

                        if (!triggered) {
                            val now = System.currentTimeMillis()
                            if (now - lastTriggerTime >= 500) {
                                val matched = when (returnDirection) {
                                    "down" -> dy > thresholdPx        // 下滑返回
                                    "up" -> dy < -thresholdPx          // 上滑返回
                                    "right" -> dx > thresholdPx        // 右滑返回
                                    "left" -> dx < -thresholdPx        // 左滑返回
                                    else -> false
                                }
                                if (matched) {
                                    lastTriggerTime = now
                                    triggered = true
                                    onReturn()
                                }
                            }
                        }
                    }
                }
            }
        }
    )
}

// ============ 全双工通话占位（阶段5完善） ============
@Composable
fun CallPlaceholder(onBack: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("全双工通话", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(8.dp))
            Text("阶段5实现", color = TextMuted, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(24.dp))
            BackButton(onClick = onBack)
        }
    }
}

// ====================================================================
// 全双工通话 CallScreen —— Lynx v6 完整实现
//
// 设计要点（来自已确认视觉稿）：
// - 全屏覆盖
// - 中央可视化区：3 层波纹 + 白色猞猁 logo
// - 头像下方：状态文字（聆听/思考）+ 通话时长 MM:SS + AI 摘要
// - 底部仅 2 个按钮：挂断（Danger）/ 打断（Primary）
// - 控制按钮 3 秒自动隐藏，轻触屏幕唤起
// - 上滑手势结束通话
// ====================================================================

@Composable
fun CallScreen(onBack: () -> Unit) {
    // 通话状态：listening（聆听）/ thinking（思考）
    var callState by remember { mutableStateOf("listening") }
    // 通话时长（秒）
    var elapsedSeconds by remember { mutableIntStateOf(0) }
    // 控制按钮可见性
    var controlsVisible by remember { mutableStateOf(true) }
    // AI 摘要文案
    val aiSummary = when (callState) {
        "thinking" -> "正在思考你刚才说的话..."
        else -> "你可以对我说：整理灵感、跑巡检、生成日报..."
    }

    // 计时器：每秒 +1
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            elapsedSeconds += 1
        }
    }

    // 控制按钮 3 秒自动隐藏
    LaunchedEffect(controlsVisible) {
        if (controlsVisible) {
            delay(3000)
            controlsVisible = false
        }
    }

    // 模拟状态切换（聆听 5s → 思考 3s → 聆听...）
    LaunchedEffect(Unit) {
        while (true) {
            delay(5000)
            callState = "thinking"
            delay(3000)
            callState = "listening"
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
            // 上滑手势结束通话 + 轻触唤起控制按钮
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        val down = event.changes.firstOrNull() ?: continue
                        if (!down.changedToDown()) continue
                        val startX = down.position.x
                        val startY = down.position.y
                        var triggered = false
                        var moved = false

                        while (true) {
                            val moveEvent = awaitPointerEvent(PointerEventPass.Initial)
                            val change = moveEvent.changes.firstOrNull() ?: break
                            if (change.changedToUp()) {
                                // 未触发滑动的轻触 → 切换控制按钮可见性
                                if (!moved && !triggered) {
                                    controlsVisible = !controlsVisible
                                }
                                break
                            }
                            val dx = change.position.x - startX
                            val dy = change.position.y - startY
                            if (abs(dx) > 10f || abs(dy) > 10f) moved = true
                            // 上滑超过 80dp → 结束通话
                            if (!triggered && dy < -80.dp.toPx()) {
                                triggered = true
                                onBack()
                            }
                        }
                    }
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(horizontal = 24.dp, vertical = 40.dp)
        ) {
            // ====== 中央可视化区：3 层波纹 + 白色猞猁 logo ======
            Box(
                modifier = Modifier.size(180.dp),
                contentAlignment = Alignment.Center
            ) {
                // 3 层波纹
                CallWave(delayMs = 0)
                CallWave(delayMs = 500)
                CallWave(delayMs = 1000)
                // 中央 logo
                Box(
                    modifier = Modifier
                        .size(88.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(GradientPrimary))
                        .border(1.dp, Color.White.copy(alpha = 0.25f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.lynx_logo_white),
                        contentDescription = "Lynx",
                        modifier = Modifier.size(54.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(40.dp))

            // ====== 通话状态文字 ======
            Text(
                text = when (callState) {
                    "thinking" -> "Lynx 正在思考"
                    else -> "Lynx 正在聆听"
                },
                color = TextMuted,
                fontSize = 13.sp,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            // ====== 通话时长 ======
            Text(
                text = formatTimer(elapsedSeconds),
                color = TextPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(40.dp))

            // ====== AI 摘要 ======
            Text(
                text = aiSummary,
                color = TextMuted,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp,
                modifier = Modifier.fillMaxWidth(0.85f)
            )

            Spacer(modifier = Modifier.height(40.dp))

            // ====== 底部控制按钮（仅挂断 + 打断）======
            if (controlsVisible) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(32.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // 打断
                    CallButton(
                        icon = Icons.Filled.Pause,
                        bgColor = Primary.copy(alpha = 0.15f),
                        iconTint = Primary,
                        borderColor = Primary.copy(alpha = 0.25f),
                        onClick = {
                            callState = if (callState == "thinking") "listening" else "thinking"
                        }
                    )
                    // 挂断
                    CallButton(
                        icon = Icons.Filled.CallEnd,
                        bgColor = Danger.copy(alpha = 0.15f),
                        iconTint = Danger,
                        borderColor = Danger.copy(alpha = 0.25f),
                        onClick = onBack
                    )
                }
            } else {
                // 占位提示
                Text(
                    text = "轻触屏幕唤起控制",
                    color = TextMuted.copy(alpha = 0.5f),
                    fontSize = 10.sp
                )
            }
        }
    }
}

/** 单层波纹动画 */
@Composable
private fun CallWave(delayMs: Int) {
    val infiniteTransition = rememberInfiniteTransition(label = "wave_$delayMs")
    val scale by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 1.6f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, delayMillis = delayMs, easing = EaseOutCubic),
            repeatMode = RepeatMode.Restart
        ),
        label = "waveScale_$delayMs"
    )
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.6f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, delayMillis = delayMs, easing = EaseOutCubic),
            repeatMode = RepeatMode.Restart
        ),
        label = "waveAlpha_$delayMs"
    )
    Box(
        modifier = Modifier
            .fillMaxSize()
            .scale(scale)
            .clip(CircleShape)
            .background(Primary.copy(alpha = alpha * 0.15f))
            .border(1.dp, Primary.copy(alpha = alpha * 0.6f), CircleShape)
    )
}

/** 通话控制按钮（56×56 圆形）*/
@Composable
private fun CallButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    bgColor: androidx.compose.ui.graphics.Color,
    iconTint: androidx.compose.ui.graphics.Color,
    borderColor: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(CircleShape)
            .background(bgColor)
            .border(1.dp, borderColor, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(20.dp)
        )
    }
}

/** 通话时长格式化 MM:SS */
private fun formatTimer(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return "%02d:%02d".format(m, s)
}

// ============ 通用占位浮层 ============
@Composable
private fun PlaceholderPanel(
    title: String,
    onBack: () -> Unit,
    hint: String,
    returnDirection: String
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
    ) {
        // 反向滑动手势检测层（Initial 阶段，不消费事件）
        ReturnSwipeDetector(
            returnDirection = returnDirection,
            onReturn = onBack,
            modifier = Modifier.fillMaxSize()
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .padding(start = 16.dp, end = 16.dp, top = 36.dp, bottom = 16.dp)
        ) {
            PanelHeader(title = title, onBack = onBack, swipeHint = hint)
            Spacer(modifier = Modifier.height(24.dp))
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "$title · 阶段3完善",
                    color = TextMuted,
                    fontSize = 12.sp
                )
            }
        }
    }
}

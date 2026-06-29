package com.lynnhub.app.ui.screen.assistant

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.core.EaseInOutSine
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.remember
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.dto.ChatMessageDto
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.component.Pressable
import com.lynnhub.app.ui.component.UserAvatar
import com.lynnhub.app.ui.screen.panel.ChatPanelViewModel
import com.lynnhub.app.ui.theme.*

/**
 * Lynx v6 核心页面：Lynx 助理
 *
 * 设计要点：
 * - 顶部标题 + 用户头像（设置入口），无返回按钮
 * - 快捷指令横向滑动：整理灵感 / 跑巡检 / 生成日报
 * - AI 在左（Primary 边框气泡），用户在右（Agent 边框气泡）
 * - 底部输入框 + 语音发送按钮，不被 Dock 遮挡
 */
@Composable
fun AssistantScreen(
    onOpenSettings: () -> Unit,
    viewModel: ChatPanelViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val userPreferences = remember { UserPreferences(context) }
    val user by userPreferences.userFlow.collectAsState(initial = null)
    val userName = user?.displayName?.ifBlank { null } ?: user?.username ?: "用户"

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp, vertical = 16.dp)
        ) {
            // 顶部：标题 + 在线状态 pill + 用户头像
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Lynx Agent",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    letterSpacing = (-0.3).sp
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    AgentOnlinePill()
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

            Spacer(modifier = Modifier.height(16.dp))

            // 快捷指令
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickChip(text = "整理灵感") { viewModel.sendQuickCommand("整理灵感") }
                QuickChip(text = "跑巡检") { viewModel.sendQuickCommand("跑巡检") }
                QuickChip(text = "生成日报") { viewModel.sendQuickCommand("生成日报") }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 对话流
            if (state.messages.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "你好 $userName，有什么可以帮你？",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    reverseLayout = true,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(
                        items = state.messages.asReversed(),
                        key = { it.id }
                    ) { msg ->
                        ChatBubble(message = msg)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // toast
            AnimatedVisibility(
                visible = state.toast != null,
                enter = fadeIn() + slideInVertically { it },
                exit = fadeOut()
            ) {
                state.toast?.let { msg ->
                    LaunchedEffect(msg) {
                        kotlinx.coroutines.delay(1500)
                        viewModel.clearToast()
                    }
                    Text(
                        text = msg,
                        color = Danger,
                        fontSize = 12.sp,
                        modifier = Modifier
                            .padding(bottom = 8.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Surface)
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }

            // 输入区
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = state.text,
                    onValueChange = viewModel::updateText,
                    placeholder = { Text("输入或长按说话...", color = TextMuted, fontSize = 14.sp) },
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Surface),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.Transparent,
                        unfocusedBorderColor = Color.Transparent,
                        cursorColor = Primary
                    ),
                    singleLine = true,
                    enabled = !state.isSending,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { viewModel.send() }),
                    trailingIcon = {
                        if (state.isSending) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = Primary
                            )
                        }
                    }
                )

                Spacer(modifier = Modifier.width(8.dp))

                // 语音发送按钮（发送中禁用，避免重复点击与 IME 残留字符）
                Pressable(
                    onClick = { viewModel.send() },
                    enabled = !state.isSending,
                    modifier = Modifier.size(48.dp)
                ) { pressed ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(if (pressed) PrimaryDeep else Primary),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (state.text.isBlank()) LynxIcons.Mic else LynxIcons.Send,
                            contentDescription = if (state.text.isBlank()) "语音" else "发送",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AgentOnlinePill() {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(Agent.copy(alpha = 0.1f))
            .border(1.dp, Agent.copy(alpha = 0.22f), RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
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
                .size(5.dp)
                .clip(CircleShape)
                .background(Agent.copy(alpha = alpha))
        )
        Text(
            text = "在线",
            fontSize = 11.sp,
            color = Agent
        )
    }
}

@Composable
private fun QuickChip(text: String, onClick: () -> Unit) {
    Text(
        text = text,
        color = TextPrimary,
        fontSize = 11.sp,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Surface)
            .border(1.dp, BorderHover, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp)
    )
}

@Composable
private fun ChatBubble(message: ChatMessageDto) {
    val isUser = message.role == "user"
    val bubbleColor = if (isUser) Agent else Primary

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.78f)
                .clip(
                    RoundedCornerShape(
                        topStart = 18.dp,
                        topEnd = 18.dp,
                        bottomStart = if (isUser) 18.dp else 4.dp,
                        bottomEnd = if (isUser) 4.dp else 18.dp
                    )
                )
                .background(if (isUser) Surface else Surface)
                .border(1.dp, bubbleColor.copy(alpha = 0.25f), RoundedCornerShape(
                    topStart = 18.dp,
                    topEnd = 18.dp,
                    bottomStart = if (isUser) 18.dp else 4.dp,
                    bottomEnd = if (isUser) 4.dp else 18.dp
                ))
                .padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Text(
                text = message.content.ifBlank { "(空消息)" },
                color = TextPrimary,
                fontSize = 13.5.sp,
                lineHeight = 20.sp
            )
        }
    }
}

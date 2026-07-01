package com.lynnhub.app.ui.screen.assistant

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.ui.component.CoreScreenHeader
import com.lynnhub.app.ui.component.GlassBubble
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.BubbleAssistantBorder
import com.lynnhub.app.ui.theme.BubbleAssistantDeep
import com.lynnhub.app.ui.theme.BubbleUserBorder
import com.lynnhub.app.ui.theme.BubbleUserDeep
import com.lynnhub.app.ui.theme.BorderHover
import com.lynnhub.app.ui.theme.Danger
import com.lynnhub.app.ui.theme.GlassBorderSubtle
import com.lynnhub.app.ui.theme.GlassDeepSoft
import com.lynnhub.app.ui.theme.GlassHighlightDeep
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.PrimaryDeep
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import kotlinx.coroutines.delay

/**
 * Lynx v6 核心页面：Lynx 助理 v2（iOS26 液态玻璃 + 长按语音 + Web 端同步）
 *
 * 设计要点：
 * - 顶部固定 CoreScreenHeader（不随滚动）
 * - 快捷指令横向滑动：6个对齐 Web 端 QUICK_COMMANDS
 * - 聊天气泡使用 GlassBubble 液态玻璃深色风格
 * - 输入框 + 长按语音按钮：长按 Mic 触发录音，松开 ASR 发送
 * - 与 Web 端共享会话历史 + 用户信息 + 记忆上下文
 */
@Composable
fun AssistantScreen(
    onOpenSettings: () -> Unit,
    viewModel: AssistantViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val keyboardController = LocalSoftwareKeyboardController.current
    val context = LocalContext.current
    var isInputFocused by remember { mutableStateOf(false) }
    var isLongPressing by remember { mutableStateOf(false) }

    // 每次进入页面时刷新历史消息，确保与 Web 端同步
    LaunchedEffect(Unit) {
        viewModel.refreshMessages()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .pointerInput(Unit) {
                detectTapGestures(onTap = { keyboardController?.hide() })
            }
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding()
        ) {
            // 固定顶部栏（iOS26 液态玻璃，不随滚动）
            CoreScreenHeader(
                title = "Lynx",
                userName = state.userName,
                onOpenSettings = onOpenSettings
            )

            // 快捷指令（对齐 Web 端 QUICK_COMMANDS）
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                QuickChip("📋 今日概览") { viewModel.sendQuickCommand("给我一个今日概览：今天有多少灵感、看板任务进度、最近记忆") }
                QuickChip("💡 创建灵感") { viewModel.sendQuickCommand("帮我创建一个灵感：") }
                QuickChip("📊 看板状态") { viewModel.sendQuickCommand("看板状态如何？本周完成了多少任务？") }
                QuickChip("🔍 搜索记忆") { viewModel.sendQuickCommand("帮我搜索记忆：") }
                QuickChip("🛡️ 执行巡检") { viewModel.sendQuickCommand("跑一下AI巡检，看看有什么需要关注的") }
                QuickChip("⚡ 执行技能") { viewModel.sendQuickCommand("列出可用技能，我想执行一个") }
            }

            // 对话流
            if (state.messages.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "你好 ${state.userName}，有什么可以帮你？",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(horizontal = 16.dp),
                    reverseLayout = true,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(
                        items = state.messages.asReversed(),
                        key = { it.id }
                    ) { msg ->
                        GlassBubble(
                            message = msg.content,
                            isUser = msg.role == "user"
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // toast
            AnimatedVisibility(
                visible = state.toast != null,
                enter = fadeIn() + slideInVertically { it },
                exit = fadeOut(),
                modifier = Modifier.padding(horizontal = 16.dp).padding(bottom = 8.dp)
            ) {
                state.toast?.let { msg ->
                    LaunchedEffect(msg) {
                        delay(1500)
                        viewModel.clearToast()
                    }
                    Text(
                        text = msg,
                        color = Danger,
                        fontSize = 12.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(GlassDeepSoft)
                            .border(1.dp, GlassBorderSubtle, RoundedCornerShape(8.dp))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                }
            }

            // 录音状态指示
            if (state.isRecording) {
                RecordingIndicator()
            }

            // 输入区（长按语音按钮发送语音）
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = state.text,
                    onValueChange = viewModel::updateText,
                    placeholder = { Text("输入或长按麦克风说话...", color = TextMuted, fontSize = 14.sp) },
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(18.dp))
                        .background(GlassDeepSoft)
                        .border(1.dp, GlassBorderSubtle, RoundedCornerShape(18.dp))
                        .drawBehind {
                            drawLine(
                                color = GlassHighlightDeep.copy(alpha = 0.3f),
                                start = Offset(18f, 0f),
                                end = Offset(size.width - 18f, 0f),
                                strokeWidth = 1f
                            )
                        },
                    shape = RoundedCornerShape(18.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.Transparent,
                        unfocusedBorderColor = Color.Transparent,
                        cursorColor = Primary,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
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

                Spacer(modifier = Modifier.width(10.dp))

                // 长按语音/发送按钮
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(
                            if (isLongPressing) Brush.linearGradient(listOf(Danger, PrimaryDeep))
                            else Brush.linearGradient(listOf(Primary, PrimaryDeep))
                        )
                        .border(1.dp, GlassHighlightDeep.copy(alpha = 0.4f), CircleShape)
                        .pointerInput(Unit) {
                            detectTapGestures(
                                onPress = {
                                    // 仅当输入框为空时，长按触发录音
                                    if (state.text.isBlank() && !state.isSending) {
                                        isLongPressing = true
                                        if (viewModel.hasRecordPermission()) {
                                            viewModel.startRecording()
                                        }
                                        tryAwaitRelease()
                                        isLongPressing = false
                                        if (viewModel.uiState.value.isRecording) {
                                            viewModel.stopRecording()
                                        }
                                    }
                                },
                                onTap = {
                                    // 单击发送文字
                                    if (state.text.isNotBlank() && !state.isSending) {
                                        viewModel.send()
                                    }
                                }
                            )
                        },
                    contentAlignment = Alignment.Center
                ) {
                    val icon = when {
                        state.isTranscribing -> LynxIcons.Mic
                        state.text.isBlank() -> LynxIcons.Mic
                        else -> LynxIcons.Send
                    }
                    val desc = when {
                        state.isTranscribing -> "识别中"
                        state.text.isBlank() -> "长按说话"
                        else -> "发送"
                    }
                    if (state.isTranscribing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = TextPrimary
                        )
                    } else {
                        Icon(
                            imageVector = icon,
                            contentDescription = desc,
                            tint = TextPrimary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

// ============ 快捷指令胶囊 ============
@Composable
private fun QuickChip(text: String, onClick: () -> Unit) {
    Text(
        text = text,
        color = TextPrimary,
        fontSize = 11.sp,
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(GlassDeepSoft)
            .border(1.dp, GlassBorderSubtle, RoundedCornerShape(14.dp))
            .drawBehind {
                drawLine(
                    color = GlassHighlightDeep.copy(alpha = 0.3f),
                    start = Offset(14f, 0f),
                    end = Offset(size.width - 14f, 0f),
                    strokeWidth = 1f
                )
            }
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp)
    )
}

// ============ 录音状态指示器 ============
@Composable
private fun RecordingIndicator() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.Center
    ) {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(Danger.copy(alpha = 0.15f))
                .border(1.dp, Danger.copy(alpha = 0.3f), RoundedCornerShape(999.dp))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(Danger)
            )
            Text(
                text = "录音中...松开发送",
                color = Danger,
                fontSize = 11.sp
            )
        }
    }
}

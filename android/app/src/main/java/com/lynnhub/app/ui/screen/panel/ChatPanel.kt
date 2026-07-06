package com.lynnhub.app.ui.screen.panel

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import com.lynnhub.app.ui.component.LynxIcons
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.VoiceApiClient
import com.lynnhub.app.data.remote.dto.ChatCreateSessionRequest
import com.lynnhub.app.data.remote.dto.ChatMessageDto
import com.lynnhub.app.data.remote.dto.ChatMessageRequest
import com.lynnhub.app.data.remote.dto.ChatSendRequest
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.BorderHover
import com.lynnhub.app.ui.theme.Danger
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.Surface
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import com.lynnhub.app.ui.theme.Void
import com.lynnhub.app.util.AudioRecorder
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

// ============ AI 对话浮层（左滑进入，右滑返回） ============
// 设计要点：
// 1. AI 在左（蓝边气泡 Primary），用户在右（青边气泡 Agent），无头像/昵称/时间戳
// 2. 快捷指令横向滑动：3 个胶囊（整理灵感 / 跑巡检 / 生成日报）
// 3. 输入框 + 麦克风按钮，placeholder "输入或长按球说话..."
// 4. 进入时自动初始化会话（取首个或新建），空消息显示欢迎语

data class ChatPanelUiState(
    val messages: List<ChatMessageDto> = emptyList(),
    val text: String = "",
    val isSending: Boolean = false,
    val isRecording: Boolean = false,
    val isTranscribing: Boolean = false,
    val sessionId: String? = null,
    val sessionReady: Boolean = false,
    val toast: String? = null
)

@HiltViewModel
class ChatPanelViewModel @Inject constructor(
    private val apiService: ApiService,
    private val voiceApiClient: VoiceApiClient
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatPanelUiState())
    val uiState: StateFlow<ChatPanelUiState> = _uiState.asStateFlow()

    private val audioRecorder = AudioRecorder()

    init {
        initSession()
    }

    private fun initSession() {
        viewModelScope.launch {
            try {
                val sessions = apiService.getChatSessions().sessions
                val sid = if (sessions.isNotEmpty()) {
                    sessions.first().id
                } else {
                    apiService.createChatSession(
                        ChatCreateSessionRequest(title = "奇思", provider = "deepseek")
                    ).session.id
                }
                // 先标记 sessionReady，再加载历史；加载历史时绝不覆盖用户已发消息
                _uiState.update { it.copy(sessionId = sid, sessionReady = true) }
                loadMessages()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(sessionReady = true, toast = "会话初始化失败: ${e.message ?: "网络错误"}")
                }
            }
        }
    }

    private fun loadMessages() {
        val sid = _uiState.value.sessionId ?: return
        // 发送中或已有本地消息时，不覆盖（避免竞态）
        if (_uiState.value.isSending || _uiState.value.messages.isNotEmpty()) return
        viewModelScope.launch {
            try {
                val resp = apiService.getChatMessages(sid)
                // 仅在消息列表仍为空时才覆盖
                _uiState.update { state ->
                    if (state.messages.isEmpty()) state.copy(messages = resp.messages)
                    else state
                }
            } catch (e: Exception) {
                // 加载历史失败不阻塞用户发送
            }
        }
    }

    fun updateText(t: String) {
        _uiState.update { it.copy(text = t) }
    }

    fun send(content: String? = null) {
        val text = (content ?: _uiState.value.text).trim()
        if (text.isBlank()) return
        if (_uiState.value.isSending) return

        val userMsg = ChatMessageDto(
            id = UUID.randomUUID().toString(),
            role = "user",
            content = text
        )
        val history = _uiState.value.messages + userMsg
        _uiState.update {
            it.copy(messages = history, text = "", isSending = true)
        }

        viewModelScope.launch {
            try {
                val req = ChatSendRequest(
                    messages = history.map { msg ->
                        ChatMessageRequest(role = msg.role, content = msg.content)
                    },
                    provider = "deepseek",
                    assistantMode = true,  // 启用助理模式：支持工具调用
                    stream = false
                )
                val resp = apiService.sendChat(req)
                // 助理模式可能返回工具调用结果，拼接显示
                var displayContent = buildString {
                    append(resp.content.ifBlank { "(空回复)" })
                    resp.toolCalled?.let { tool ->
                        append("\n\n[工具调用: ${tool.tool}]")
                        tool.result?.let { result ->
                            append("\n结果: $result")
                        }
                    }
                }
                if (displayContent.isBlank()) {
                    displayContent = "(空回复)"
                }
                val aiMsg = ChatMessageDto(
                    id = UUID.randomUUID().toString(),
                    role = "assistant",
                    content = displayContent
                )
                _uiState.update {
                    it.copy(messages = it.messages + aiMsg, isSending = false)
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isSending = false, toast = "发送失败: ${e.message ?: "请检查网络"}")
                }
            }
        }
    }

    fun sendQuickCommand(cmd: String) {
        send(cmd)
    }

    /** 开始录音 */
    fun startRecording(): Boolean {
        val started = audioRecorder.start()
        if (started) {
            _uiState.update { it.copy(isRecording = true) }
        }
        return started
    }

    /** 停止录音并 ASR 转文字，自动发送 */
    fun stopRecording() {
        if (!_uiState.value.isRecording) return
        val pcmData = audioRecorder.stop()
        val wavData = audioRecorder.pcmToWav(pcmData)
        _uiState.update { it.copy(isRecording = false, isTranscribing = true) }
        viewModelScope.launch {
            try {
                val text = voiceApiClient.recognizeSpeechSmart(wavData)
                _uiState.update { it.copy(isTranscribing = false) }
                if (text.isNotBlank()) {
                    // 语音转文字成功，自动发送
                    send(text)
                } else {
                    _uiState.update { it.copy(toast = "未识别到语音") }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isTranscribing = false, toast = "语音识别失败: ${e.message}")
                }
            }
        }
    }

    fun clearToast() {
        _uiState.update { it.copy(toast = null) }
    }

    override fun onCleared() {
        super.onCleared()
        // 退出页面时若仍在录音，停止并释放 AudioRecord 系统资源
        if (audioRecorder.isRecording()) {
            audioRecorder.stop()
        }
    }
}

@Composable
fun ChatPanel(
    onBack: () -> Unit,
    viewModel: ChatPanelViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val keyboardController = LocalSoftwareKeyboardController.current
    val context = LocalContext.current
    var isInputFocused by remember { mutableStateOf(false) }

    // 录音权限请求
    val recordPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            viewModel.startRecording()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .pointerInput(Unit) {
                detectTapGestures(onTap = { keyboardController?.hide() })
            }
    ) {
        // 反向滑动检测层（右滑返回）
        ReturnSwipeDetector(
            returnDirection = "right",
            onReturn = onBack,
            modifier = Modifier.fillMaxSize()
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding()
                .padding(start = 22.dp, end = 22.dp, top = 16.dp, bottom = 24.dp)
        ) {
            PanelHeader(title = "奇思", onBack = onBack, swipeHint = "← 右滑返回")
            Spacer(modifier = Modifier.height(0.dp))

            // 快捷指令：3 个胶囊横向滑动
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

            // 对话流：reverseLayout 让最新消息贴底显示（输入聚焦时加半透明蒙层）
            if (state.messages.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .drawWithContent {
                            drawContent()
                            if (isInputFocused) drawRect(Color.Black, alpha = 0.35f)
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "你好 Lynn，有什么可以帮你？",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .drawWithContent {
                            drawContent()
                            if (isInputFocused) drawRect(Color.Black, alpha = 0.35f)
                        },
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

            // toast：1.5s 自动清除
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
                        .background(Surface)
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
            }

            // 输入区：输入框 + 麦克风按钮
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = state.text,
                    onValueChange = viewModel::updateText,
                    placeholder = { Text("输入或长按球说话...", color = TextMuted, fontSize = 14.sp) },
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Surface)
                        .onFocusChanged { isInputFocused = it.isFocused },
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

                // 麦克风按钮：点击切换录音/停止，转文字后自动发送
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(
                            when {
                                state.isRecording -> Danger.copy(alpha = 0.15f)
                                state.isTranscribing -> Primary.copy(alpha = 0.10f)
                                else -> Surface
                            }
                        )
                        .border(
                            1.dp,
                            if (state.isRecording) Danger else BorderHover,
                            CircleShape
                        )
                        .clickable {
                            when {
                                state.isTranscribing -> { /* 转写中，忽略 */ }
                                state.isRecording -> viewModel.stopRecording()
                                else -> {
                                    val hasPermission = ContextCompat.checkSelfPermission(
                                        context,
                                        Manifest.permission.RECORD_AUDIO
                                    ) == PackageManager.PERMISSION_GRANTED
                                    if (hasPermission) {
                                        viewModel.startRecording()
                                    } else {
                                        recordPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                    }
                                }
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    when {
                        state.isTranscribing -> {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                                color = Primary
                            )
                        }
                        state.isRecording -> {
                            Icon(
                                imageVector = LynxIcons.Mic,
                                contentDescription = "停止录音",
                                tint = Danger,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        else -> {
                            Icon(
                                imageVector = LynxIcons.Mic,
                                contentDescription = "语音输入",
                                tint = Primary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
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
            .clip(RoundedCornerShape(12.dp))
            .background(Surface)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp)
    )
}

// ============ 对话气泡 ============
@Composable
private fun ChatBubble(message: ChatMessageDto) {
    val isUser = message.role == "user"
    val bubbleColor = if (isUser) Agent.copy(alpha = 0.08f) else Primary.copy(alpha = 0.08f)
    val borderColor = if (isUser) Agent.copy(alpha = 0.2f) else Primary.copy(alpha = 0.2f)
    val bubbleShape = if (isUser) {
        RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp, bottomStart = 4.dp, bottomEnd = 14.dp)
    } else {
        RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp, bottomStart = 14.dp, bottomEnd = 4.dp)
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Text(
            text = message.content,
            color = TextPrimary,
            fontSize = 13.sp,
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(bubbleShape)
                .background(bubbleColor)
                .border(1.dp, borderColor, bubbleShape)
                .padding(horizontal = 12.dp, vertical = 8.dp)
        )
    }
}

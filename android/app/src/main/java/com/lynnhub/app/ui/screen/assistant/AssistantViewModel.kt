package com.lynnhub.app.ui.screen.assistant

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.VoiceApiClient
import com.lynnhub.app.data.remote.dto.ChatCreateSessionRequest
import com.lynnhub.app.data.remote.dto.ChatMessageDto
import com.lynnhub.app.data.remote.dto.ChatMessageRequest
import com.lynnhub.app.data.remote.dto.ChatSendRequest
import com.lynnhub.app.data.remote.dto.MemoryNodeDto
import com.lynnhub.app.util.AudioRecorder
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/**
 * Lynx 助理 ViewModel v2
 *
 * 解决核心问题：与 Web 端聊天同步
 * 1. 复用 Web 端同款会话 API（getChatSessions/createChatSession/getChatMessages/sendChat）
 * 2. 加载用户 profile（从 UserPreferences），让助理知道用户名字/角色
 * 3. 加载记忆图谱（从 ApiService.getMemory），让助理具备记忆上下文
 * 4. assistantMode = true 启用工具调用
 * 5. 支持长按语音发送：startRecording/stopRecording
 * 6. 系统提示词注入用户信息和记忆上下文
 */
@HiltViewModel
class AssistantViewModel @Inject constructor(
    private val apiService: ApiService,
    private val voiceApiClient: VoiceApiClient,
    private val userPreferences: UserPreferences,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(AssistantUiState())
    val uiState: StateFlow<AssistantUiState> = _uiState.asStateFlow()

    private val audioRecorder = AudioRecorder()

    init {
        loadUserProfile()
        initSession()
        loadMemory()
    }

    /** 加载用户 profile */
    private fun loadUserProfile() {
        viewModelScope.launch {
            try {
                val user = userPreferences.userFlow.first()
                _uiState.update {
                    it.copy(
                        userName = user?.displayName?.ifBlank { null }
                            ?: user?.username ?: "用户",
                        userRole = user?.role ?: ""
                    )
                }
            } catch (e: Exception) {
                // 加载失败不阻塞会话
            }
        }
    }

    /** 初始化会话：复用 Web 端同款会话 API */
    private fun initSession() {
        viewModelScope.launch {
            try {
                val sessions = apiService.getChatSessions().sessions
                val sid = if (sessions.isNotEmpty()) {
                    // 优先取标题为 "Lynx" 的会话（与 Web 端保持一致）
                    sessions.firstOrNull { it.title.equals("Lynx", ignoreCase = true) }?.id
                        ?: sessions.first().id
                } else {
                    apiService.createChatSession(
                        ChatCreateSessionRequest(title = "Lynx", provider = "deepseek")
                    ).session.id
                }
                _uiState.update { it.copy(sessionId = sid, sessionReady = true) }
                loadMessages()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(sessionReady = true, toast = "会话初始化失败: ${e.message ?: "网络错误"}")
                }
            }
        }
    }

    /** 加载历史消息：与 Web 端共享同一会话历史 */
    private fun loadMessages() {
        val sid = _uiState.value.sessionId ?: return
        if (_uiState.value.isSending || _uiState.value.messages.isNotEmpty()) return
        viewModelScope.launch {
            try {
                val resp = apiService.getChatMessages(sid)
                _uiState.update { state ->
                    if (state.messages.isEmpty()) state.copy(messages = resp.messages)
                    else state
                }
            } catch (e: Exception) {
                // 加载历史失败不阻塞用户发送
            }
        }
    }

    /** 加载记忆图谱：让助理具备记忆上下文 */
    private fun loadMemory() {
        viewModelScope.launch {
            try {
                val resp = apiService.getMemory()
                _uiState.update { it.copy(memoryNodes = resp.nodes) }
            } catch (e: Exception) {
                // 记忆加载失败不阻塞会话
            }
        }
    }

    fun updateText(t: String) {
        _uiState.update { it.copy(text = t) }
    }

    /** 发送消息：注入用户信息+记忆上下文作为系统提示 */
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
                // 构造系统提示：注入用户信息和记忆上下文
                val systemPrompt = buildSystemPrompt()
                val messagesWithSystem = mutableListOf<ChatMessageRequest>()
                messagesWithSystem.add(ChatMessageRequest(role = "system", content = systemPrompt))
                history.forEach { msg ->
                    messagesWithSystem.add(ChatMessageRequest(role = msg.role, content = msg.content))
                }

                val req = ChatSendRequest(
                    messages = messagesWithSystem,
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

    /** 构造系统提示：注入用户信息+记忆上下文，让助理"知道"用户是谁 */
    private fun buildSystemPrompt(): String {
        val userName = _uiState.value.userName
        val userRole = _uiState.value.userRole
        val memories = _uiState.value.memoryNodes.takeLast(10) // 最近10条记忆

        return buildString {
            append("你是 Lynx 助理，Lynx AI 工作台的核心助理。")
            append("当前用户是 $userName")
            if (userRole.isNotBlank()) {
                append("（角色：$userRole）")
            }
            append("。")
            append("你可以帮助用户管理灵感、任务、记忆，调用各种工具完成工作。")
            append("请用简洁友好的语气回复，称呼用户的名字。")
            if (memories.isNotEmpty()) {
                append("\n\n用户最近的记忆上下文：")
                memories.forEach { node ->
                    append("\n- [${node.type}] ${node.label.ifBlank { node.fullContent.take(50) }}")
                }
            }
        }
    }

    fun sendQuickCommand(cmd: String) {
        send(cmd)
    }

    /** 检查录音权限 */
    fun hasRecordPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    /** 开始录音（长按触发） */
    fun startRecording(): Boolean {
        val started = audioRecorder.start()
        if (started) {
            _uiState.update { it.copy(isRecording = true) }
        }
        return started
    }

    /** 停止录音并 ASR 转文字，自动发送（长按释放触发） */
    fun stopRecording() {
        if (!_uiState.value.isRecording) return
        val pcmData = audioRecorder.stop()
        val wavData = audioRecorder.pcmToWav(pcmData)
        _uiState.update { it.copy(isRecording = false, isTranscribing = true) }
        viewModelScope.launch {
            try {
                val text = voiceApiClient.recognizeSpeech(wavData)
                _uiState.update { it.copy(isTranscribing = false) }
                if (text.isNotBlank()) {
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

    /** 取消录音（长按后滑出取消） */
    fun cancelRecording() {
        if (!_uiState.value.isRecording) return
        audioRecorder.stop()
        _uiState.update { it.copy(isRecording = false, toast = "已取消语音") }
    }

    fun clearToast() {
        _uiState.update { it.copy(toast = null) }
    }

    override fun onCleared() {
        super.onCleared()
        if (audioRecorder.isRecording()) {
            audioRecorder.stop()
        }
    }
}

data class AssistantUiState(
    val messages: List<ChatMessageDto> = emptyList(),
    val text: String = "",
    val isSending: Boolean = false,
    val isRecording: Boolean = false,
    val isTranscribing: Boolean = false,
    val sessionId: String? = null,
    val sessionReady: Boolean = false,
    val toast: String? = null,
    val userName: String = "用户",
    val userRole: String = "",
    val memoryNodes: List<MemoryNodeDto> = emptyList()
)

package com.lynnhub.app.ui.screen.chat

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.StreamChatClient
import com.lynnhub.app.data.remote.dto.*
import com.lynnhub.app.data.remote.SseEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: String, // user | assistant
    val content: String = "",
    val toolCalls: List<ToolCallDto> = emptyList(),
    val isStreaming: Boolean = false,
    val error: String? = null
)

data class ChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val sessions: List<ChatSessionDto> = emptyList(),
    val currentSessionId: String? = null,
    val inputText: String = "",
    val isLoading: Boolean = false,
    val isStreaming: Boolean = false,
    val error: String? = null,
    val showSessionList: Boolean = false,
    val aiSettings: AiSettingsDto? = null,
    val quickCommands: List<String> = listOf(
        "执行巡检",
        "今日聚焦",
        "帮我规划今天的任务",
        "总结本周进展"
    )
)

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val apiService: ApiService,
    private val streamChatClient: StreamChatClient,
    private val userPreferences: UserPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    init {
        loadSessions()
        loadAiSettings()
    }

    fun updateInput(text: String) {
        _uiState.value = _uiState.value.copy(inputText = text)
    }

    fun toggleSessionList() {
        _uiState.value = _uiState.value.copy(showSessionList = !_uiState.value.showSessionList)
    }

    fun loadSessions() {
        viewModelScope.launch {
            try {
                val response = apiService.getChatSessions()
                _uiState.value = _uiState.value.copy(sessions = response.sessions)
                if (_uiState.value.currentSessionId == null && response.sessions.isNotEmpty()) {
                    selectSession(response.sessions.first().id)
                }
            } catch (e: Exception) {
                Log.w("ChatViewModel", "loadSessions failed", e)
            }
        }
    }

    fun selectSession(sessionId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(currentSessionId = sessionId, showSessionList = false)
            try {
                val response = apiService.getChatMessages(sessionId)
                val messages = response.messages.map {
                    ChatMessage(
                        id = it.id,
                        role = it.role,
                        content = it.content,
                        toolCalls = it.toolCalls ?: emptyList()
                    )
                }
                _uiState.value = _uiState.value.copy(messages = messages)
            } catch (e: Exception) {
                Log.w("ChatViewModel", "selectSession failed: $sessionId", e)
            }
        }
    }

    fun createNewSession() {
        viewModelScope.launch {
            try {
                val session = apiService.createChatSession(
                    ChatCreateSessionRequest(title = "新对话", provider = "deepseek")
                ).session
                _uiState.value = _uiState.value.copy(
                    sessions = listOf(session) + _uiState.value.sessions,
                    currentSessionId = session.id,
                    messages = emptyList(),
                    showSessionList = false
                )
            } catch (e: Exception) {
                Log.w("ChatViewModel", "createNewSession failed", e)
            }
        }
    }

    fun deleteSession(sessionId: String) {
        viewModelScope.launch {
            try {
                apiService.deleteChatSession(sessionId)
                val remaining = _uiState.value.sessions.filter { it.id != sessionId }
                _uiState.value = _uiState.value.copy(sessions = remaining)
                if (_uiState.value.currentSessionId == sessionId) {
                    if (remaining.isNotEmpty()) {
                        selectSession(remaining.first().id)
                    } else {
                        _uiState.value = _uiState.value.copy(currentSessionId = null, messages = emptyList())
                    }
                }
            } catch (e: Exception) {
                Log.w("ChatViewModel", "deleteSession failed: $sessionId", e)
            }
        }
    }

    fun sendMessage(text: String? = null) {
        val content = (text ?: _uiState.value.inputText).trim()
        if (content.isEmpty() || _uiState.value.isStreaming) return

        val userMessage = ChatMessage(role = "user", content = content)
        val assistantMessage = ChatMessage(role = "assistant", content = "", isStreaming = true)

        _uiState.value = _uiState.value.copy(
            messages = _uiState.value.messages + listOf(userMessage, assistantMessage),
            inputText = "",
            isStreaming = true,
            error = null
        )

        viewModelScope.launch {
            try {
                // 构建发送给后端的 messages 数组（包含历史消息）
                val requestMessages = _uiState.value.messages
                    .filter { it.id != assistantMessage.id }
                    .map { ChatMessageRequest(role = it.role, content = it.content) }

                val response = apiService.sendChat(ChatSendRequest(
                    messages = requestMessages,
                    provider = "deepseek",
                    assistantMode = true,
                    stream = false
                ))

                _uiState.value = _uiState.value.copy(
                    messages = _uiState.value.messages.map { msg ->
                        if (msg.id == assistantMessage.id) {
                            msg.copy(
                                isStreaming = false,
                                content = response.content,
                                toolCalls = response.toolCalled?.let { tc ->
                                    listOf(ToolCallDto(
                                        name = tc.tool ?: "",
                                        arguments = tc.args?.toString(),
                                        result = tc.result?.toString()
                                    ))
                                } ?: emptyList()
                            )
                        } else msg
                    },
                    isStreaming = false
                )
                // 刷新会话列表（标题可能已更新）
                loadSessions()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    messages = _uiState.value.messages.map { msg ->
                        if (msg.id == assistantMessage.id) {
                            msg.copy(isStreaming = false, error = e.message ?: "发送失败")
                        } else msg
                    },
                    isStreaming = false,
                    error = e.message
                )
            }
        }
    }

    fun clearMessages() {
        _uiState.value = _uiState.value.copy(messages = emptyList())
    }

    private fun loadAiSettings() {
        viewModelScope.launch {
            try {
                val settings = apiService.getAiSettings().settings
                _uiState.value = _uiState.value.copy(aiSettings = settings)
            } catch (e: Exception) {
                Log.w("ChatViewModel", "loadAiSettings failed", e)
            }
        }
    }
}

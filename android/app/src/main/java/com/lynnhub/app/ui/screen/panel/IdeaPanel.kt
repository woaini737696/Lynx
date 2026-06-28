package com.lynnhub.app.ui.screen.panel

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.IdeaCreateRequest
import com.lynnhub.app.data.remote.dto.IdeaDto
import com.lynnhub.app.ui.screen.home.formatRelativeTime
import com.lynnhub.app.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

// ============ 灵感速记浮层（上滑进入，下滑返回） ============
// 设计要点：
// 1. 快速语音/文字记录，回车即保存到 inbox（source=lightning, status=inbox）
// 2. 顶部输入框 + 发送按钮，圆角 14dp + Surface 背景
// 3. 下方展示最近 8 条灵感，灵感点 Primary 色 + 内容最多 3 行 + 相对时间
// 4. toast 1.5s 自动消失，强化"捕获即留存"的即时反馈

data class IdeaPanelUiState(
    val text: String = "",
    val isSubmitting: Boolean = false,
    val recentIdeas: List<IdeaDto> = emptyList(),
    val toast: String? = null
)

@HiltViewModel
class IdeaPanelViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(IdeaPanelUiState())
    val uiState: StateFlow<IdeaPanelUiState> = _uiState.asStateFlow()

    init {
        loadRecent()
    }

    private fun loadRecent() {
        viewModelScope.launch {
            try {
                val resp = apiService.getIdeas()
                _uiState.update { it.copy(recentIdeas = resp.data.take(8)) }
            } catch (_: Exception) {
                // 静默失败，保留空列表
            }
        }
    }

    fun updateText(t: String) {
        _uiState.update { it.copy(text = t) }
    }

    fun submit() {
        val content = _uiState.value.text.trim()
        if (content.isBlank()) return
        if (_uiState.value.isSubmitting) return
        _uiState.update { it.copy(isSubmitting = true) }
        viewModelScope.launch {
            try {
                apiService.createIdea(
                    IdeaCreateRequest(
                        content = content,
                        source = "lightning",
                        status = "inbox"
                    )
                )
                _uiState.update {
                    it.copy(text = "", isSubmitting = false, toast = "已捕获灵感")
                }
                loadRecent()
            } catch (_: Exception) {
                _uiState.update { it.copy(isSubmitting = false, toast = "提交失败") }
            }
        }
    }

    fun clearToast() {
        _uiState.update { it.copy(toast = null) }
    }
}

@Composable
fun IdeaPanel(
    onBack: () -> Unit,
    viewModel: IdeaPanelViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
    ) {
        // 反向滑动检测层（下滑返回）
        ReturnSwipeDetector(
            returnDirection = "down",
            onReturn = onBack,
            modifier = Modifier.fillMaxSize()
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .padding(start = 16.dp, end = 16.dp, top = 36.dp, bottom = 16.dp)
        ) {
            PanelHeader(title = "灵感速记", onBack = onBack, swipeHint = "↓ 下滑返回")
            Spacer(modifier = Modifier.height(20.dp))

            // 输入框：回车即保存
            OutlinedTextField(
                value = state.text,
                onValueChange = viewModel::updateText,
                placeholder = { Text("记录灵感...", color = TextMuted, fontSize = 14.sp) },
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Surface),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color.Transparent,
                    unfocusedBorderColor = Color.Transparent,
                    cursorColor = Primary
                ),
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { viewModel.submit() }),
                trailingIcon = {
                    if (state.isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Primary
                        )
                    } else {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.Send,
                            contentDescription = "发送",
                            tint = Primary,
                            modifier = Modifier
                                .clip(CircleShape)
                                .clickable { viewModel.submit() }
                                .padding(6.dp)
                        )
                    }
                }
            )

            // toast：1.5s 自动清除
            state.toast?.let { msg ->
                LaunchedEffect(msg) {
                    delay(1500)
                    viewModel.clearToast()
                }
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = msg,
                    color = Agent,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Surface)
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // 最近灵感列表
            if (state.recentIdeas.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("暂无灵感", color = TextMuted, fontSize = 13.sp)
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(
                        items = state.recentIdeas,
                        key = { it.id }
                    ) { idea ->
                        IdeaRow(idea = idea)
                    }
                }
            }
        }
    }
}

@Composable
private fun IdeaRow(idea: IdeaDto) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Surface)
            .padding(12.dp),
        verticalAlignment = Alignment.Top
    ) {
        // 灵感点（Primary 色 5dp 圆）
        Box(
            modifier = Modifier
                .padding(top = 6.dp)
                .size(5.dp)
                .clip(CircleShape)
                .background(Primary)
        )
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = idea.content.ifBlank { "(空灵感)" },
                color = TextPrimary,
                fontSize = 14.sp,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
            if (idea.createdAt.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formatRelativeTime(idea.createdAt),
                    color = TextMuted,
                    fontSize = 11.sp
                )
            }
        }
    }
}

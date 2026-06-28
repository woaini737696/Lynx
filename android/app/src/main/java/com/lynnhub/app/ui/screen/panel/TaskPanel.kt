package com.lynnhub.app.ui.screen.panel

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.TaskCreateRequest
import com.lynnhub.app.data.remote.dto.TaskDto
import com.lynnhub.app.data.remote.dto.TaskPatchRequest
import com.lynnhub.app.ui.screen.home.formatRelativeTime
import com.lynnhub.app.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

// ============ 任务视图浮层（下滑进入，上滑返回） ============
// 设计要点：
// 1. 按"进行中"/"已完成"分组展示看板任务
// 2. 左侧圆形复选框点击切换完成状态（乐观更新 + 失败回滚）
// 3. 已完成任务内容加删除线 + 更暗文字
// 4. 底部输入框回车即创建（column="task"）

data class TaskPanelUiState(
    val tasks: List<TaskDto> = emptyList(),
    val text: String = "",
    val isSubmitting: Boolean = false,
    val isLoading: Boolean = true
)

@HiltViewModel
class TaskPanelViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(TaskPanelUiState())
    val uiState: StateFlow<TaskPanelUiState> = _uiState.asStateFlow()

    init {
        loadTasks()
    }

    fun loadTasks() {
        viewModelScope.launch {
            try {
                val resp = apiService.getTasks()
                _uiState.update { it.copy(tasks = resp.data, isLoading = false) }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoading = false) }
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
                apiService.createTask(TaskCreateRequest(content = content, column = "task"))
                _uiState.update { it.copy(text = "", isSubmitting = false) }
                loadTasks()
            } catch (_: Exception) {
                _uiState.update { it.copy(isSubmitting = false) }
            }
        }
    }

    /**
     * 切换任务完成状态：未完成 → done；已完成 → active。
     * 先乐观更新本地状态，失败时回滚。
     */
    fun toggleTask(task: TaskDto) {
        val previous = _uiState.value.tasks
        val newCompleted = !task.completed
        _uiState.update { s ->
            s.copy(
                tasks = s.tasks.map {
                    if (it.id == task.id) it.copy(completed = newCompleted) else it
                }
            )
        }
        viewModelScope.launch {
            try {
                val newStatus = if (newCompleted) "done" else "active"
                apiService.patchTask(task.id, TaskPatchRequest(status = newStatus))
            } catch (_: Exception) {
                // 回滚到先前状态
                _uiState.update { it.copy(tasks = previous) }
            }
        }
    }
}

@Composable
fun TaskPanel(
    onBack: () -> Unit,
    viewModel: TaskPanelViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
    ) {
        // 反向滑动检测层（上滑返回）
        ReturnSwipeDetector(
            returnDirection = "up",
            onReturn = onBack,
            modifier = Modifier.fillMaxSize()
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .padding(start = 16.dp, end = 16.dp, top = 36.dp, bottom = 16.dp)
        ) {
            PanelHeader(title = "任务", onBack = onBack, swipeHint = "↑ 上滑返回")
            Spacer(modifier = Modifier.height(16.dp))

            // 任务列表
            if (state.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Primary)
                }
            } else {
                val active = state.tasks.filter { !it.completed }
                val done = state.tasks.filter { it.completed }
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (active.isNotEmpty()) {
                        item(key = "header_active") { SectionTitle("进行中") }
                        items(
                            items = active,
                            key = { "active_${it.id}" }
                        ) { task ->
                            TaskRow(
                                task = task,
                                onToggle = { viewModel.toggleTask(task) }
                            )
                        }
                    }
                    if (done.isNotEmpty()) {
                        item(key = "header_done") {
                            Spacer(modifier = Modifier.height(8.dp))
                            SectionTitle("已完成")
                        }
                        items(
                            items = done,
                            key = { "done_${it.id}" }
                        ) { task ->
                            TaskRow(
                                task = task,
                                onToggle = { viewModel.toggleTask(task) }
                            )
                        }
                    }
                    if (active.isEmpty() && done.isEmpty()) {
                        item(key = "empty") {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 40.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("暂无任务", color = TextMuted, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 底部输入框：回车即创建
            OutlinedTextField(
                value = state.text,
                onValueChange = viewModel::updateText,
                placeholder = { Text("输入新任务...", color = TextMuted, fontSize = 14.sp) },
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
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        fontSize = 10.sp,
        color = TextMuted,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(start = 4.dp, bottom = 2.dp)
    )
}

@Composable
private fun TaskRow(
    task: TaskDto,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Surface)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // 左侧圆形复选框（20dp，已完成时背景 Agent）
        Box(
            modifier = Modifier
                .size(20.dp)
                .clip(CircleShape)
                .background(if (task.completed) Agent else Color.Transparent)
                .border(1.dp, BorderHover, CircleShape)
                .clickable { onToggle() },
            contentAlignment = Alignment.Center
        ) {
            if (task.completed) {
                Text(
                    text = "✓",
                    color = Void,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
        Spacer(modifier = Modifier.width(10.dp))
        // 中间内容（已完成加删除线 + 更暗文字）
        Text(
            text = task.content,
            color = if (task.completed) TextMuted else TextPrimary,
            fontSize = 14.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None,
            modifier = Modifier.weight(1f)
        )
        Spacer(modifier = Modifier.width(8.dp))
        // 右侧相对时间
        if (!task.createdAt.isNullOrBlank()) {
            Text(
                text = formatRelativeTime(task.createdAt),
                color = TextMuted,
                fontSize = 11.sp
            )
        }
    }
}

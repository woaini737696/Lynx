package com.lynnhub.app.ui.screen.focus

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.FocusPatchRequest
import com.lynnhub.app.data.remote.dto.FocusTaskDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FocusUiState(
    val tasks: List<FocusTaskDto> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
) {
    val totalCount: Int get() = tasks.size
    val completedCount: Int get() = tasks.count { it.completed }
    val progress: Float get() = if (totalCount == 0) 0f else completedCount.toFloat() / totalCount
}

@HiltViewModel
class FocusViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(FocusUiState())
    val uiState: StateFlow<FocusUiState> = _uiState.asStateFlow()

    init { loadFocus() }

    fun loadFocus() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val response = apiService.getFocus()
                val tasks = response.dailyFocus?.items?.map { item ->
                    FocusTaskDto(
                        id = item.id,
                        content = item.task.content,
                        completed = item.completed,
                        column = item.task.column,
                        position = item.position
                    )
                } ?: emptyList()
                _uiState.value = FocusUiState(tasks = tasks)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "加载失败"
                )
            }
        }
    }

    fun toggleTask(task: FocusTaskDto) {
        val newCompleted = !task.completed
        _uiState.value = _uiState.value.copy(
            tasks = _uiState.value.tasks.toMutableList().apply {
                val index = indexOfFirst { it.id == task.id }
                if (index >= 0) this[index] = this[index].copy(completed = newCompleted)
            }
        )
        viewModelScope.launch {
            try {
                apiService.patchFocus(FocusPatchRequest(itemId = task.id, completed = newCompleted))
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    tasks = _uiState.value.tasks.toMutableList().apply {
                        val index = indexOfFirst { it.id == task.id }
                        if (index >= 0) this[index] = this[index].copy(completed = !newCompleted)
                    },
                    error = "操作失败"
                )
            }
        }
    }

    fun addTask(content: String) {
        // 后端 focus 模块无 POST 端点（focus 由系统自动生成）
        // 这里仅做本地展示，避免调用不存在的 API 导致错误
        val tempId = "local-${System.currentTimeMillis()}"
        val newTask = FocusTaskDto(id = tempId, content = content, completed = false)
        _uiState.value = _uiState.value.copy(
            tasks = listOf(newTask) + _uiState.value.tasks
        )
    }

    fun deleteTask(task: FocusTaskDto) {
        // 后端 focus 模块无 DELETE 端点，退出动画后仅做本地移除
        // （任务本身的完成状态已通过 toggleTask -> patchFocus 更新到后端）
        _uiState.value = _uiState.value.copy(
            tasks = _uiState.value.tasks.filterNot { it.id == task.id }
        )
    }
}

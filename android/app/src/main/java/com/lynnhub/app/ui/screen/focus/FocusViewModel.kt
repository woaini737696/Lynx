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
                _uiState.value = FocusUiState(tasks = response.tasks)
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
            tasks = _uiState.value.tasks.map {
                if (it.id == task.id) it.copy(completed = newCompleted) else it
            }
        )
        viewModelScope.launch {
            try {
                apiService.patchFocus(task.id, FocusPatchRequest(completed = newCompleted))
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    tasks = _uiState.value.tasks.map {
                        if (it.id == task.id) it.copy(completed = !newCompleted) else it
                    },
                    error = "操作失败"
                )
            }
        }
    }

    fun addTask(content: String) {
        val tempId = System.currentTimeMillis().toString()
        val newTask = FocusTaskDto(id = tempId, content = content, completed = false)
        _uiState.value = _uiState.value.copy(
            tasks = listOf(newTask) + _uiState.value.tasks
        )
        viewModelScope.launch {
            try {
                val response = apiService.createFocus(mapOf("content" to content))
                _uiState.value = _uiState.value.copy(
                    tasks = _uiState.value.tasks.map {
                        if (it.id == tempId) response else it
                    }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    tasks = _uiState.value.tasks.filterNot { it.id == tempId },
                    error = "添加失败"
                )
            }
        }
    }

    fun deleteTask(task: FocusTaskDto) {
        _uiState.value = _uiState.value.copy(
            tasks = _uiState.value.tasks.filterNot { it.id == task.id }
        )
        viewModelScope.launch {
            try {
                apiService.deleteFocus(task.id)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    tasks = listOf(task) + _uiState.value.tasks,
                    error = "删除失败"
                )
            }
        }
    }
}

package com.lynnhub.app.ui.screen.board

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.TaskCreateRequest
import com.lynnhub.app.data.remote.dto.TaskDto
import com.lynnhub.app.data.remote.dto.TaskPatchRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class BoardColumn(
    val key: String,
    val title: String,
    val subtitle: String,
    val limit: Int,
    val color: Long
) {
    companion object {
        val NORTHSTAR = BoardColumn("northstar", "北极星", "长期目标", 3, 0xFF8B5CF6)
        val CAMPAIGN = BoardColumn("campaign", "战役", "中期战役", 5, 0xFF3B82F6)
        val TASK = BoardColumn("task", "任务", "执行任务", 10, 0xFFF59E0B)

        val ALL = listOf(NORTHSTAR, CAMPAIGN, TASK)
    }
}

data class BoardUiState(
    val tasks: List<TaskDto> = emptyList(),
    val currentColumn: Int = 0,
    val isLoading: Boolean = false,
    val error: String? = null,
    val showAddDialog: Boolean = false,
    val showEditDialog: Boolean = false,
    val editingTask: TaskDto? = null
) {
    fun tasksForColumn(column: String): List<TaskDto> =
        tasks.filter { it.column == column && it.status == "active" }
            .sortedBy { it.position }

    fun activeCount(column: String): Int = tasksForColumn(column).size

    fun fillPercent(column: String): Float {
        val col = BoardColumn.ALL.find { it.key == column } ?: return 0f
        return (activeCount(column).toFloat() / col.limit).coerceIn(0f, 1f)
    }
}

@HiltViewModel
class BoardViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(BoardUiState())
    val uiState: StateFlow<BoardUiState> = _uiState.asStateFlow()

    init { loadTasks() }

    fun loadTasks() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val tasks = apiService.getTasks()
                _uiState.value = _uiState.value.copy(tasks = tasks, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "加载失败"
                )
            }
        }
    }

    fun switchColumn(index: Int) {
        _uiState.value = _uiState.value.copy(currentColumn = index)
    }

    fun showAddDialog() {
        _uiState.value = _uiState.value.copy(showAddDialog = true)
    }

    fun hideAddDialog() {
        _uiState.value = _uiState.value.copy(showAddDialog = false)
    }

    fun showEditDialog(task: TaskDto) {
        _uiState.value = _uiState.value.copy(showEditDialog = true, editingTask = task)
    }

    fun hideEditDialog() {
        _uiState.value = _uiState.value.copy(showEditDialog = false, editingTask = null)
    }

    fun addTask(content: String, column: String) {
        viewModelScope.launch {
            try {
                val newTask = apiService.createTask(TaskCreateRequest(content = content, column = column))
                _uiState.value = _uiState.value.copy(
                    tasks = _uiState.value.tasks + newTask,
                    showAddDialog = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "添加失败: ${e.message}")
            }
        }
    }

    fun updateTask(id: String, content: String) {
        viewModelScope.launch {
            try {
                val updated = apiService.patchTask(id, TaskPatchRequest(content = content))
                _uiState.value = _uiState.value.copy(
                    tasks = _uiState.value.tasks.map { if (it.id == id) updated else it },
                    showEditDialog = false,
                    editingTask = null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "编辑失败: ${e.message}")
            }
        }
    }

    fun completeTask(task: TaskDto) {
        viewModelScope.launch {
            try {
                apiService.patchTask(task.id, TaskPatchRequest(status = "done"))
                _uiState.value = _uiState.value.copy(
                    tasks = _uiState.value.tasks.filter { it.id != task.id }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "完成失败: ${e.message}")
            }
        }
    }

    fun deleteTask(task: TaskDto) {
        viewModelScope.launch {
            try {
                apiService.deleteTask(task.id)
                _uiState.value = _uiState.value.copy(
                    tasks = _uiState.value.tasks.filter { it.id != task.id }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "删除失败: ${e.message}")
            }
        }
    }

    /** 拖拽排序：交换两个任务的位置 */
    fun moveTask(fromIndex: Int, toIndex: Int, column: String) {
        val columnTasks = _uiState.value.tasksForColumn(column).toMutableList()
        if (fromIndex !in columnTasks.indices || toIndex !in columnTasks.indices) return

        val item = columnTasks.removeAt(fromIndex)
        columnTasks.add(toIndex, item)

        // 更新 UI 中的 position
        val newPositions = columnTasks.mapIndexed { index, t -> t.id to index }.toMap()
        val updatedTasks = _uiState.value.tasks.map { t ->
            if (newPositions.containsKey(t.id)) {
                t.copy(position = newPositions[t.id]!!)
            } else t
        }
        _uiState.value = _uiState.value.copy(tasks = updatedTasks)

        // 同步到后端
        viewModelScope.launch {
            try {
                columnTasks.forEachIndexed { index, t ->
                    apiService.patchTask(t.id, TaskPatchRequest(position = index))
                }
            } catch (_: Exception) { }
        }
    }

    /** 跨列移动 */
    fun moveTaskToColumn(taskId: String, targetColumn: String) {
        viewModelScope.launch {
            try {
                apiService.patchTask(taskId, TaskPatchRequest(column = targetColumn))
                loadTasks()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "移动失败: ${e.message}")
            }
        }
    }
}

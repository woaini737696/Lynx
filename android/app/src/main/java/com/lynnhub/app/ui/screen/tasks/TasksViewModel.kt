package com.lynnhub.app.ui.screen.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.LarkTaskDto
import com.lynnhub.app.data.remote.dto.LarkTaskCreateRequest
import com.lynnhub.app.data.remote.dto.LarkTaskToggleRequest
import com.lynnhub.app.data.remote.dto.SyncStateDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 飞书任务列表 UI 状态
 */
data class TasksUiState(
    val tasks: List<LarkTaskDto> = emptyList(),
    val syncState: SyncStateDto? = null,
    val isLoading: Boolean = false,
    val isSyncing: Boolean = false,
    val isSubmitting: Boolean = false,
    val filter: TasksFilter = TasksFilter.ACTIVE,
    val toast: String? = null
)

enum class TasksFilter { ACTIVE, DONE }

@HiltViewModel
class TasksViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(TasksUiState(isLoading = true))
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    init {
        // 先从缓存读取（无感加载）
        viewModelScope.launch {
            val cached: Pair<TasksUiState, Boolean>? =
                com.lynnhub.app.util.PageCacheManager.get(
                    com.lynnhub.app.util.CacheKeys.TASKS
                )
            if (cached != null) {
                _uiState.value = cached.first.copy(isLoading = false)
            }
        }
        loadAll()
    }

    fun loadAll() {
        if (_uiState.value.tasks.isEmpty()) {
            _uiState.update { it.copy(isLoading = true) }
        }
        viewModelScope.launch {
            try {
                val resp = apiService.getLarkTasks(view = "my", dbOnly = true)
                _uiState.update {
                    it.copy(tasks = resp.tasks, isLoading = false)
                }
                // 存入缓存
                com.lynnhub.app.util.PageCacheManager.put(
                    com.lynnhub.app.util.CacheKeys.TASKS,
                    _uiState.value
                )
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, toast = "加载失败: ${e.message ?: "网络错误"}")
                }
            }
        }
        refreshSyncState()
    }

    /**
     * 触发一次飞书任务同步。
     *
     * 移动端不直接调用 lark-cli（服务器无飞书凭证）。
     * 飞书任务通过 Web 端/桌面端同步到服务器数据库，移动端仅读取数据库。
     * 此方法刷新数据库读取 + 同步状态，并提示用户在 Web 端/桌面端同步。
     */
    fun triggerSync() {
        _uiState.update { it.copy(isSyncing = true) }
        viewModelScope.launch {
            try {
                // 仅刷新数据库读取 + 同步状态
                val resp = apiService.getLarkTasks(view = "my", dbOnly = true)
                val syncResp = apiService.getSyncState()
                _uiState.update {
                    it.copy(
                        isSyncing = false,
                        tasks = resp.tasks,
                        syncState = syncResp.state,
                        toast = "已刷新数据库。飞书任务请在 Web 端/桌面端同步"
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isSyncing = false, toast = "刷新失败: ${e.message ?: "网络错误"}")
                }
            }
        }
    }

    fun refreshSyncState() {
        viewModelScope.launch {
            try {
                val resp = apiService.getSyncState()
                _uiState.update { it.copy(syncState = resp.state) }
            } catch (_: Exception) {
                // 静默失败
            }
        }
    }

    fun setFilter(filter: TasksFilter) {
        _uiState.update { it.copy(filter = filter) }
    }

    /**
     * 创建飞书任务（可下发到成员）
     * @param summary 任务标题
     * @param assignees 负责人姓名列表（飞书用户名，后端解析为 user_id）
     * @param due 截止时间 ISO 字符串
     * @param description 任务描述
     */
    fun createLarkTask(
        summary: String,
        assignees: List<String> = emptyList(),
        due: String? = null,
        description: String? = null
    ) {
        if (summary.isBlank()) return
        if (_uiState.value.isSubmitting) return
        _uiState.update { it.copy(isSubmitting = true) }
        viewModelScope.launch {
            try {
                val resp = apiService.createLarkTask(
                    LarkTaskCreateRequest(
                        summary = summary.trim(),
                        assignees = assignees.filter { it.isNotBlank() },
                        due = due,
                        description = description?.trim()?.ifBlank { null }
                    )
                )
                if (resp.error != null) {
                    _uiState.update {
                        it.copy(isSubmitting = false, toast = "创建失败: ${resp.error}")
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            toast = if (assignees.isEmpty()) "飞书任务已创建" else "任务已下发到 ${assignees.joinToString("、")}"
                        )
                    }
                    loadAll()
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isSubmitting = false, toast = "创建失败: ${e.message ?: "网络错误"}")
                }
            }
        }
    }

    /** 切换飞书任务完成状态 */
    fun toggleTask(task: LarkTaskDto) {
        val previous = _uiState.value.tasks
        // 乐观更新
        _uiState.update { s ->
            s.copy(
                tasks = s.tasks.map {
                    if (it.guid == task.guid) it.copy(completed = !it.completed) else it
                }
            )
        }
        viewModelScope.launch {
            try {
                val action = if (task.completed) "reopen" else "complete"
                apiService.toggleLarkTask(task.guid, LarkTaskToggleRequest(action = action))
            } catch (_: Exception) {
                // 回滚
                _uiState.update { it.copy(tasks = previous) }
            }
        }
    }

    fun clearToast() {
        _uiState.update { it.copy(toast = null) }
    }
}

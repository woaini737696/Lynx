package com.lynnhub.app.ui.screen.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.LarkTaskDto
import com.lynnhub.app.data.remote.dto.LarkTaskToggleRequest
import com.lynnhub.app.data.remote.dto.LarkTasksResponse
import com.lynnhub.app.data.remote.dto.SyncStateDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import javax.inject.Inject

/** 任务分类 Tab：进行中 / 已完成 / 全部 */
enum class TaskTab(val label: String, val completed: Boolean?) {
    IN_PROGRESS("进行中", false),
    COMPLETED("已完成", true),
    ALL("全部", null)
}

data class TasksUiState(
    val tasks: List<LarkTaskDto> = emptyList(),
    val selectedTab: TaskTab = TaskTab.IN_PROGRESS,
    val syncState: SyncStateDto? = null,
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val isSyncing: Boolean = false,
    val isOffline: Boolean = false,
    val error: String? = null,
    val selectedTask: LarkTaskDto? = null,
    val isLoadingDetail: Boolean = false,
    val togglingTaskGuid: String? = null
)

@HiltViewModel
class TasksViewModel @Inject constructor(
    private val apiService: ApiService,
    private val userPreferences: UserPreferences,
    private val json: Json
) : ViewModel() {

    private val _uiState = MutableStateFlow(TasksUiState())
    val uiState: StateFlow<TasksUiState> = _uiState.asStateFlow()

    /** 上次加载时间，用于页面可见时节流 */
    private var lastLoadTime = 0L

    /** 页面可见时调用，5 秒内不重复请求 */
    fun onVisible() {
        val now = System.currentTimeMillis()
        if (now - lastLoadTime > THROTTLE_MS) {
            viewModelScope.launch {
                loadTasksInternal(force = false)
                loadSyncState()
            }
        }
    }

    fun selectTab(tab: TaskTab) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    /** 下拉刷新：刷新任务 + 同步状态 */
    fun refresh() {
        if (_uiState.value.isRefreshing) return
        _uiState.update { it.copy(isRefreshing = true) }
        viewModelScope.launch {
            loadSyncState()
            loadTasksInternal(force = true)
            _uiState.update { it.copy(isRefreshing = false) }
        }
    }

    /** 手动同步：成功后刷新任务列表 */
    fun triggerSync() {
        if (_uiState.value.isSyncing) return
        _uiState.update { it.copy(isSyncing = true, error = null) }
        viewModelScope.launch {
            try {
                val resp = apiService.triggerSync()
                _uiState.update { it.copy(syncState = resp.state, isSyncing = false) }
                if (resp.success) {
                    loadTasksInternal(force = true)
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isSyncing = false, error = "同步失败：${e.message}")
                }
            }
        }
    }

    /** 选中任务，弹出详情并拉取最新详情 */
    fun selectTask(task: LarkTaskDto) {
        _uiState.update { it.copy(selectedTask = task, isLoadingDetail = true) }
        viewModelScope.launch {
            try {
                val resp = apiService.getLarkTask(task.guid)
                _uiState.update { s ->
                    s.copy(
                        selectedTask = resp.task,
                        isLoadingDetail = false,
                        tasks = s.tasks.map { if (it.guid == resp.task.guid) resp.task else it }
                    )
                }
            } catch (_: Exception) {
                _uiState.update { it.copy(isLoadingDetail = false) }
            }
        }
    }

    fun clearSelectedTask() {
        _uiState.update { it.copy(selectedTask = null, isLoadingDetail = false) }
    }

    /** 完成 / 重开切换：乐观更新 + 失败回滚 */
    fun toggleTask(task: LarkTaskDto) {
        if (_uiState.value.togglingTaskGuid == task.guid) return
        val newCompleted = !task.completed
        val snapshot = _uiState.value.tasks
        _uiState.update {
            it.copy(
                tasks = snapshot.map { t ->
                    if (t.guid == task.guid) t.copy(completed = newCompleted) else t
                },
                selectedTask = it.selectedTask?.let { st ->
                    if (st.guid == task.guid) st.copy(completed = newCompleted) else st
                },
                togglingTaskGuid = task.guid
            )
        }
        viewModelScope.launch {
            try {
                apiService.toggleLarkTask(task.guid, LarkTaskToggleRequest(complete = newCompleted))
            } catch (e: Exception) {
                // 回滚
                _uiState.update { s ->
                    s.copy(
                        tasks = s.tasks.map { t ->
                            if (t.guid == task.guid) t.copy(completed = task.completed) else t
                        },
                        selectedTask = s.selectedTask?.let { st ->
                            if (st.guid == task.guid) st.copy(completed = task.completed) else st
                        },
                        error = "操作失败：${e.message}"
                    )
                }
            } finally {
                _uiState.update { it.copy(togglingTaskGuid = null) }
            }
        }
    }

    private suspend fun loadTasksInternal(force: Boolean) {
        val now = System.currentTimeMillis()
        if (!force && now - lastLoadTime < THROTTLE_MS) return
        lastLoadTime = System.currentTimeMillis()
        _uiState.update { it.copy(isLoading = it.tasks.isEmpty(), error = null) }
        try {
            val resp = apiService.getLarkTasks(view = "my", complete = null)
            _uiState.update {
                it.copy(tasks = resp.tasks, isLoading = false, isOffline = false)
            }
            runCatching {
                json.encodeToString(LarkTasksResponse.serializer(), resp)
            }.onSuccess { cache -> userPreferences.saveTasksCache(cache) }
        } catch (e: Exception) {
            val cache = userPreferences.getTasksCache()
            if (!cache.isNullOrBlank()) {
                val cached = runCatching {
                    json.decodeFromString(LarkTasksResponse.serializer(), cache)
                }.getOrNull()
                _uiState.update {
                    it.copy(
                        tasks = cached?.tasks ?: emptyList(),
                        isLoading = false,
                        isOffline = true
                    )
                }
            } else {
                _uiState.update {
                    it.copy(isLoading = false, isOffline = true, error = "网络错误：${e.message}")
                }
            }
        }
    }

    private suspend fun loadSyncState() {
        try {
            val resp = apiService.getSyncState()
            _uiState.update { it.copy(syncState = resp.state) }
        } catch (_: Exception) {
        }
    }

    companion object {
        private const val THROTTLE_MS = 5000L
    }
}

package com.lynnhub.app.ui.screen.memory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.MemoryNodeDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 记忆节点类型 Tab
 * 对应 uniapp memory.vue 的分类：全部 / 灵感 / 对话 / 认知
 */
enum class MemoryTab(val label: String, val type: String?) {
    ALL("全部", null),
    IDEA("灵感", "idea"),
    CONVERSATION("对话", "conversation"),
    COGNITION("认知", "cognition")
}

/**
 * 记忆认知 UI 状态
 */
data class MemoryUiState(
    val nodes: List<MemoryNodeDto> = emptyList(),
    val searchResults: List<MemoryNodeDto> = emptyList(),
    val searchQuery: String = "",
    val isSearching: Boolean = false,
    val selectedTab: MemoryTab = MemoryTab.ALL,
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null
) {
    /** 是否处于搜索态（有查询关键词） */
    val inSearchMode: Boolean get() = searchQuery.isNotBlank()

    /** 当前展示的列表：搜索态展示搜索结果，否则展示全量节点。
     *  用 by lazy 缓存，每个 UiState 实例只计算一次 filter + sort，
     *  避免每次重组/读取都重新计算（等价于 derivedStateOf 的缓存语义）。 */
    val displayList: List<MemoryNodeDto> by lazy {
        val source = if (inSearchMode) searchResults else nodes
        val type = selectedTab.type
        val filtered = if (type == null) source else source.filter { it.type == type }
        if (inSearchMode) {
            // 搜索结果按相似度分数倒序
            filtered.sortedByDescending { it.score ?: 0.0 }
        } else {
            // 全量节点按创建时间倒序
            filtered.sortedByDescending { it.createdAt }
        }
    }
}

@HiltViewModel
class MemoryViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(MemoryUiState())
    val uiState: StateFlow<MemoryUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    init {
        loadMemory()
    }

    /** 加载全部记忆节点 */
    fun loadMemory() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = it.nodes.isEmpty(), error = null) }
            try {
                val response = apiService.getMemory()
                _uiState.update {
                    it.copy(
                        nodes = response.nodes,
                        isLoading = false,
                        isRefreshing = false
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        error = e.message ?: "加载失败"
                    )
                }
            }
        }
    }

    /** 下拉刷新：刷新全量节点，并保留当前搜索态 */
    fun refresh() {
        _uiState.update { it.copy(isRefreshing = true) }
        loadMemory()
        val q = _uiState.value.searchQuery
        if (q.isNotBlank()) {
            searchJob?.cancel()
            searchJob = viewModelScope.launch {
                delay(350)
                performSearch(q)
            }
        }
    }

    /** 切换类型 Tab */
    fun selectTab(tab: MemoryTab) {
        _uiState.update { it.copy(selectedTab = tab) }
    }

    /** 搜索框输入变化：防抖触发语义搜索 */
    fun updateQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        searchJob?.cancel()
        if (query.isBlank()) {
            _uiState.update { it.copy(searchResults = emptyList(), isSearching = false) }
            return
        }
        searchJob = viewModelScope.launch {
            delay(350)
            performSearch(query.trim())
        }
    }

    /** 清空搜索 */
    fun clearSearch() {
        searchJob?.cancel()
        _uiState.update {
            it.copy(searchQuery = "", searchResults = emptyList(), isSearching = false)
        }
    }

    private suspend fun performSearch(query: String) {
        _uiState.update { it.copy(isSearching = true, error = null) }
        try {
            val response = apiService.searchMemory(query)
            val sorted = response.results
                .sortedByDescending { it.score }
                .map { item ->
                    MemoryNodeDto(
                        id = item.id,
                        label = item.label,
                        type = item.type,
                        strength = 0.0,
                        fullContent = item.label,
                        score = item.score,
                        createdAt = ""
                    )
                }
            _uiState.update { it.copy(searchResults = sorted, isSearching = false) }
        } catch (e: Exception) {
            _uiState.update {
                it.copy(isSearching = false, error = e.message ?: "搜索失败")
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

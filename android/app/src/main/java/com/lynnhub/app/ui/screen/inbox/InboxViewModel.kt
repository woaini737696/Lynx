package com.lynnhub.app.ui.screen.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.IdeaActionRequest
import com.lynnhub.app.data.remote.dto.IdeaCreateRequest
import com.lynnhub.app.data.remote.dto.IdeaDeleteRequest
import com.lynnhub.app.data.remote.dto.IdeaDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 灵感收件箱 UI 状态
 */
data class InboxUiState(
    val ideas: List<IdeaDto> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val isMultiSelectMode: Boolean = false,
    val selectedIds: Set<String> = emptySet(),
    val showInputSheet: Boolean = false,
    val showActionSheetFor: IdeaDto? = null,
    val previewImageUrl: String? = null
)

@HiltViewModel
class InboxViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(InboxUiState())
    val uiState: StateFlow<InboxUiState> = _uiState.asStateFlow()

    init {
        loadIdeas()
    }

    /** 加载灵感列表，仅展示 inbox 状态，按 createdAt 倒序 */
    fun loadIdeas() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = it.ideas.isEmpty(), error = null) }
            try {
                val response = apiService.getIdeas()
                val inboxIdeas = response.ideas
                    .filter { it.status == "inbox" }
                    .sortedByDescending { it.createdAt }
                _uiState.update {
                    it.copy(
                        ideas = inboxIdeas,
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

    /** 下拉刷新 */
    fun refresh() {
        _uiState.update { it.copy(isRefreshing = true) }
        loadIdeas()
    }

    // ============ 闪电输入 ============

    fun showInputSheet() {
        _uiState.update { it.copy(showInputSheet = true) }
    }

    fun hideInputSheet() {
        _uiState.update { it.copy(showInputSheet = false) }
    }

    /** 创建灵感（闪电输入） */
    fun createIdea(content: String) {
        if (content.isBlank()) return
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, error = null) }
            try {
                apiService.createIdea(
                    IdeaCreateRequest(
                        content = content.trim(),
                        source = "lightning",
                        status = "inbox"
                    )
                )
                _uiState.update {
                    it.copy(isSubmitting = false, showInputSheet = false)
                }
                loadIdeas()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        error = e.message ?: "创建失败"
                    )
                }
            }
        }
    }

    // ============ 单条操作 ActionSheet ============

    fun showActionSheet(idea: IdeaDto) {
        _uiState.update { it.copy(showActionSheetFor = idea) }
    }

    fun hideActionSheet() {
        _uiState.update { it.copy(showActionSheetFor = null) }
    }

    /** 移入看板 */
    fun moveToBoard(idea: IdeaDto) {
        viewModelScope.launch {
            try {
                apiService.patchIdea(idea.id, IdeaActionRequest(action = "board"))
                hideActionSheet()
                loadIdeas()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "操作失败") }
            }
        }
    }

    /** 放弃入墓地 */
    fun abandon(idea: IdeaDto) {
        viewModelScope.launch {
            try {
                apiService.patchIdea(idea.id, IdeaActionRequest(action = "abandon"))
                hideActionSheet()
                loadIdeas()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "操作失败") }
            }
        }
    }

    /** 单条删除 */
    fun deleteIdea(idea: IdeaDto) {
        viewModelScope.launch {
            try {
                apiService.deleteIdeas(IdeaDeleteRequest(ids = listOf(idea.id)))
                hideActionSheet()
                loadIdeas()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "删除失败") }
            }
        }
    }

    // ============ 批量多选 ============

    /** 进入多选模式，不预选任何项 */
    fun enterMultiSelectMode() {
        _uiState.update {
            it.copy(
                isMultiSelectMode = true,
                selectedIds = emptySet(),
                showActionSheetFor = null
            )
        }
    }

    /** 长按进入多选模式，并预选当前卡片 */
    fun enterMultiSelectMode(id: String) {
        _uiState.update {
            it.copy(
                isMultiSelectMode = true,
                selectedIds = setOf(id),
                showActionSheetFor = null
            )
        }
    }

    fun toggleSelection(id: String) {
        _uiState.update { current ->
            val newSelection = if (id in current.selectedIds) {
                current.selectedIds - id
            } else {
                current.selectedIds + id
            }
            current.copy(selectedIds = newSelection)
        }
    }

    fun selectAll() {
        _uiState.update {
            it.copy(selectedIds = it.ideas.map { idea -> idea.id }.toSet())
        }
    }

    fun exitMultiSelectMode() {
        _uiState.update {
            it.copy(isMultiSelectMode = false, selectedIds = emptySet())
        }
    }

    /** 批量删除选中灵感 */
    fun deleteSelected() {
        val ids = _uiState.value.selectedIds.toList()
        if (ids.isEmpty()) return
        viewModelScope.launch {
            try {
                apiService.deleteIdeas(IdeaDeleteRequest(ids = ids))
                _uiState.update {
                    it.copy(isMultiSelectMode = false, selectedIds = emptySet())
                }
                loadIdeas()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "删除失败") }
            }
        }
    }

    // ============ 图片预览 ============

    fun previewImage(url: String?) {
        _uiState.update { it.copy(previewImageUrl = url) }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}

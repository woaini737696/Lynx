package com.lynnhub.app.ui.component

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.IdeaCreateRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 闪电输入条 UI 状态
 */
data class CaptureBarUiState(
    val isExpanded: Boolean = false,
    val text: String = "",
    val isSubmitting: Boolean = false,
    val successMessage: String? = null,
    val error: String? = null
)

@HiltViewModel
class CaptureBarViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(CaptureBarUiState())
    val uiState: StateFlow<CaptureBarUiState> = _uiState.asStateFlow()

    fun expand() {
        _uiState.update { it.copy(isExpanded = true, error = null) }
    }

    fun collapse() {
        _uiState.update { it.copy(isExpanded = false, text = "", error = null) }
    }

    fun onTextChanged(value: String) {
        _uiState.update { it.copy(text = value) }
    }

    fun clearMessage() {
        _uiState.update { it.copy(successMessage = null, error = null) }
    }

    /** 提交灵感到收件箱 */
    fun submit() {
        val content = _uiState.value.text
        if (content.isBlank() || _uiState.value.isSubmitting) return
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, error = null) }
            try {
                apiService.createIdea(IdeaCreateRequest(content = content.trim(), source = "lightning", status = "inbox"))
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        text = "",
                        isExpanded = false,
                        successMessage = "已捕获灵感"
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        error = e.message ?: "提交失败"
                    )
                }
            }
        }
    }
}

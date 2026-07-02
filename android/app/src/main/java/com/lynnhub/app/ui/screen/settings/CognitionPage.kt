package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.CognitionDto
import com.lynnhub.app.ui.theme.BorderHover
import com.lynnhub.app.ui.theme.BorderSubtle
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.Surface
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** 5. 认知库 */
data class CognitionUiState(
    val cognitions: List<CognitionDto> = emptyList(),
    val category: String = "method",  // method | experience | prompt
    val query: String = "",
    val isLoading: Boolean = false,
    val toast: String = ""
)

@HiltViewModel
class CognitionViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {
    private val _uiState = MutableStateFlow(CognitionUiState())
    val uiState: StateFlow<CognitionUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            try {
                val resp = apiService.getCognitions()
                _uiState.value = _uiState.value.copy(
                    cognitions = resp.cognitions,
                    isLoading = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    toast = "加载失败: ${e.message}"
                )
            }
        }
    }

    fun setCategory(category: String) {
        _uiState.value = _uiState.value.copy(category = category)
    }

    fun setQuery(q: String) {
        _uiState.value = _uiState.value.copy(query = q)
    }

    fun clearToast() {
        _uiState.value = _uiState.value.copy(toast = "")
    }
}

@Composable
fun CognitionPage(onBack: () -> Unit, viewModel: CognitionViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val categories = listOf("method" to "方法", "experience" to "经验", "prompt" to "提示词")

    val filtered = uiState.cognitions
        .filter { it.type == uiState.category }
        .filter { uiState.query.isBlank() || it.content.contains(uiState.query, ignoreCase = true) }

    SubPageScaffold(title = "认知库", onBack = onBack) {
        // 分类胶囊
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(999.dp))
                .background(Surface)
                .border(1.dp, BorderHover, RoundedCornerShape(999.dp))
                .padding(4.dp)
        ) {
            categories.forEach { (key, label) ->
                val selected = uiState.category == key
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (selected) Primary else Color.Transparent)
                        .clickable { viewModel.setCategory(key) }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        label,
                        color = if (selected) TextPrimary else TextMuted,
                        fontSize = 12.sp,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 搜索框
        TextField(
            value = uiState.query,
            onValueChange = viewModel::setQuery,
            placeholder = "搜索...",
            trailing = {
                Icon(Icons.Filled.Search, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (uiState.isLoading) {
            Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
            }
        }

        // 列表
        filtered.forEach { cog ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Surface)
                    .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Text(
                    cog.content.take(60).let { if (cog.content.length > 60) "$it..." else it },
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    cog.createdAt.take(10),
                    color = TextMuted,
                    fontSize = 10.sp
                )
            }
        }

        if (filtered.isEmpty() && !uiState.isLoading) {
            Box(
                Modifier.fillMaxWidth().padding(40.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("暂无内容", color = TextMuted, fontSize = 12.sp)
            }
        }

        ToastMessage(uiState.toast)
    }
}

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
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
import com.lynnhub.app.data.remote.dto.MemoryNodeDto
import com.lynnhub.app.data.remote.dto.MemorySearchResponse
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.Surface
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import com.lynnhub.app.ui.theme.Think
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** 4. 记忆图谱 */
data class MemoryUiState(
    val nodes: List<MemoryNodeDto> = emptyList(),
    val query: String = "",
    val isSearching: Boolean = false,
    val isLoading: Boolean = false,
    val expandedId: String? = null,
    val toast: String = ""
)

@HiltViewModel
class MemoryViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {
    private val _uiState = MutableStateFlow(MemoryUiState())
    val uiState: StateFlow<MemoryUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            try {
                val resp = apiService.getMemory()
                _uiState.value = _uiState.value.copy(
                    nodes = resp.nodes,
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

    fun search(q: String) {
        _uiState.value = _uiState.value.copy(query = q, isSearching = true)
        viewModelScope.launch {
            try {
                val resp = if (q.isBlank()) {
                    apiService.getMemory().let { MemorySearchResponse() }
                } else {
                    apiService.searchMemory(q)
                }
                val nodes = if (q.isBlank()) {
                    apiService.getMemory().nodes
                } else {
                    resp.results.mapIndexed { i, r ->
                        MemoryNodeDto(
                            id = r.id,
                            label = r.label,
                            type = r.type,
                            color = null,
                            strength = r.score,
                            connections = emptyList(),
                            fullContent = r.source,
                            score = r.score,
                            createdAt = ""
                        )
                    }
                }
                _uiState.value = _uiState.value.copy(
                    nodes = nodes,
                    isSearching = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isSearching = false,
                    toast = "搜索失败: ${e.message}"
                )
            }
        }
    }

    fun toggleExpand(id: String) {
        _uiState.value = _uiState.value.copy(
            expandedId = if (_uiState.value.expandedId == id) null else id
        )
    }

    fun clearToast() {
        _uiState.value = _uiState.value.copy(toast = "")
    }
}

private fun typeColor(type: String): Color = when (type) {
    "idea" -> Primary
    "task" -> Agent
    "cognition" -> Think
    "conversation" -> TextMuted
    else -> Primary
}

private fun typeLabel(type: String): String = when (type) {
    "idea" -> "灵感"
    "task" -> "任务"
    "cognition" -> "认知"
    "conversation" -> "对话"
    else -> type
}

@Composable
fun MemoryPage(onBack: () -> Unit, viewModel: MemoryViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    SubPageScaffold(title = "记忆图谱", onBack = onBack) {
        // 搜索框
        TextField(
            value = uiState.query,
            onValueChange = viewModel::search,
            placeholder = "搜索记忆...",
            trailing = {
                if (uiState.isSearching) {
                    CircularProgressIndicator(
                        color = Primary,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(16.dp)
                    )
                } else {
                    Icon(Icons.Filled.Search, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
                }
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (uiState.isLoading) {
            Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
            }
        }

        // 节点列表
        uiState.nodes.forEach { node ->
            val expanded = uiState.expandedId == node.id
            val color = typeColor(node.type)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Surface)
                    .border(1.dp, color.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                    .clickable { viewModel.toggleExpand(node.id) }
                    .padding(12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(color)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        node.label.ifBlank { "未命名" },
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        typeLabel(node.type),
                        color = color,
                        fontSize = 10.sp
                    )
                }
                if (expanded) {
                    Spacer(modifier = Modifier.height(8.dp))
                    if (node.fullContent.isNotBlank()) {
                        Text(
                            node.fullContent,
                            color = TextMuted,
                            fontSize = 11.sp,
                            lineHeight = 16.sp
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "关联: ${node.connections.size} · 强度: ${"%.2f".format(node.strength)}",
                        color = TextMuted,
                        fontSize = 10.sp
                    )
                }
            }
        }

        if (uiState.nodes.isEmpty() && !uiState.isLoading) {
            Box(
                Modifier.fillMaxWidth().padding(40.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    if (uiState.query.isBlank()) "暂无记忆" else "未找到相关记忆",
                    color = TextMuted,
                    fontSize = 12.sp
                )
            }
        }

        ToastMessage(uiState.toast)
    }
}

package com.lynnhub.app.ui.screen.memory

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.MemoryNodeDto
import com.lynnhub.app.data.remote.dto.MemorySearchResponse
import com.lynnhub.app.ui.component.CoreScreenHeader
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

// ============ 状态 ============
data class MemoryScreenUiState(
    val nodes: List<MemoryNodeDto> = emptyList(),
    val query: String = "",
    val isLoading: Boolean = false,
    val isSearching: Boolean = false,
    val expandedId: String? = null,
    val toast: String? = null,
    val category: String = "全部"
)

@HiltViewModel
class MemoryScreenViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(MemoryScreenUiState())
    val uiState: StateFlow<MemoryScreenUiState> = _uiState.asStateFlow()

    init {
        load()
    }

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

    fun updateQuery(q: String) {
        _uiState.value = _uiState.value.copy(query = q)
    }

    fun search() {
        val q = _uiState.value.query.trim()
        _uiState.value = _uiState.value.copy(isSearching = true)
        viewModelScope.launch {
            try {
                val nodes = if (q.isBlank()) {
                    apiService.getMemory().nodes
                } else {
                    apiService.searchMemory(q).results.mapIndexed { _, r ->
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
        _uiState.value = _uiState.value.copy(toast = null)
    }

    fun setCategory(category: String) {
        _uiState.value = _uiState.value.copy(category = category)
    }
}

// ============ 页面 ============
@Composable
fun MemoryScreen(
    onOpenSettings: () -> Unit,
    viewModel: MemoryScreenViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val userPreferences = remember { UserPreferences(context) }
    val user by userPreferences.userFlow.collectAsState(initial = null)
    val userName = user?.displayName?.ifBlank { null } ?: user?.username ?: "用户"

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp, vertical = 16.dp)
        ) {
            CoreScreenHeader(
                title = "记忆",
                userName = userName,
                onOpenSettings = onOpenSettings
            )

            Spacer(modifier = Modifier.height(16.dp))

            // 搜索框
            OutlinedTextField(
                value = uiState.query,
                onValueChange = viewModel::updateQuery,
                placeholder = { Text("搜索记忆...", color = TextMuted, fontSize = 14.sp) },
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Surface),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color.Transparent,
                    unfocusedBorderColor = Color.Transparent,
                    cursorColor = Primary
                ),
                singleLine = true,
                trailingIcon = {
                    if (uiState.isSearching) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Primary
                        )
                    } else {
                        Icon(
                            imageVector = LynxIcons.Search,
                            contentDescription = "搜索",
                            tint = Primary,
                            modifier = Modifier
                                .clip(CircleShape)
                                .clickable { viewModel.search() }
                                .padding(6.dp)
                        )
                    }
                }
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 分类标签
            MemoryCategoryChips(
                selected = uiState.category,
                onSelect = viewModel::setCategory
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 列表
            if (uiState.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Primary)
                }
            } else {
                val filteredNodes = if (uiState.category == "全部") {
                    uiState.nodes
                } else {
                    uiState.nodes.filter { memoryTypeLabel(it.type) == uiState.category }
                }

                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (filteredNodes.isEmpty()) {
                        item(key = "empty") {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 40.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = if (uiState.query.isBlank()) "暂无记忆" else "未找到相关记忆",
                                    color = TextMuted,
                                    fontSize = 13.sp
                                )
                            }
                        }
                    } else {
                        items(
                            items = filteredNodes,
                            key = { it.id }
                        ) { node ->
                            MemoryNodeCard(
                                node = node,
                                expanded = uiState.expandedId == node.id,
                                onToggle = { viewModel.toggleExpand(node.id) }
                            )
                        }
                    }
                }
            }
        }
    }

    // toast
    LaunchedEffect(uiState.toast) {
        uiState.toast?.let {
            kotlinx.coroutines.delay(1500)
            viewModel.clearToast()
        }
    }
}

@Composable
private fun MemoryNodeCard(
    node: MemoryNodeDto,
    expanded: Boolean,
    onToggle: () -> Unit
) {
    val color = memoryTypeColor(node.type)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Surface)
            .border(1.dp, color.copy(alpha = 0.15f), RoundedCornerShape(16.dp))
            .clickable { onToggle() }
            .padding(14.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(color)
            )
            Text(
                text = node.label.ifBlank { "未命名" },
                color = TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = memoryTypeLabel(node.type),
                color = color,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        if (expanded) {
            Spacer(modifier = Modifier.height(10.dp))
            if (node.fullContent.isNotBlank()) {
                Text(
                    text = node.fullContent,
                    color = TextMuted,
                    fontSize = 12.sp,
                    lineHeight = 18.sp
                )
                Spacer(modifier = Modifier.height(6.dp))
            }
            Text(
                text = "强度: ${"%.2f".format(node.strength)} · 关联 ${node.connections.size} 个节点",
                color = TextMuted,
                fontSize = 10.sp
            )
        }
    }
}

@Composable
private fun MemoryCategoryChips(
    selected: String,
    onSelect: (String) -> Unit
) {
    val categories = listOf("全部", "灵感", "任务", "认知", "对话")
    Row(
        modifier = Modifier.horizontalScroll(androidx.compose.foundation.rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        categories.forEach { category ->
            val isSelected = category == selected
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (isSelected) Primary.copy(alpha = 0.15f) else Surface)
                    .border(
                        1.dp,
                        if (isSelected) Primary.copy(alpha = 0.35f) else BorderSubtle,
                        RoundedCornerShape(999.dp)
                    )
                    .clickable { onSelect(category) }
                    .padding(horizontal = 14.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = category,
                    fontSize = 11.sp,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                    color = if (isSelected) Primary else TextMuted
                )
            }
        }
    }
}

private fun memoryTypeColor(type: String): Color = when (type.lowercase()) {
    "idea" -> Primary
    "task" -> Agent
    "cognition" -> Think
    "conversation" -> TextMuted
    else -> Primary
}

private fun memoryTypeLabel(type: String): String = when (type.lowercase()) {
    "idea" -> "灵感"
    "task" -> "任务"
    "cognition" -> "认知"
    "conversation" -> "对话"
    else -> type
}

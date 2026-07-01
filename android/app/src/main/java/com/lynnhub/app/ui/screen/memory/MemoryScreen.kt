package com.lynnhub.app.ui.screen.memory

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.MemoryEdgeDto
import com.lynnhub.app.data.remote.dto.MemoryNodeDto
import com.lynnhub.app.ui.component.CoreScreenHeader
import com.lynnhub.app.ui.component.FrostedGlassDialog
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.component.Pressable
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
    val edges: List<MemoryEdgeDto> = emptyList(),
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
        // 先从缓存读取（无感加载）
        viewModelScope.launch {
            val cached: Pair<MemoryScreenUiState, Boolean>? =
                com.lynnhub.app.util.PageCacheManager.get(
                    com.lynnhub.app.util.CacheKeys.MEMORY
                )
            if (cached != null) {
                _uiState.value = cached.first.copy(isLoading = false)
            }
        }
        load()
    }

    fun load() {
        if (_uiState.value.nodes.isEmpty()) {
            _uiState.value = _uiState.value.copy(isLoading = true)
        }
        viewModelScope.launch {
            try {
                val resp = apiService.getMemory()
                val newState = _uiState.value.copy(
                    nodes = resp.nodes,
                    edges = resp.edges,
                    isLoading = false
                )
                _uiState.value = newState
                // 存入缓存
                com.lynnhub.app.util.PageCacheManager.put(
                    com.lynnhub.app.util.CacheKeys.MEMORY,
                    newState
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
                if (q.isBlank()) {
                    val resp = apiService.getMemory()
                    _uiState.value = _uiState.value.copy(
                        nodes = resp.nodes,
                        edges = resp.edges,
                        isSearching = false
                    )
                } else {
                    val searchResp = apiService.searchMemory(q)
                    val resultIds = searchResp.results.map { it.id }.toSet()
                    val allResp = apiService.getMemory()
                    val matchedNodes = allResp.nodes.filter { it.id in resultIds }
                    _uiState.value = _uiState.value.copy(
                        nodes = matchedNodes,
                        isSearching = false,
                        toast = "找到 ${matchedNodes.size} 条记忆"
                    )
                }
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
    val context = androidx.compose.ui.platform.LocalContext.current
    val userPreferences = remember { UserPreferences(context) }
    val user by userPreferences.userFlow.collectAsState(initial = null)
    val userName = user?.displayName?.ifBlank { null } ?: user?.username ?: "用户"
    val keyboardController = LocalSoftwareKeyboardController.current
    var showSearchDialog by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // 顶部 Header
            CoreScreenHeader(
                title = "记忆",
                userName = userName,
                onOpenSettings = onOpenSettings
            )

            // 分类标签
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf("全部", "灵感", "任务", "认知", "对话").forEach { category ->
                    val isSelected = category == uiState.category
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(if (isSelected) Primary.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surface)
                            .border(
                                1.dp,
                                if (isSelected) Primary.copy(alpha = 0.35f) else BorderSubtle,
                                RoundedCornerShape(999.dp)
                            )
                            .clickable { viewModel.setCategory(category) }
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

            // 卡片列表区域
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
                // 按分类筛选
                val filteredNodes = if (uiState.category == "全部") {
                    uiState.nodes
                } else {
                    uiState.nodes.filter { memoryTypeLabel(it.type) == uiState.category }
                }
                // 按时间倒序（最新在前）
                val sortedNodes = filteredNodes.sortedByDescending { it.createdAt }

                if (sortedNodes.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (uiState.query.isBlank()) "暂无记忆" else "未找到相关记忆",
                            color = TextMuted,
                            fontSize = 13.sp
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(
                            items = sortedNodes,
                            key = { it.id }
                        ) { node ->
                            MemoryCard(
                                node = node,
                                isExpanded = uiState.expandedId == node.id,
                                onClick = { viewModel.toggleExpand(node.id) }
                            )
                        }
                    }
                }
            }
        }

        // 右下角悬浮搜索 FAB
        Pressable(
            onClick = { showSearchDialog = true },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 22.dp, bottom = 22.dp)
                .size(52.dp)
                .clip(CircleShape)
                .background(Brush.linearGradient(GradientPrimary))
                .border(1.dp, BorderHover, CircleShape)
        ) { _ ->
            Icon(
                imageVector = LynxIcons.Search,
                contentDescription = "搜索记忆",
                tint = TextPrimary,
                modifier = Modifier.size(24.dp)
            )
        }
    }

    // 搜索弹窗
    if (showSearchDialog) {
        MemorySearchDialog(
            query = uiState.query,
            isSearching = uiState.isSearching,
            onQueryChange = viewModel::updateQuery,
            onSearch = {
                keyboardController?.hide()
                viewModel.search()
                showSearchDialog = false
            },
            onDismiss = {
                keyboardController?.hide()
                showSearchDialog = false
            }
        )
    }

    // toast
    LaunchedEffect(uiState.toast) {
        uiState.toast?.let {
            kotlinx.coroutines.delay(2000)
            viewModel.clearToast()
        }
    }
}

// ============ 记忆卡片 ============
@Composable
private fun MemoryCard(
    node: MemoryNodeDto,
    isExpanded: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, BorderSubtle, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Column {
            // 类型标签 + 时间
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // 类型标签
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(memoryTypeColor(node.type).copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = memoryTypeLabel(node.type),
                        fontSize = 10.sp,
                        color = memoryTypeColor(node.type),
                        fontWeight = FontWeight.SemiBold
                    )
                }
                // 时间
                Text(
                    text = node.createdAt.take(16).replace("T", " "),
                    fontSize = 10.sp,
                    color = TextMuted
                )
            }

            if (node.label.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = node.label,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // 摘要 / 展开
            val content = node.fullContent.ifBlank { node.label }
            Text(
                text = content,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = if (isExpanded) Int.MAX_VALUE else 2,
                overflow = if (isExpanded) TextOverflow.Visible else TextOverflow.Ellipsis,
                lineHeight = 18.sp
            )

            if (content.length > 120) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = if (isExpanded) "收起" else "展开全文",
                    fontSize = 11.sp,
                    color = Primary,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

// ============ 搜索弹窗 ============
@Composable
private fun MemorySearchDialog(
    query: String,
    isSearching: Boolean,
    onQueryChange: (String) -> Unit,
    onSearch: () -> Unit,
    onDismiss: () -> Unit
) {
    FrostedGlassDialog(onDismiss = onDismiss) {
        Column(modifier = Modifier.padding(24.dp)) {
            Text(
                text = "搜索记忆",
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(16.dp))
            OutlinedTextField(
                value = query,
                onValueChange = onQueryChange,
                placeholder = { Text("输入关键词...", color = TextMuted, fontSize = 14.sp) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Primary,
                    unfocusedBorderColor = BorderHover,
                    cursorColor = Primary,
                    focusedTextColor = MaterialTheme.colorScheme.onSurface,
                    unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                singleLine = true,
                trailingIcon = {
                    if (isSearching) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = Primary
                        )
                    }
                }
            )
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                Text(
                    text = "取消",
                    color = TextMuted,
                    modifier = Modifier
                        .clickable { onDismiss() }
                        .padding(vertical = 8.dp, horizontal = 12.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isSearching) "搜索中..." else "搜索",
                    color = if (!isSearching && query.isNotBlank()) Primary else TextMuted,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clickable(enabled = !isSearching && query.isNotBlank()) { onSearch() }
                        .padding(vertical = 8.dp, horizontal = 12.dp)
                )
            }
        }
    }
}

// ============ 工具函数 ============
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

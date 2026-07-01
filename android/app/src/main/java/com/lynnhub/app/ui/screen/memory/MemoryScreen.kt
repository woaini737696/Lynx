package com.lynnhub.app.ui.screen.memory

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path as ComposePath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
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
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.component.Pressable
import com.lynnhub.app.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

// ============ 状态 ============
data class MemoryScreenUiState(
    val nodes: List<MemoryNodeDto> = emptyList(),
    val edges: List<MemoryEdgeDto> = emptyList(),
    val query: String = "",
    val isLoading: Boolean = false,
    val isSearching: Boolean = false,
    val selectedNodeId: String? = null,
    val toast: String? = null,
    val category: String = "全部"
)

@HiltViewModel
class MemoryScreenViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(MemoryScreenUiState())
    val uiState: StateFlow<MemoryScreenUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            try {
                val resp = apiService.getMemory()
                _uiState.value = _uiState.value.copy(
                    nodes = resp.nodes,
                    edges = resp.edges,
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
                    // 保留原图中匹配的节点 + 它们之间的边
                    val allResp = apiService.getMemory()
                    val matchedNodes = allResp.nodes.filter { it.id in resultIds }
                    val matchedEdges = allResp.edges.filter { it.from in resultIds && it.to in resultIds }
                    _uiState.value = _uiState.value.copy(
                        nodes = matchedNodes,
                        edges = matchedEdges,
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

    fun selectNode(id: String?) {
        _uiState.value = _uiState.value.copy(selectedNodeId = id)
    }

    fun clearToast() {
        _uiState.value = _uiState.value.copy(toast = null)
    }

    fun setCategory(category: String) {
        _uiState.value = _uiState.value.copy(category = category)
    }
}

// ============ 力导向布局数据 ============
data class NodePosition(
    val id: String,
    var x: Float,
    var y: Float,
    var vx: Float = 0f,
    var vy: Float = 0f,
    val node: MemoryNodeDto
)

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
            modifier = Modifier
                .fillMaxSize()
        ) {
            // 顶部 Header
            CoreScreenHeader(
                title = "记忆图谱",
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

            // 图谱区域
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
                // 筛选节点
                val filteredNodes = if (uiState.category == "全部") {
                    uiState.nodes
                } else {
                    uiState.nodes.filter { memoryTypeLabel(it.type) == uiState.category }
                }
                val filteredNodeIds = filteredNodes.map { it.id }.toSet()
                val filteredEdges = uiState.edges.filter {
                    it.from in filteredNodeIds && it.to in filteredNodeIds
                }

                if (filteredNodes.isEmpty()) {
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
                    MemoryGraphCanvas(
                        nodes = filteredNodes,
                        edges = filteredEdges,
                        selectedNodeId = uiState.selectedNodeId,
                        onNodeTap = { id -> viewModel.selectNode(id) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                    )
                }
            }
        }

        // 右下角悬浮搜索 FAB（与首页灵感 FAB 相同位置和样式）
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

        // 底部详情卡片
        uiState.selectedNodeId?.let { selectedId ->
            val selectedNode = uiState.nodes.find { it.id == selectedId }
            if (selectedNode != null) {
                NodeDetailCard(
                    node = selectedNode,
                    onDismiss = { viewModel.selectNode(null) },
                    modifier = Modifier.align(Alignment.BottomCenter)
                )
            }
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

// ============ 2D 力导向图谱 Canvas ============
@Composable
private fun MemoryGraphCanvas(
    nodes: List<MemoryNodeDto>,
    edges: List<MemoryEdgeDto>,
    selectedNodeId: String?,
    onNodeTap: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    // 初始化节点位置（圆形分布）
    val positions = remember(nodes) {
        val centerX = 500f
        val centerY = 500f
        val radius = 300f
        nodes.mapIndexed { index, node ->
            val angle = (2.0 * Math.PI * index / maxOf(nodes.size, 1)).toFloat()
            NodePosition(
                id = node.id,
                x = centerX + radius * cos(angle),
                y = centerY + radius * sin(angle),
                node = node
            )
        }
    }

    // 力导向模拟
    LaunchedEffect(nodes, edges) {
        val iterations = 80
        repeat(iterations) {
            positions.forEach { p ->
                // 排斥力
                var fx = 0f
                var fy = 0f
                positions.forEach { q ->
                    if (p.id != q.id) {
                        val dx = p.x - q.x
                        val dy = p.y - q.y
                        val dist = maxOf(sqrt(dx * dx + dy * dy), 1f)
                        val repulsion = 8000f / (dist * dist)
                        fx += (dx / dist) * repulsion
                        fy += (dy / dist) * repulsion
                    }
                }
                // 吸引力（沿边）
                edges.forEach { e ->
                    val otherId = when (p.id) {
                        e.from -> e.to
                        e.to -> e.from
                        else -> null
                    }
                    if (otherId != null) {
                        val other = positions.find { it.id == otherId }
                        if (other != null) {
                            val dx = other.x - p.x
                            val dy = other.y - p.y
                            val dist = maxOf(sqrt(dx * dx + dy * dy), 1f)
                            val attraction = (dist - 120f) * 0.05f
                            fx += (dx / dist) * attraction
                            fy += (dy / dist) * attraction
                        }
                    }
                }
                // 向中心吸引（防止飞出）
                fx += (500f - p.x) * 0.01f
                fy += (500f - p.y) * 0.01f
                p.vx = (p.vx + fx) * 0.7f
                p.vy = (p.vy + fy) * 0.7f
            }
            positions.forEach { p ->
                p.x += p.vx
                p.y += p.vy
            }
        }
    }

    // 缩放和平移状态
    var scale by remember { mutableStateOf(1f) }
    var offsetX by remember { mutableStateOf(0f) }
    var offsetY by remember { mutableStateOf(0f) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            // 双指缩放 + 拖拽平移
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = (scale * zoom).coerceIn(0.3f, 3f)
                    offsetX += pan.x
                    offsetY += pan.y
                }
            }
            // 单击检测（点击节点）
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { tapOffset ->
                        // 将屏幕坐标转换为图谱坐标
                        val graphX = (tapOffset.x - offsetX) / scale
                        val graphY = (tapOffset.y - offsetY) / scale
                        // 查找最近的节点（在点击半径内）
                        var closestId: String? = null
                        var closestDist = Float.MAX_VALUE
                        positions.forEach { p ->
                            val dx = p.x - graphX
                            val dy = p.y - graphY
                            val dist = sqrt(dx * dx + dy * dy)
                            val nodeRadius = (8f + p.node.strength.toFloat() * 1.5f).coerceIn(8f, 24f)
                            if (dist < nodeRadius + 15f && dist < closestDist) {
                                closestDist = dist
                                closestId = p.id
                            }
                        }
                        closestId?.let { onNodeTap(it) }
                    }
                )
            }
    ) {
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer(
                    scaleX = scale,
                    scaleY = scale,
                    translationX = offsetX,
                    translationY = offsetY
                )
        ) {
            val canvasWidth = size.width
            val canvasHeight = size.height
            val centerX = canvasWidth / 2f
            val centerY = canvasHeight / 2f

            // 将图谱坐标（0-1000）映射到 Canvas 坐标
            fun mapX(x: Float): Float = centerX + (x - 500f)
            fun mapY(y: Float): Float = centerY + (y - 500f)

            // 绘制边（贝塞尔曲线）
            edges.forEach { edge ->
                val fromP = positions.find { it.id == edge.from }
                val toP = positions.find { it.id == edge.to }
                if (fromP != null && toP != null) {
                    val x1 = mapX(fromP.x)
                    val y1 = mapY(fromP.y)
                    val x2 = mapX(toP.x)
                    val y2 = mapY(toP.y)
                    // 中点偏移形成弧线
                    val midX = (x1 + x2) / 2f
                    val midY = (y1 + y2) / 2f + 10f

                    val path = ComposePath()
                    path.moveTo(x1, y1)
                    path.quadraticBezierTo(midX, midY, x2, y2)

                    val isHighlighted = selectedNodeId == edge.from || selectedNodeId == edge.to
                    drawPath(
                        path = path,
                        color = if (isHighlighted) Primary.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.08f),
                        style = Stroke(width = if (isHighlighted) 2f else 1f)
                    )
                }
            }

            // 绘制节点
            positions.forEach { p ->
                val x = mapX(p.x)
                val y = mapY(p.y)
                val radius = (8f + p.node.strength.toFloat() * 1.5f).coerceIn(8f, 24f)
                val color = memoryTypeColor(p.node.type)
                val isSelected = selectedNodeId == p.id

                // 选中节点的光晕
                if (isSelected) {
                    drawCircle(
                        color = color.copy(alpha = 0.2f),
                        radius = radius + 8f,
                        center = Offset(x, y)
                    )
                }

                // 节点填充
                drawCircle(
                    color = color.copy(alpha = if (isSelected) 0.9f else 0.7f),
                    radius = radius,
                    center = Offset(x, y)
                )
                // 节点描边
                drawCircle(
                    color = color.copy(alpha = 0.4f),
                    radius = radius,
                    center = Offset(x, y),
                    style = Stroke(width = 1.5f)
                )
            }
        }
    }

    // 节点标签 overlay（使用 Canvas 无法直接画文字，用 Text 叠加）
    // 简化：仅在选中时通过底部卡片显示信息
}

// ============ 底部详情卡片 ============
@Composable
private fun NodeDetailCard(
    node: MemoryNodeDto,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    val color = memoryTypeColor(node.type)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 16.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.95f))
            .border(1.dp, color.copy(alpha = 0.2f), RoundedCornerShape(20.dp))
            .padding(16.dp)
    ) {
        // 顶部：类型标签 + 关闭按钮
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(color.copy(alpha = 0.12f))
                    .border(1.dp, color.copy(alpha = 0.22f), RoundedCornerShape(999.dp))
                    .padding(horizontal = 10.dp, vertical = 4.dp)
            ) {
                Text(
                    text = memoryTypeLabel(node.type),
                    color = color,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = "关闭",
                tint = TextMuted,
                modifier = Modifier
                    .size(20.dp)
                    .clickable { onDismiss() }
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        // 标题
        Text(
            text = node.label.ifBlank { "未命名" },
            color = MaterialTheme.colorScheme.onSurface,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )

        // 内容
        if (node.fullContent.isNotBlank()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = node.fullContent,
                color = TextMuted,
                fontSize = 12.sp,
                lineHeight = 18.sp,
                maxLines = 4,
                overflow = TextOverflow.Ellipsis
            )
        }

        // 底部信息
        Spacer(modifier = Modifier.height(10.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "强度: ${"%.1f".format(node.strength)}",
                color = TextMuted,
                fontSize = 10.sp
            )
            Text(
                text = "关联 ${node.connections.size} 个节点",
                color = TextMuted,
                fontSize = 10.sp
            )
            if (node.createdAt.isNotBlank()) {
                Text(
                    text = node.createdAt.take(10),
                    color = TextMuted,
                    fontSize = 10.sp
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
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface,
        titleContentColor = MaterialTheme.colorScheme.onSurface,
        title = {
            Text(
                text = "搜索记忆",
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
        },
        text = {
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
        },
        confirmButton = {
            Text(
                text = if (isSearching) "搜索中..." else "搜索",
                color = if (!isSearching && query.isNotBlank()) Primary else TextMuted,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clickable(enabled = !isSearching && query.isNotBlank()) { onSearch() }
                    .padding(vertical = 8.dp, horizontal = 12.dp)
            )
        },
        dismissButton = {
            Text(
                text = "取消",
                color = TextMuted,
                modifier = Modifier
                    .clickable { onDismiss() }
                    .padding(vertical = 8.dp, horizontal = 12.dp)
            )
        }
    )
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

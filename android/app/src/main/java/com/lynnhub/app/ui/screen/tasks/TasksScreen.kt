package com.lynnhub.app.ui.screen.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.List
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshContainer
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.data.remote.dto.AssigneeDto
import com.lynnhub.app.data.remote.dto.LarkTaskDto
import com.lynnhub.app.data.remote.dto.SyncStateDto
import com.lynnhub.app.ui.theme.Amber500
import com.lynnhub.app.ui.theme.Green500
import com.lynnhub.app.ui.theme.Orange500
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen(viewModel: TasksViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    LaunchedEffect(Unit) { viewModel.onVisible() }

    val pullState = rememberPullToRefreshState()
    LaunchedEffect(pullState.isRefreshing) {
        if (pullState.isRefreshing) viewModel.refresh()
    }
    LaunchedEffect(uiState.isRefreshing) {
        if (!uiState.isRefreshing && pullState.isRefreshing) pullState.endRefresh()
    }

    val selectedTab = uiState.selectedTab
    val filteredTasks = remember(uiState.tasks, selectedTab) {
        when (selectedTab.completed) {
            null -> uiState.tasks
            else -> uiState.tasks.filter { it.completed == selectedTab.completed }
        }
    }

    var showSheet by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val selectedTask = uiState.selectedTask

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            TasksHeader(
                count = filteredTasks.size,
                syncState = uiState.syncState,
                isSyncing = uiState.isSyncing,
                onSyncClick = viewModel::triggerSync,
                modifier = Modifier.statusBarsPadding()
            )
            TasksTabRow(selectedTab, viewModel::selectTab)
            if (uiState.isOffline) OfflineBanner()

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .nestedScroll(pullState.nestedScrollConnection)
            ) {
                when {
                    uiState.isLoading && uiState.tasks.isEmpty() -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = Amber500)
                        }
                    }
                    filteredTasks.isEmpty() -> EmptyTasks()
                    else -> {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(
                                horizontal = 16.dp,
                                vertical = 8.dp
                            ),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(filteredTasks, key = { it.guid }) { task ->
                                TaskItem(
                                    task = task,
                                    isToggling = uiState.togglingTaskGuid == task.guid,
                                    onClick = {
                                        viewModel.selectTask(task)
                                        showSheet = true
                                    },
                                    onToggle = { viewModel.toggleTask(task) }
                                )
                            }
                        }
                    }
                }
                PullToRefreshContainer(
                    state = pullState,
                    modifier = Modifier.align(Alignment.TopCenter),
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = Amber500
                )
            }
        }

        FloatingActionButton(
            onClick = { /* TODO: 添加新任务 */ },
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
                .navigationBarsPadding(),
            containerColor = Color.Transparent,
            contentColor = Color.White,
            shape = CircleShape
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(
                        brush = Brush.linearGradient(
                            colors = listOf(Amber500, Orange500)
                        ),
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Add,
                    contentDescription = "添加任务",
                    modifier = Modifier.size(24.dp)
                )
            }
        }

        if (showSheet && selectedTask != null) {
            ModalBottomSheet(
                onDismissRequest = {
                    showSheet = false
                    viewModel.clearSelectedTask()
                },
                sheetState = sheetState,
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                TaskDetailContent(
                    task = selectedTask,
                    isLoading = uiState.isLoadingDetail,
                    isToggling = uiState.togglingTaskGuid == selectedTask.guid,
                    onToggle = { viewModel.toggleTask(selectedTask) }
                )
            }
        }
    }
}

@Composable
private fun TasksHeader(
    count: Int,
    syncState: SyncStateDto?,
    isSyncing: Boolean,
    onSyncClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "任务",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(4.dp))
            SyncStatusRow(syncState, isSyncing, onSyncClick)
        }
        Surface(
            modifier = Modifier,
            shape = RoundedCornerShape(12.dp),
            color = Amber500.copy(alpha = 0.12f)
        ) {
            Text(
                text = count.toString(),
                style = MaterialTheme.typography.titleMedium,
                color = Amber500,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
            )
        }
    }
}

@Composable
private fun SyncStatusRow(
    syncState: SyncStateDto?,
    isSyncing: Boolean,
    onSyncClick: () -> Unit
) {
    val dotColor = when {
        isSyncing -> Amber500
        syncState == null -> MaterialTheme.colorScheme.outline
        syncState.lastError != null -> MaterialTheme.colorScheme.error
        syncState.lastSyncAt != null -> Green500
        else -> MaterialTheme.colorScheme.outline
    }
    val statusText = when {
        isSyncing -> "同步中…"
        syncState == null -> "未同步"
        syncState.lastError != null -> "同步异常"
        syncState.lastSyncAt != null -> "已同步 · ${formatRelativeTime(syncState.lastSyncAt)}"
        else -> "未同步"
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onSyncClick)
            .padding(horizontal = 4.dp, vertical = 2.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(dotColor)
        )
        Spacer(Modifier.width(6.dp))
        Text(
            text = statusText,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (isSyncing) {
            Spacer(Modifier.width(6.dp))
            CircularProgressIndicator(
                modifier = Modifier.size(12.dp),
                strokeWidth = 1.5.dp,
                color = Amber500
            )
        }
    }
}

@Composable
private fun TasksTabRow(
    selected: TaskTab,
    onSelect: (TaskTab) -> Unit
) {
    val tabs = listOf(TaskTab.ALL, TaskTab.IN_PROGRESS, TaskTab.COMPLETED)
    val selectedIndex = tabs.indexOf(selected)
    TabRow(
        selectedTabIndex = selectedIndex,
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = Amber500,
        indicator = { tabPositions ->
            TabRowDefaults.Indicator(
                modifier = Modifier.tabIndicatorOffset(tabPositions[selectedIndex]),
                color = Amber500,
                height = 3.dp
            )
        },
        divider = {}
    ) {
        tabs.forEach { tab ->
            Tab(
                selected = selected == tab,
                onClick = { onSelect(tab) },
                text = {
                    Text(
                        text = tab.label,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (selected == tab) FontWeight.SemiBold else FontWeight.Medium
                    )
                },
                selectedContentColor = Amber500,
                unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun OfflineBanner() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Outlined.CloudOff,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "离线浏览 · 显示缓存数据",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun EmptyTasks() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Outlined.CheckCircle,
            contentDescription = null,
            modifier = Modifier.size(72.dp),
            tint = Amber500.copy(alpha = 0.4f)
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = "暂无任务",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "点击右下角按钮添加新任务",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun TaskItem(
    task: LarkTaskDto,
    isToggling: Boolean,
    onClick: () -> Unit,
    onToggle: () -> Unit
) {
    val isCompleted = task.completed
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 2.dp,
            pressedElevation = 4.dp
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(if (isCompleted) Amber500 else Color.Transparent)
                    .clickable(onClick = onToggle)
                    .border(
                        width = 2.dp,
                        color = if (isCompleted) Amber500 else MaterialTheme.colorScheme.outline,
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                when {
                    isToggling -> CircularProgressIndicator(
                        modifier = Modifier.size(14.dp),
                        strokeWidth = 2.dp,
                        color = if (isCompleted) Color.White else Amber500
                    )
                    isCompleted -> Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = "已完成",
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = task.summary,
                    style = MaterialTheme.typography.bodyLarge,
                    color = if (isCompleted) MaterialTheme.colorScheme.onSurfaceVariant
                    else MaterialTheme.colorScheme.onSurface,
                    textDecoration = if (isCompleted) TextDecoration.LineThrough
                    else TextDecoration.None,
                    fontWeight = if (isCompleted) FontWeight.Normal else FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                val hasDueDate = !task.dueAt.isNullOrBlank()
                if (hasDueDate) {
                    Spacer(Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Outlined.Schedule,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = formatDateTime(task.dueAt),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                if (!task.tasklistName.isNullOrBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Outlined.List,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = task.tasklistName,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                if (task.assignees.isNotEmpty()) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = assigneeText(task.assignees),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            Spacer(Modifier.width(8.dp))
            PriorityIndicator(isCompleted = isCompleted)
        }
    }
}

@Composable
private fun PriorityIndicator(isCompleted: Boolean) {
    val isStarred = false
    IconButton(
        onClick = { /* TODO: 切换星标 */ },
        modifier = Modifier.size(32.dp)
    ) {
        Icon(
            imageVector = if (isStarred) Icons.Filled.Star else Icons.Filled.StarBorder,
            contentDescription = "优先级",
            modifier = Modifier.size(20.dp),
            tint = if (isCompleted) MaterialTheme.colorScheme.onSurfaceVariant
            else if (isStarred) Amber500
            else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun MetaChip(icon: ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(12.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.width(4.dp))
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun TaskDetailContent(
    task: LarkTaskDto,
    isLoading: Boolean,
    isToggling: Boolean,
    onToggle: () -> Unit
) {
    val borderColor = if (task.completed) Amber500 else MaterialTheme.colorScheme.outline
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp)
            .navigationBarsPadding()
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(if (task.completed) Amber500 else Color.Transparent)
                    .clickable(onClick = onToggle)
                    .border(2.dp, borderColor, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                when {
                    isToggling -> CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = if (task.completed) Color.White else Amber500
                    )
                    task.completed -> Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = "已完成",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Text(
                text = task.summary,
                style = MaterialTheme.typography.titleLarge,
                color = if (task.completed) MaterialTheme.colorScheme.onSurfaceVariant
                else MaterialTheme.colorScheme.onSurface,
                textDecoration = if (task.completed) TextDecoration.LineThrough
                else TextDecoration.None,
                fontWeight = FontWeight.SemiBold
            )
        }

        Spacer(Modifier.height(20.dp))
        DetailRow("任务清单", task.tasklistName ?: "未归类")
        DetailRow("截止时间", formatDateTime(task.dueAt))
        DetailRow("开始时间", formatDateTime(task.startAt))
        DetailRow("负责人", assigneeText(task.assignees))

        if (!task.description.isNullOrBlank()) {
            Spacer(Modifier.height(16.dp))
            Text(
                text = "描述",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Medium
            )
            Spacer(Modifier.height(8.dp))
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Text(
                    text = task.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(16.dp)
                )
            }
        }

        if (isLoading) {
            Spacer(Modifier.height(16.dp))
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = Amber500
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(80.dp)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f)
        )
    }
}

private fun assigneeText(assignees: List<AssigneeDto>): String {
    if (assignees.isEmpty()) return "未指派"
    return assignees.joinToString("、") { it.displayName ?: it.name ?: "未知" }
}

private fun formatDateTime(iso: String?): String {
    if (iso.isNullOrBlank()) return "未设置"
    return formatIso(iso) ?: iso
}

private fun formatRelativeTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val millis = parseIsoToMillis(iso) ?: return iso
    val diff = System.currentTimeMillis() - millis
    return when {
        diff < 60_000L -> "刚刚"
        diff < 3_600_000L -> "${diff / 60_000L}分钟前"
        diff < 86_400_000L -> "${diff / 3_600_000L}小时前"
        else -> "${diff / 86_400_000L}天前"
    }
}

private val DISPLAY_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")

private fun parseIsoToMillis(iso: String): Long? = try {
    Instant.parse(iso).toEpochMilli()
} catch (_: Exception) {
    try {
        LocalDateTime.parse(iso)
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()
    } catch (_: Exception) {
        null
    }
}

private fun formatIso(iso: String): String? = try {
    Instant.parse(iso)
        .atZone(ZoneId.systemDefault())
        .format(DISPLAY_FORMATTER)
} catch (_: Exception) {
    try {
        LocalDateTime.parse(iso).format(DISPLAY_FORMATTER)
    } catch (_: Exception) {
        null
    }
}

package com.lynnhub.app.ui.screen.tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface as Material3Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.dto.LarkTaskDto
import com.lynnhub.app.ui.component.CoreScreenHeader
import com.lynnhub.app.ui.component.FrostedGlassDialog
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.theme.*
import kotlinx.coroutines.delay

/**
 * Lynx v6 核心页面：任务（飞书任务同步）
 *
 * 设计要点：
 * - 顶部标题 + 用户头像（设置入口）
 * - 同步状态条：显示最后同步时间/任务总数，点击触发同步
 * - 按"进行中" / "已完成"分组展示飞书任务卡片
 * - 卡片形态：标题 + 任务列表名 + 负责人 + 截止时间
 * - 底部"新增飞书任务"按钮，弹窗支持标题/负责人/截止时间
 */
@Composable
fun TasksScreen(
    onOpenSettings: () -> Unit,
    viewModel: TasksViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val userPreferences = remember { UserPreferences(context) }
    val user by userPreferences.userFlow.collectAsState(initial = null)
    val userName = user?.displayName?.ifBlank { null } ?: user?.username ?: "用户"
    val keyboardController = LocalSoftwareKeyboardController.current
    var showAddTaskDialog by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .pointerInput(Unit) {
                detectTapGestures(onTap = { keyboardController?.hide() })
            }
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding()
                .padding(horizontal = 16.dp)
        ) {
            CoreScreenHeader(
                title = "任务",
                userName = userName,
                onOpenSettings = onOpenSettings
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 同步状态条
            SyncStateBar(
                syncState = state.syncState,
                isSyncing = state.isSyncing,
                onSync = viewModel::triggerSync
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 药丸分段器
            TaskFilterTabs(
                selected = state.filter,
                onSelect = viewModel::setFilter
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 任务列表
            if (state.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Primary)
                }
            } else {
                val active = state.tasks.filter { !it.completed }
                val done = state.tasks.filter { it.completed }
                val visibleTasks = when (state.filter) {
                    TasksFilter.ACTIVE -> active
                    TasksFilter.DONE -> done
                }

                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (visibleTasks.isNotEmpty()) {
                        items(
                            items = visibleTasks,
                            key = { "${state.filter}_${it.guid}" }
                        ) { task ->
                            LarkTaskCard(
                                task = task,
                                onToggle = { viewModel.toggleTask(task) }
                            )
                        }
                    } else {
                        item(key = "empty") {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 40.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = if (state.filter == TasksFilter.ACTIVE) "暂无进行中任务" else "暂无已完成任务",
                                    color = TextMuted,
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 底部新增飞书任务按钮
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Primary.copy(alpha = 0.12f))
                    .border(1.dp, Primary.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
                    .clickable { showAddTaskDialog = true }
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = LynxIcons.Add,
                    contentDescription = null,
                    tint = Primary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "新增飞书任务",
                    color = Primary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }

    // toast
    state.toast?.let { msg ->
        LaunchedEffect(msg) {
            delay(2000)
            viewModel.clearToast()
        }
    }

    // 新增飞书任务对话框
    if (showAddTaskDialog) {
        AddLarkTaskDialog(
            isSubmitting = state.isSubmitting,
            onDismiss = { showAddTaskDialog = false },
            onSubmit = { summary, assignees, due, description ->
                viewModel.createLarkTask(summary, assignees, due, description)
                showAddTaskDialog = false
            }
        )
    }
}

// ============ 同步状态条 ============
@Composable
private fun SyncStateBar(
    syncState: com.lynnhub.app.data.remote.dto.SyncStateDto?,
    isSyncing: Boolean,
    onSync: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Liquid2)
            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
            .clickable(enabled = !isSyncing) { onSync() }
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (isSyncing) {
            CircularProgressIndicator(
                modifier = Modifier.size(14.dp),
                strokeWidth = 2.dp,
                color = Primary
            )
        } else {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(Agent)
            )
        }
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = when {
                    isSyncing -> "正在刷新…"
                    syncState?.lastSyncAt != null -> "数据库 · 最后同步 ${syncState.lastSyncAt.take(16).replace("T", " ")}"
                    else -> "点击刷新数据库"
                },
                fontSize = 12.sp,
                color = TextPrimary,
                fontWeight = FontWeight.Medium
            )
            if (syncState?.taskCount != null && syncState.taskCount > 0) {
                Text(
                    text = "共 ${syncState.taskCount} 条任务 · 飞书同步请在 Web/桌面端",
                    fontSize = 10.sp,
                    color = TextMuted,
                    modifier = Modifier.padding(top = 2.dp)
                )
            } else {
                Text(
                    text = "飞书任务请在 Web 端/桌面端同步",
                    fontSize = 10.sp,
                    color = TextMuted,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
        if (!isSyncing) {
            Text(
                text = "刷新",
                color = Primary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable { onSync() }.padding(4.dp)
            )
        }
    }
}

// ============ 过滤标签 ============
@Composable
private fun TaskFilterTabs(
    selected: TasksFilter,
    onSelect: (TasksFilter) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(999.dp))
            .background(Surface)
            .border(1.dp, BorderSubtle, RoundedCornerShape(999.dp))
            .padding(4.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        val tabs = listOf(
            TasksFilter.ACTIVE to "进行中",
            TasksFilter.DONE to "已完成"
        )
        tabs.forEach { (filter, label) ->
            val isSelected = filter == selected
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (isSelected) Primary.copy(alpha = 0.15f) else Color.Transparent)
                    .clickable { onSelect(filter) }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = label,
                    fontSize = 12.sp,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (isSelected) Primary else TextMuted
                )
            }
        }
    }
}

// ============ 飞书任务卡片 ============
@Composable
private fun LarkTaskCard(
    task: LarkTaskDto,
    onToggle: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(
                1.dp,
                if (task.completed) BorderSubtle else Primary.copy(alpha = 0.18f),
                RoundedCornerShape(14.dp)
            )
            .clickable { onToggle() }
            .padding(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 左侧圆形复选框
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(if (task.completed) Agent else Color.Transparent)
                    .border(1.dp, BorderHover, CircleShape)
                    .clickable { onToggle() },
                contentAlignment = Alignment.Center
            ) {
                if (task.completed) {
                    Icon(
                        imageVector = LynxIcons.Check,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(12.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.width(10.dp))
            // 任务标题
            Text(
                text = task.summary,
                color = if (task.completed) TextMuted else TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None,
                modifier = Modifier.weight(1f)
            )
        }

        // 元信息行：任务列表 + 负责人 + 截止时间
        val metaItems = mutableListOf<String>()
        task.tasklistName?.let { metaItems.add("📋 $it") }
        if (task.assignees.isNotEmpty()) {
            val names = task.assignees.joinToString("、") { it.displayName ?: it.name ?: "?" }
            metaItems.add("👤 $names")
        }
        task.dueAt?.let { metaItems.add("⏰ ${it.take(10)}") }
        if (metaItems.isNotEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = metaItems.joinToString("  ·  "),
                color = TextMuted,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// ============ 新增飞书任务对话框（实色背景，不透明） ============
@Composable
private fun AddLarkTaskDialog(
    isSubmitting: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (summary: String, assignees: List<String>, due: String?, description: String?) -> Unit
) {
    var summary by remember { mutableStateOf("") }
    var assigneesText by remember { mutableStateOf("") }
    var dueDate by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    val keyboardController = LocalSoftwareKeyboardController.current

    FrostedGlassDialog(onDismiss = { if (!isSubmitting) onDismiss() }) {
        Column(modifier = Modifier.padding(24.dp)) {
            Text(
                text = "新增飞书任务",
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(16.dp))

            // 任务标题（必填）
            Text(
                text = "任务标题 *",
                color = TextMuted,
                fontSize = 11.sp,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            OutlinedTextField(
                value = summary,
                onValueChange = { summary = it },
                placeholder = { Text("输入任务标题...", color = TextMuted, fontSize = 14.sp) },
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp)),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Primary,
                    unfocusedBorderColor = BorderHover,
                    cursorColor = Primary,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                singleLine = true,
                enabled = !isSubmitting
            )

            Spacer(modifier = Modifier.height(10.dp))

            // 负责人（姓名用逗号分隔，后端解析）
            Text(
                text = "负责人（姓名逗号分隔，可下发多人）",
                color = TextMuted,
                fontSize = 11.sp,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            OutlinedTextField(
                value = assigneesText,
                onValueChange = { assigneesText = it },
                placeholder = { Text("如：张三,李四", color = TextMuted, fontSize = 14.sp) },
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp)),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Primary,
                    unfocusedBorderColor = BorderHover,
                    cursorColor = Primary,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                singleLine = true,
                enabled = !isSubmitting
            )

            Spacer(modifier = Modifier.height(10.dp))

            // 截止时间（可选，格式 YYYY-MM-DD）
            Text(
                text = "截止时间（可选，格式 2026-07-30）",
                color = TextMuted,
                fontSize = 11.sp,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            OutlinedTextField(
                value = dueDate,
                onValueChange = { dueDate = it },
                placeholder = { Text("2026-07-30", color = TextMuted, fontSize = 14.sp) },
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp)),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Primary,
                    unfocusedBorderColor = BorderHover,
                    cursorColor = Primary,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                singleLine = true,
                enabled = !isSubmitting
            )

            Spacer(modifier = Modifier.height(10.dp))

            // 描述（可选）
            Text(
                text = "任务描述（可选）",
                color = TextMuted,
                fontSize = 11.sp,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                placeholder = { Text("补充说明...", color = TextMuted, fontSize = 14.sp) },
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp)),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Primary,
                    unfocusedBorderColor = BorderHover,
                    cursorColor = Primary,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                maxLines = 3,
                enabled = !isSubmitting
            )

            Spacer(modifier = Modifier.height(16.dp))

            // 按钮区
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                Text(
                    text = "取消",
                    color = TextMuted,
                    modifier = Modifier
                        .clickable(enabled = !isSubmitting) { onDismiss() }
                        .padding(vertical = 8.dp, horizontal = 12.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isSubmitting) "创建中..." else "创建",
                    color = if (!isSubmitting && summary.isNotBlank()) Primary else TextMuted,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clickable(enabled = !isSubmitting && summary.isNotBlank()) {
                            val assignees = assigneesText.split(",", "，").map { it.trim() }.filter { it.isNotBlank() }
                            val due = dueDate.trim().ifBlank { null }?.let { "${it}T23:59:59+08:00" }
                            onSubmit(summary.trim(), assignees, due, description.trim().ifBlank { null })
                            keyboardController?.hide()
                        }
                        .padding(vertical = 8.dp, horizontal = 12.dp)
                )
            }
        }
    }
}

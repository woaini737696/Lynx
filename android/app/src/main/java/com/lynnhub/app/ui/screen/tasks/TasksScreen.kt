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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.dto.TaskDto
import com.lynnhub.app.ui.component.CoreScreenHeader
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.screen.home.formatRelativeTime
import com.lynnhub.app.ui.screen.panel.TaskFilter
import com.lynnhub.app.ui.screen.panel.TaskPanelViewModel
import com.lynnhub.app.ui.theme.*

/**
 * Lynx v6 核心页面：任务
 *
 * 设计要点：
 * - 顶部标题 + 用户头像（设置入口），无返回按钮
 * - 按"进行中" / "已完成"分组展示看板任务
 * - 左侧圆形复选框点击切换完成状态
 * - 底部输入框回车即创建任务
 */
@Composable
fun TasksScreen(
    onOpenSettings: () -> Unit,
    viewModel: TaskPanelViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val userPreferences = remember { UserPreferences(context) }
    val user by userPreferences.userFlow.collectAsState(initial = null)
    val userName = user?.displayName?.ifBlank { null } ?: user?.username ?: "用户"
    val keyboardController = LocalSoftwareKeyboardController.current
    var isInputFocused by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
            .pointerInput(Unit) {
                detectTapGestures(onTap = { keyboardController?.hide() })
            }
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .imePadding()
                .padding(horizontal = 16.dp, vertical = 16.dp)
        ) {
            CoreScreenHeader(
                title = "任务",
                userName = userName,
                onOpenSettings = onOpenSettings
            )

            Spacer(modifier = Modifier.height(16.dp))

            // 药丸分段器
            TaskFilterTabs(
                selected = state.filter,
                onSelect = viewModel::setFilter
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 任务列表（输入聚焦时加半透明蒙层）
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
                    TaskFilter.ACTIVE -> active
                    TaskFilter.DONE -> done
                    else -> active
                }

                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .drawWithContent {
                            drawContent()
                            if (isInputFocused) drawRect(Color.Black, alpha = 0.35f)
                        },
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (visibleTasks.isNotEmpty()) {
                        items(
                            items = visibleTasks,
                            key = { "${state.filter}_${it.id}" }
                        ) { task ->
                            TaskRow(
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
                                Text("暂无任务", color = TextMuted, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // 底部输入框
            OutlinedTextField(
                value = state.text,
                onValueChange = viewModel::updateText,
                placeholder = { Text("输入新任务...", color = TextMuted, fontSize = 14.sp) },
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Surface)
                    .onFocusChanged { isInputFocused = it.isFocused },
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color.Transparent,
                    unfocusedBorderColor = Color.Transparent,
                    cursorColor = Primary
                ),
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { viewModel.submit() }),
                trailingIcon = {
                    if (state.isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Primary
                        )
                    } else {
                        Icon(
                            imageVector = LynxIcons.Send,
                            contentDescription = "创建",
                            tint = Primary,
                            modifier = Modifier
                                .clip(CircleShape)
                                .clickable { viewModel.submit() }
                                .padding(6.dp)
                        )
                    }
                }
            )
        }
    }
}

@Composable
private fun TaskFilterTabs(
    selected: TaskFilter,
    onSelect: (TaskFilter) -> Unit
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
            TaskFilter.ACTIVE to "进行中",
            TaskFilter.DONE to "已完成"
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

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        fontSize = 10.sp,
        color = TextMuted,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(start = 4.dp, bottom = 2.dp)
    )
}

@Composable
private fun TaskRow(
    task: TaskDto,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Surface)
            .border(1.dp, BorderSubtle, RoundedCornerShape(10.dp))
            .clickable { onToggle() }
            .padding(12.dp),
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
                    tint = Void,
                    modifier = Modifier.size(12.dp)
                )
            }
        }
        Spacer(modifier = Modifier.width(10.dp))
        // 中间内容
        Text(
            text = task.content,
            color = if (task.completed) TextMuted else TextPrimary,
            fontSize = 14.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None,
            modifier = Modifier.weight(1f)
        )
        Spacer(modifier = Modifier.width(8.dp))
        // 右侧相对时间
        if (!task.createdAt.isNullOrBlank()) {
            Text(
                text = formatRelativeTime(task.createdAt),
                color = TextMuted,
                fontSize = 11.sp
            )
        }
    }
}

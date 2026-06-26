package com.lynnhub.app.ui.screen.board

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.data.remote.dto.TaskDto
import com.lynnhub.app.ui.theme.Amber500
import com.lynnhub.app.ui.theme.Green500
import com.lynnhub.app.ui.theme.Orange500
import com.lynnhub.app.ui.theme.Red500

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BoardScreen(
    viewModel: BoardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "看板",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.headlineMedium
                    )
                },
                actions = {
                    IconButton(onClick = { /* TODO: 过滤 */ }) {
                        Icon(Icons.Default.FilterList, contentDescription = "过滤")
                    }
                    IconButton(onClick = { /* TODO: 搜索 */ }) {
                        Icon(Icons.Default.Search, contentDescription = "搜索")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { viewModel.showAddDialog() },
                modifier = Modifier
                    .navigationBarsPadding()
                    .size(56.dp),
                containerColor = Color.Transparent,
                contentColor = Color.White,
                shape = CircleShape
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            brush = Brush.verticalGradient(
                                colors = listOf(Amber500, Orange500)
                            ),
                            shape = CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Add, contentDescription = "添加任务", modifier = Modifier.size(28.dp))
                }
            }
        }
    ) { paddingValues ->
        if (uiState.isLoading && uiState.tasks.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = Amber500)
            }
        } else {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                BoardColumn.ALL.forEachIndexed { index, column ->
                    BoardColumnCard(
                        column = column,
                        tasks = uiState.tasksForColumn(column.key),
                        onTaskClick = { viewModel.showEditDialog(it) },
                        onComplete = { viewModel.completeTask(it) },
                        onDelete = { viewModel.deleteTask(it) },
                        onAddClick = {
                            viewModel.switchColumn(index)
                            viewModel.showAddDialog()
                        }
                    )
                }
            }
        }
    }

    if (uiState.showAddDialog) {
        AddTaskDialog(
            currentColumn = BoardColumn.ALL[uiState.currentColumn],
            onConfirm = { content -> viewModel.addTask(content, BoardColumn.ALL[uiState.currentColumn].key) },
            onDismiss = { viewModel.hideAddDialog() }
        )
    }

    if (uiState.showEditDialog && uiState.editingTask != null) {
        EditTaskDialog(
            task = uiState.editingTask!!,
            onConfirm = { content -> viewModel.updateTask(uiState.editingTask!!.id, content) },
            onComplete = { viewModel.completeTask(uiState.editingTask!!) },
            onDelete = { viewModel.deleteTask(uiState.editingTask!!) },
            onDismiss = { viewModel.hideEditDialog() }
        )
    }
}

@Composable
private fun BoardColumnCard(
    column: BoardColumn,
    tasks: List<TaskDto>,
    onTaskClick: (TaskDto) -> Unit,
    onComplete: (TaskDto) -> Unit,
    onDelete: (TaskDto) -> Unit,
    onAddClick: () -> Unit
) {
    val priorityColor = when (column.key) {
        "northstar" -> Red500
        "campaign" -> Amber500
        else -> Green500
    }

    Card(
        modifier = Modifier
            .width(280.dp)
            .fillMaxHeight(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .width(4.dp)
                            .height(18.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(Color(column.color))
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = column.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Text(
                            text = "${tasks.size}/${column.limit}",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (tasks.size >= column.limit) Red500
                            else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                IconButton(
                    onClick = onAddClick,
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = "添加",
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            LinearProgressIndicator(
                progress = { (tasks.size.toFloat() / column.limit).coerceIn(0f, 1f) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp)),
                color = Color(column.color),
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            if (tasks.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Inbox,
                            contentDescription = null,
                            modifier = Modifier.size(40.dp),
                            tint = MaterialTheme.colorScheme.outlineVariant
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "暂无内容",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    itemsIndexed(tasks, key = { _, t -> t.id }) { _, task ->
                        BoardTaskCard(
                            task = task,
                            priorityColor = priorityColor,
                            onClick = { onTaskClick(task) },
                            onComplete = { onComplete(task) },
                            onDelete = { onDelete(task) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BoardTaskCard(
    task: TaskDto,
    priorityColor: Color,
    onClick: () -> Unit,
    onComplete: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(
                elevation = 1.dp,
                shape = RoundedCornerShape(12.dp)
            )
            .clickable { onClick() },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 0.dp, end = 8.dp, top = 12.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(36.dp)
                    .background(priorityColor)
            )
            Spacer(Modifier.width(12.dp))

            Text(
                text = task.content,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )

            IconButton(
                onClick = onComplete,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = "完成",
                    modifier = Modifier.size(20.dp),
                    tint = Green500
                )
            }
            IconButton(
                onClick = onDelete,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    Icons.Default.DeleteOutline,
                    contentDescription = "删除",
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun AddTaskDialog(
    currentColumn: BoardColumn,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var text by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(20.dp),
        containerColor = MaterialTheme.colorScheme.surface,
        title = {
            Text(
                "添加到${currentColumn.title}",
                fontWeight = FontWeight.SemiBold
            )
        },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                label = { Text("任务内容") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = false,
                maxLines = 3,
                shape = RoundedCornerShape(12.dp)
            )
        },
        confirmButton = {
            TextButton(
                onClick = { if (text.isNotBlank()) onConfirm(text.trim()) },
                enabled = text.isNotBlank()
            ) {
                Text("添加", color = Amber500, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}

@Composable
private fun EditTaskDialog(
    task: TaskDto,
    onConfirm: (String) -> Unit,
    onComplete: () -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit
) {
    var text by remember { mutableStateOf(task.content) }

    AlertDialog(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(20.dp),
        containerColor = MaterialTheme.colorScheme.surface,
        title = {
            Text("编辑任务", fontWeight = FontWeight.SemiBold)
        },
        text = {
            Column {
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    label = { Text("任务内容") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = false,
                    maxLines = 3,
                    shape = RoundedCornerShape(12.dp)
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { if (text.isNotBlank()) onConfirm(text.trim()) },
                enabled = text.isNotBlank()
            ) {
                Text("保存", color = Amber500, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onComplete) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Green500,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text("完成", color = Green500)
                }
                TextButton(onClick = onDelete) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = null,
                        tint = Red500,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text("删除", color = Red500)
                }
                TextButton(onClick = onDismiss) {
                    Text("取消")
                }
            }
        }
    )
}

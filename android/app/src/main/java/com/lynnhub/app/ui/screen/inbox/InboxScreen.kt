package com.lynnhub.app.ui.screen.inbox

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.lynnhub.app.data.remote.dto.IdeaDto
import com.lynnhub.app.ui.theme.Amber500
import com.lynnhub.app.ui.theme.Green500
import com.lynnhub.app.ui.theme.Orange500
import com.lynnhub.app.ui.theme.Red500
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    onBack: () -> Unit = {},
    viewModel: InboxViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val refreshState = rememberPullToRefreshState()
    val snackbarHostState = remember { SnackbarHostState() }
    var inputText by remember { mutableStateOf("") }

    BackHandler(enabled = uiState.isMultiSelectMode) {
        viewModel.exitMultiSelectMode()
    }

    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    LaunchedEffect(refreshState.isRefreshing) {
        if (refreshState.isRefreshing) {
            viewModel.refresh()
        }
    }

    LaunchedEffect(uiState.isRefreshing) {
        if (!uiState.isRefreshing && refreshState.isRefreshing) {
            refreshState.endRefresh()
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            if (uiState.isMultiSelectMode) {
                MultiSelectTopBar(
                    selectedCount = uiState.selectedIds.size,
                    totalCount = uiState.ideas.size,
                    onSelectAll = viewModel::selectAll,
                    onDelete = viewModel::deleteSelected,
                    onClose = viewModel::exitMultiSelectMode
                )
            } else {
                TopAppBar(
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.Filled.ArrowBack,
                                contentDescription = "返回",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    },
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "收件箱",
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.headlineMedium
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(
                                color = Amber500.copy(alpha = 0.12f),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text(
                                    text = "${uiState.ideas.size}",
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                    color = Amber500,
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    },
                    actions = {
                        if (uiState.ideas.isNotEmpty()) {
                            IconButton(onClick = { viewModel.enterMultiSelectMode() }) {
                                Icon(
                                    Icons.Default.Checklist,
                                    contentDescription = "批量操作",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.background
                    )
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 8.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        modifier = Modifier.weight(1f),
                        placeholder = {
                            Text(
                                "记录一闪而过的灵感...",
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        },
                        shape = RoundedCornerShape(22.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Amber500,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                            focusedContainerColor = MaterialTheme.colorScheme.surface,
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface
                        ),
                        maxLines = 3,
                        singleLine = false
                    )

                    IconButton(
                        onClick = {
                            if (inputText.isNotBlank()) {
                                viewModel.createIdea(inputText.trim())
                                inputText = ""
                            }
                        },
                        enabled = inputText.isNotBlank() && !uiState.isSubmitting,
                        modifier = Modifier
                            .size(44.dp)
                            .background(
                                brush = Brush.verticalGradient(
                                    colors = if (inputText.isNotBlank())
                                        listOf(Amber500, Orange500)
                                    else
                                        listOf(
                                            MaterialTheme.colorScheme.surfaceVariant,
                                            MaterialTheme.colorScheme.surfaceVariant
                                        )
                                ),
                                shape = CircleShape
                            )
                    ) {
                        if (uiState.isSubmitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = Color.White,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                Icons.Default.Send,
                                contentDescription = "发送",
                                tint = if (inputText.isNotBlank()) Color.White
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .nestedScroll(refreshState.nestedScrollConnection)
        ) {
            when {
                uiState.isLoading && uiState.ideas.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = Amber500)
                    }
                }
                uiState.ideas.isEmpty() -> {
                    EmptyState()
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(
                            start = 16.dp,
                            end = 16.dp,
                            top = 8.dp,
                            bottom = 8.dp
                        ),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(
                            items = uiState.ideas,
                            key = { it.id }
                        ) { idea ->
                            IdeaCard(
                                idea = idea,
                                isMultiSelectMode = uiState.isMultiSelectMode,
                                isSelected = idea.id in uiState.selectedIds,
                                onClick = {
                                    if (uiState.isMultiSelectMode) {
                                        viewModel.toggleSelection(idea.id)
                                    } else {
                                        viewModel.showActionSheet(idea)
                                    }
                                },
                                onLongClick = {
                                    if (!uiState.isMultiSelectMode) {
                                        viewModel.enterMultiSelectMode(idea.id)
                                    }
                                },
                                onImageClick = { url -> viewModel.previewImage(url) },
                                onMoveToBoard = { viewModel.moveToBoard(idea) },
                                onDelete = { viewModel.deleteIdea(idea) }
                            )
                        }
                    }
                }
            }

            PullToRefreshContainer(
                state = refreshState,
                modifier = Modifier.align(Alignment.TopCenter),
                contentColor = Amber500
            )
        }
    }

    uiState.showActionSheetFor?.let { idea ->
        IdeaActionSheet(
            idea = idea,
            onDismiss = viewModel::hideActionSheet,
            onMoveToBoard = { viewModel.moveToBoard(idea) },
            onAbandon = { viewModel.abandon(idea) },
            onDelete = { viewModel.deleteIdea(idea) }
        )
    }

    uiState.previewImageUrl?.let { url ->
        ImagePreviewDialog(
            url = url,
            onDismiss = { viewModel.previewImage(null) }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MultiSelectTopBar(
    selectedCount: Int,
    totalCount: Int,
    onSelectAll: () -> Unit,
    onDelete: () -> Unit,
    onClose: () -> Unit
) {
    TopAppBar(
        title = {
            Text(
                text = "已选 $selectedCount 项",
                fontWeight = FontWeight.SemiBold
            )
        },
        navigationIcon = {
            IconButton(onClick = onClose) {
                Icon(Icons.Filled.Close, contentDescription = "退出多选")
            }
        },
        actions = {
            TextButton(onClick = onSelectAll, enabled = selectedCount < totalCount) {
                Text("全选", color = Amber500)
            }
            TextButton(
                onClick = onDelete,
                enabled = selectedCount > 0
            ) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = Red500
                )
                Spacer(Modifier.width(4.dp))
                Text("删除", color = Red500)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun IdeaCard(
    idea: IdeaDto,
    isMultiSelectMode: Boolean,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onImageClick: (String) -> Unit,
    onMoveToBoard: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            ),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (isSelected) 4.dp else 1.dp
        ),
        border = if (isSelected) {
            BorderStroke(2.dp, Amber500)
        } else null
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 12.dp, end = 4.dp, top = 12.dp, bottom = 12.dp),
            verticalAlignment = Alignment.Top
        ) {
            if (isMultiSelectMode) {
                Checkbox(
                    checked = isSelected,
                    onCheckedChange = { onClick() },
                    modifier = Modifier.size(24.dp),
                    colors = androidx.compose.material3.CheckboxDefaults.colors(
                        checkedColor = Amber500
                    )
                )
                Spacer(modifier = Modifier.width(10.dp))
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = idea.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 5,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = MaterialTheme.typography.bodyMedium.lineHeight
                )

                val images = idea.attachments.filter { it.type == "image" }
                if (images.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        images.take(3).forEach { attachment ->
                            AsyncImage(
                                model = attachment.url,
                                contentDescription = attachment.name,
                                modifier = Modifier
                                    .size(72.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { onImageClick(attachment.url) },
                                contentScale = ContentScale.Crop
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    val sourceLabel = when (idea.source) {
                        "lightning" -> "闪电"
                        "import" -> "导入"
                        else -> idea.source
                    }
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = Amber500.copy(alpha = 0.1f)
                    ) {
                        Text(
                            text = sourceLabel,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = Amber500,
                            fontWeight = FontWeight.Medium
                        )
                    }
                    Text(
                        text = formatTime(idea.createdAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (!isMultiSelectMode) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(0.dp)
                ) {
                    IconButton(
                        onClick = onMoveToBoard,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Dashboard,
                            contentDescription = "转为任务",
                            tint = Green500,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.DeleteOutline,
                            contentDescription = "删除",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Filled.Lightbulb,
                contentDescription = null,
                tint = Amber500.copy(alpha = 0.4f),
                modifier = Modifier.size(88.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "暂无灵感记录",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "在下方输入框记录你的想法",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun IdeaActionSheet(
    idea: IdeaDto,
    onDismiss: () -> Unit,
    onMoveToBoard: () -> Unit,
    onAbandon: () -> Unit,
    onDelete: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp)
        ) {
            Text(
                text = idea.content,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 8.dp)
            )

            HorizontalDivider(
                modifier = Modifier.padding(vertical = 8.dp),
                color = MaterialTheme.colorScheme.surfaceVariant
            )

            ActionItem(
                icon = Icons.Filled.Dashboard,
                title = "移入看板",
                subtitle = "转化为可执行的任务",
                iconTint = Green500,
                onClick = onMoveToBoard
            )
            ActionItem(
                icon = Icons.Filled.Archive,
                title = "放弃入墓地",
                subtitle = "归档到墓地，以后可回顾",
                iconTint = MaterialTheme.colorScheme.onSurfaceVariant,
                onClick = onAbandon
            )
            ActionItem(
                icon = Icons.Filled.DeleteOutline,
                title = "删除",
                titleColor = Red500,
                iconTint = Red500,
                onClick = onDelete
            )
            Spacer(modifier = Modifier.height(8.dp))
            TextButton(
                onClick = onDismiss,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                Text("取消", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun ActionItem(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    titleColor: Color = MaterialTheme.colorScheme.onSurface,
    iconTint: Color = titleColor,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 24.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = iconTint,
            modifier = Modifier.size(22.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                color = titleColor,
                fontWeight = FontWeight.Medium
            )
            subtitle?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun ImagePreviewDialog(
    url: String,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable { onDismiss() },
            contentAlignment = Alignment.Center
        ) {
            AsyncImage(
                model = url,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit
            )
        }
    }
}

private fun formatTime(isoTime: String): String {
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val date = inputFormat.parse(isoTime)
        val outputFormat = SimpleDateFormat("MM-dd HH:mm", Locale.getDefault())
        outputFormat.format(date ?: Date())
    } catch (e: Exception) {
        isoTime.take(16)
    }
}

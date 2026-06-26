package com.lynnhub.app.ui.screen.focus

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.data.remote.dto.FocusTaskDto
import com.lynnhub.app.ui.theme.Amber500
import com.lynnhub.app.ui.theme.Orange500
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun FocusScreen(
    viewModel: FocusViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var newTaskText by remember { mutableStateOf("") }
    val focusManager = LocalFocusManager.current

    // Format date: "周五 · 6月26日"
    val dateFormat = remember { SimpleDateFormat("EEEE", Locale.CHINESE) }
    val monthDayFormat = remember { SimpleDateFormat("M月d日", Locale.CHINESE) }
    val today = remember { Date() }
    val friendlyDate = remember {
        "${dateFormat.format(today)} · ${monthDayFormat.format(today)}"
    }

    // Animate page entry
    var isEntering by remember { mutableStateOf(false) }
    val pageAlpha by animateFloatAsState(
        targetValue = if (isEntering) 1f else 0f,
        animationSpec = tween(durationMillis = 400),
        label = "pageAlpha"
    )

    LaunchedEffect(Unit) {
        isEntering = true
    }

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .graphicsLayer { alpha = pageAlpha },
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            FocusBottomBar(
                text = newTaskText,
                onTextChange = { newTaskText = it },
                onAddTask = {
                    if (newTaskText.isNotBlank()) {
                        viewModel.addTask(newTaskText)
                        newTaskText = ""
                        focusManager.clearFocus()
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            FocusHeader(
                date = friendlyDate,
                total = uiState.totalCount,
                completed = uiState.completedCount,
                progress = uiState.progress
            )

            when {
                uiState.isLoading && uiState.tasks.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = Amber500)
                    }
                }
                uiState.tasks.isEmpty() -> {
                    EmptyFocus()
                }
                else -> {
                    val listState = rememberLazyListState()

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        state = listState,
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(
                            items = uiState.tasks,
                            key = { it.id }
                        ) { task ->
                            FocusTaskItem(
                                task = task,
                                onToggle = { viewModel.toggleTask(task) },
                                onDelete = { viewModel.deleteTask(task) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FocusHeader(date: String, total: Int, completed: Int, progress: Float) {
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 500, easing = EaseOutCubic),
        label = "progress"
    )

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 16.dp)
    ) {
        Text(
            text = "聚焦",
            style = MaterialTheme.typography.headlineLarge.copy(
                fontWeight = FontWeight.SemiBold,
                fontSize = 32.sp
            ),
            color = MaterialTheme.colorScheme.onBackground
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = date,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
        )
        Spacer(modifier = Modifier.height(16.dp))

        // Only show progress section when there are tasks
        AnimatedVisibility(
            visible = total > 0,
            enter = expandVertically(animationSpec = tween(300)) + fadeIn(),
            exit = shrinkVertically(animationSpec = tween(300)) + fadeOut()
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "$completed",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Bold
                        ),
                        color = Amber500
                    )
                    Text(
                        text = " / $total",
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        text = "${(animatedProgress * 100).toInt()}%",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.SemiBold
                        ),
                        color = Amber500
                    )
                }
                Spacer(modifier = Modifier.height(10.dp))
                LinearProgressIndicator(
                    progress = animatedProgress,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = Amber500,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            }
        }
    }
}

@Composable
private fun FocusTaskItem(
    task: FocusTaskDto,
    onToggle: () -> Unit,
    onDelete: () -> Unit
) {
    var isExiting by remember { mutableStateOf(false) }
    val exitOffset by animateFloatAsState(
        targetValue = if (isExiting) 1f else 0f,
        animationSpec = tween(durationMillis = 300),
        finishedListener = { if (isExiting) onDelete() },
        label = "exitOffset"
    )

    val backgroundColor by animateColorAsState(
        targetValue = if (task.completed)
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
        else
            MaterialTheme.colorScheme.surface,
        animationSpec = tween(300),
        label = "bgColor"
    )

    val textColor by animateColorAsState(
        targetValue = if (task.completed)
            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
        else
            MaterialTheme.colorScheme.onSurface,
        animationSpec = tween(300),
        label = "textColor"
    )

    // Animation sequence: scale -> color -> strikethrough
    val scale by animateFloatAsState(
        targetValue = when {
            isExiting -> 0.8f
            task.completed -> 0.97f
            else -> 1f
        },
        animationSpec = tween(300),
        label = "scale"
    )

    val checkboxScale by animateFloatAsState(
        targetValue = if (task.completed) 1.1f else 1f,
        animationSpec = spring(dampingRatio = 0.5f, stiffness = 400f),
        label = "checkboxScale"
    )

    // Slide in animation for new items
    val slideOffset by animateFloatAsState(
        targetValue = 0f,
        animationSpec = tween(300, easing = EaseOutCubic),
        label = "slideOffset"
    )

    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    // Check if should trigger exit animation
    LaunchedEffect(task.completed) {
        if (task.completed) {
            kotlinx.coroutines.delay(600)
            isExiting = true
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
                translationX = exitOffset * 500f
                alpha = 1f - exitOffset
            }
            .padding(horizontal = slideOffset.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (task.completed) 0.dp else 2.dp,
            pressedElevation = 4.dp
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(
                    interactionSource = interactionSource,
                    indication = null
                ) { onToggle() }
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Animated checkbox
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .scale(checkboxScale),
                contentAlignment = Alignment.Center
            ) {
                Crossfade(
                    targetState = task.completed,
                    animationSpec = tween(200),
                    label = "checkbox"
                ) { completed ->
                    if (completed) {
                        // Filled check circle
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.linearGradient(
                                        colors = listOf(Amber500, Orange500)
                                    )
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = "已完成",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    } else {
                        // Empty circle outline
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(
                                    Color.Transparent
                                )
                                .border(
                                    width = 2.dp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f),
                                    shape = CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            // Inner dot for empty state
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(
                                        MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.2f)
                                    )
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.width(14.dp))

            // Task text with strikethrough animation
            Text(
                text = task.content,
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = if (task.completed) FontWeight.Normal else FontWeight.Medium
                ),
                color = textColor,
                textDecoration = if (task.completed) TextDecoration.LineThrough else null,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun FocusBottomBar(
    text: String,
    onTextChange: (String) -> Unit,
    onAddTask: () -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }

    // Button press animation
    val buttonScale by animateFloatAsState(
        targetValue = 1f,
        animationSpec = spring(dampingRatio = 0.6f, stiffness = 400f),
        label = "buttonScale"
    )

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 8.dp,
        shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .navigationBarsPadding(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Input field with glow effect
            Box(modifier = Modifier.weight(1f)) {
                // Glow background when focused
                if (isFocused) {
                    Box(
                        modifier = Modifier
                            .matchParentSize()
                            .padding(-4.dp)
                            .background(
                                Amber500.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(20.dp)
                            )
                    )
                }

                OutlinedTextField(
                    value = text,
                    onValueChange = onTextChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .onFocusChanged { isFocused = it.isFocused },
                    placeholder = {
                        Text(
                            "写下今天的任务...",
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                            style = MaterialTheme.typography.bodyLarge
                        )
                    },
                    shape = RoundedCornerShape(20.dp),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(
                        onDone = { onAddTask() }
                    ),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Amber500,
                        unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
                        cursorColor = Amber500,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent
                    )
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Add button with gradient
            val interactionSource = remember { MutableInteractionSource() }
            val isPressed by interactionSource.collectIsPressedAsState()

            val animatedScale by animateFloatAsState(
                targetValue = if (isPressed) 0.9f else 1f,
                animationSpec = spring(dampingRatio = 0.5f, stiffness = 500f),
                label = "addButtonScale"
            )

            Box(
                modifier = Modifier
                    .size(52.dp)
                    .scale(animatedScale)
                    .shadow(6.dp, CircleShape)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(Amber500, Orange500)
                        )
                    )
                    .clickable(
                        interactionSource = interactionSource,
                        indication = null,
                        enabled = text.isNotBlank()
                    ) { onAddTask() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Add,
                    contentDescription = "添加任务",
                    tint = Color.White,
                    modifier = Modifier.size(26.dp)
                )
            }
        }
    }
}

@Composable
private fun EmptyFocus() {
    var isVisible by remember { mutableStateOf(false) }
    val emptyAlpha by animateFloatAsState(
        targetValue = if (isVisible) 1f else 0f,
        animationSpec = tween(durationMillis = 500),
        label = "emptyAlpha"
    )
    val offsetY by animateFloatAsState(
        targetValue = if (isVisible) 0f else 20f,
        animationSpec = tween(durationMillis = 500, easing = EaseOutCubic),
        label = "emptyOffset"
    )

    LaunchedEffect(Unit) {
        isVisible = true
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(bottom = 100.dp)
            .graphicsLayer {
                alpha = emptyAlpha
                translationY = offsetY
            },
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(Amber500.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.TaskAlt,
                    contentDescription = null,
                    modifier = Modifier.size(40.dp),
                    tint = Amber500.copy(alpha = 0.7f)
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "今天还没有任务",
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.Medium
                ),
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "添加一个任务，开始专注吧 ✨",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
            )
        }
    }
}



package com.lynnhub.app.ui.screen.chat

import com.lynnhub.app.ui.component.MarkdownText
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.ui.theme.Amber500
import com.lynnhub.app.ui.theme.Orange500

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    viewModel: ChatViewModel = hiltViewModel(),
    voiceCallViewModel: VoiceCallViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val voiceState by voiceCallViewModel.uiState.collectAsState()
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    var showVoiceCall by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        voiceCallViewModel.setPermissionGranted(granted)
        if (granted) {
            voiceCallViewModel.startCall()
        }
    }

    LaunchedEffect(Unit) {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        voiceCallViewModel.setPermissionGranted(granted)
    }

    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) {
            listState.animateScrollToItem(uiState.messages.size - 1)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        ChatTopBar(
            title = uiState.aiSettings?.assistantName ?: "AI 助理",
            onMenuClick = { viewModel.toggleSessionList() },
            onNewChat = { viewModel.createNewSession() }
        )

        if (uiState.showSessionList) {
            SessionListSheet(
                sessions = uiState.sessions,
                currentSessionId = uiState.currentSessionId,
                onSelect = { viewModel.selectSession(it) },
                onDelete = { viewModel.deleteSession(it) },
                onDismiss = { viewModel.toggleSessionList() }
            )
        }

        Box(modifier = Modifier.weight(1f)) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                state = listState,
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (uiState.messages.isEmpty()) {
                    item {
                        EmptyChat(assistantName = uiState.aiSettings?.assistantName ?: "AI 助理")
                    }
                }
                items(uiState.messages, key = { it.id }) { message ->
                    ChatMessageItem(message = message)
                }
            }
        }

        if (uiState.inputText.isEmpty() && uiState.quickCommands.isNotEmpty() && uiState.messages.isEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(uiState.quickCommands) { cmd ->
                    AssistChip(
                        onClick = { viewModel.sendMessage(cmd) },
                        label = { Text(cmd, fontSize = 13.sp) },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            labelColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        ChatInputBar(
            text = uiState.inputText,
            isLoading = uiState.isStreaming,
            onTextChange = viewModel::updateInput,
            onSend = { viewModel.sendMessage() },
            onVoiceCall = {
                val granted = ContextCompat.checkSelfPermission(
                    context, Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED
                if (granted) {
                    voiceCallViewModel.startCall()
                    showVoiceCall = true
                } else {
                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    showVoiceCall = true
                }
            }
        )
    }

    if (showVoiceCall) {
        VoiceCallDialog(
            state = voiceState,
            onStart = {
                if (voiceState.hasPermission) {
                    voiceCallViewModel.startCall()
                } else {
                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
            },
            onStop = {
                voiceCallViewModel.stopCall()
                showVoiceCall = false
            },
            onTogglePause = { voiceCallViewModel.togglePause() },
            onDismiss = {
                voiceCallViewModel.stopCall()
                showVoiceCall = false
            }
        )
    }
}

@Composable
private fun ChatTopBar(
    title: String,
    onMenuClick: () -> Unit,
    onNewChat: () -> Unit
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 4.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, contentDescription = "会话列表", tint = MaterialTheme.colorScheme.onSurface)
            }
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(Amber500, Orange500))),
                contentAlignment = Alignment.Center
            ) {
                Text("L", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.weight(1f),
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
            )
            IconButton(onClick = onNewChat) {
                Icon(Icons.Default.AddComment, contentDescription = "新对话", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SessionListSheet(
    sessions: List<com.lynnhub.app.data.remote.dto.ChatSessionDto>,
    currentSessionId: String?,
    onSelect: (String) -> Unit,
    onDelete: (String) -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        LazyColumn(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
            modifier = Modifier.padding(bottom = 24.dp)
        ) {
            item {
                Text(
                    "会话历史",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 12.dp, start = 4.dp)
                )
            }
            items(sessions, key = { it.id }) { session ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(
                            if (session.id == currentSessionId)
                                Amber500.copy(alpha = 0.1f)
                            else Color.Transparent
                        )
                        .clickable { onSelect(session.id) }
                        .padding(horizontal = 12.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.ChatBubbleOutline,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                        tint = if (session.id == currentSessionId) Amber500
                            else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = session.title,
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = if (session.id == currentSessionId) Amber500
                            else MaterialTheme.colorScheme.onSurface,
                        fontWeight = if (session.id == currentSessionId) FontWeight.Medium else FontWeight.Normal
                    )
                    IconButton(
                        onClick = { onDelete(session.id) },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = "删除",
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ChatMessageItem(message: ChatMessage) {
    val clipboardManager = LocalClipboardManager.current

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.role == "user")
            Arrangement.End else Arrangement.Start
    ) {
        if (message.role == "assistant") {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(Amber500, Orange500))),
                contentAlignment = Alignment.Center
            ) {
                Text("L", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
            Spacer(modifier = Modifier.width(8.dp))
        }

        Column(
            modifier = Modifier.weight(1f, fill = false),
            horizontalAlignment = if (message.role == "user") Alignment.End else Alignment.Start
        ) {
            message.toolCalls.forEach { toolCall ->
                ToolCallCard(toolCall = toolCall)
                Spacer(modifier = Modifier.height(4.dp))
            }

            Surface(
                shape = RoundedCornerShape(
                    topStart = if (message.role == "user") 18.dp else 4.dp,
                    topEnd = if (message.role == "user") 4.dp else 18.dp,
                    bottomStart = 18.dp,
                    bottomEnd = 18.dp
                ),
                color = if (message.role == "user")
                    Brush.linearGradient(listOf(Amber500, Orange500)).let {
                        // User message: orange gradient
                        Color(0xFFFFF7ED)
                    }
                else MaterialTheme.colorScheme.surface,
                tonalElevation = if (message.role == "assistant") 0.dp else 0.dp,
                shadowElevation = if (message.role == "user") 0.dp else 1.dp,
                border = if (message.role == "assistant")
                    androidx.compose.foundation.BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
                else null
            ) {
                Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                    if (message.content.isEmpty() && message.isStreaming) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(Amber500.copy(alpha = 0.4f))
                                    .graphicsLayer {
                                        // Pulsing dot
                                    }
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("正在思考...", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        }
                    } else if (message.role == "assistant" && !message.isStreaming && message.content.isNotEmpty()) {
                        MarkdownText(
                            markdown = message.content,
                            textSize = 14.sp
                        )
                    } else {
                        Text(
                            text = message.content,
                            color = if (message.role == "user")
                                Color(0xFF1D1D1F)
                            else MaterialTheme.colorScheme.onSurface,
                            style = MaterialTheme.typography.bodyMedium,
                            lineHeight = 22.sp
                        )
                    }

                    message.error?.let { err ->
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.ErrorOutline,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = MaterialTheme.colorScheme.error
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = err,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }

            if (message.role == "assistant" && !message.isStreaming && message.content.isNotEmpty()) {
                Row(
                    modifier = Modifier.padding(top = 4.dp, start = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    IconButton(
                        onClick = { clipboardManager.setText(AnnotatedString(message.content)) },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            Icons.Default.ContentCopy,
                            contentDescription = "复制",
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                        )
                    }
                }
            }
        }

        if (message.role == "user") {
            Spacer(modifier = Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Person,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun ToolCallCard(toolCall: com.lynnhub.app.data.remote.dto.ToolCallDto) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = Amber500.copy(alpha = 0.08f),
        tonalElevation = 0.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Build,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = Amber500
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = toolCall.name,
                style = MaterialTheme.typography.labelSmall,
                color = Amber500,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun ChatInputBar(
    text: String,
    isLoading: Boolean,
    onTextChange: (String) -> Unit,
    onSend: () -> Unit,
    onVoiceCall: () -> Unit = {}
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 8.dp,
        shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            IconButton(
                onClick = onVoiceCall,
                modifier = Modifier.size(40.dp)
            ) {
                Icon(
                    Icons.Default.PhoneInTalk,
                    contentDescription = "语音通话",
                    tint = Amber500
                )
            }
            OutlinedTextField(
                value = text,
                onValueChange = onTextChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text("有什么可以帮你的？", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)) },
                maxLines = 4,
                shape = RoundedCornerShape(22.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Amber500.copy(alpha = 0.5f),
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f),
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface
                )
            )
            Spacer(modifier = Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(
                        if (text.isNotBlank() && !isLoading) Brush.linearGradient(listOf(Amber500, Orange500))
                        else Brush.linearGradient(listOf(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.surfaceVariant))
                    )
                    .clickable(enabled = text.isNotBlank() && !isLoading, onClick = onSend),
                contentAlignment = Alignment.Center
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Icon(
                        Icons.Default.Send,
                        contentDescription = "发送",
                        tint = if (text.isNotBlank()) Color.White
                            else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptyChat(assistantName: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 60.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.linearGradient(listOf(Amber500, Orange500))),
            contentAlignment = Alignment.Center
        ) {
            Text("L", fontSize = 32.sp, color = Color.White, fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "你好，我是$assistantName",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "我可以帮你管理任务、记录灵感、回答问题\n点击下方按钮开始对话，或试试语音通话",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            lineHeight = 20.sp
        )
    }
}

@Composable
private fun VoiceCallDialog(
    state: VoiceCallUiState,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onTogglePause: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(24.dp),
        title = null,
        text = {
            Column(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                val infiniteTransition = rememberInfiniteTransition(label = "voice_pulse")
                val pulseScale by infiniteTransition.animateFloat(
                    initialValue = 1f,
                    targetValue = if (state.state == VoiceCallState.LISTENING || state.state == VoiceCallState.SPEAKING) 1.15f else 1f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(800),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "pulse"
                )

                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .graphicsLayer {
                            scaleX = pulseScale
                            scaleY = pulseScale
                        }
                        .clip(CircleShape)
                        .background(
                            when (state.state) {
                                VoiceCallState.LISTENING -> Brush.linearGradient(listOf(Amber500, Orange500))
                                VoiceCallState.SPEAKING -> Brush.linearGradient(listOf(Color(0xFF22C55E), Amber500))
                                VoiceCallState.PROCESSING -> Brush.linearGradient(listOf(Color(0xFF3B82F6), Amber500))
                                VoiceCallState.ERROR -> Brush.linearGradient(listOf(Color(0xFFEF4444), Color(0xFFF97316)))
                                VoiceCallState.IDLE -> Brush.linearGradient(listOf(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.surfaceVariant))
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        when (state.state) {
                            VoiceCallState.LISTENING -> Icons.Default.Mic
                            VoiceCallState.SPEAKING -> Icons.Default.VolumeUp
                            VoiceCallState.PROCESSING -> Icons.Default.Psychology
                            VoiceCallState.ERROR -> Icons.Default.ErrorOutline
                            VoiceCallState.IDLE -> Icons.Default.PhoneInTalk
                        },
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(44.dp)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Text(
                    text = when (state.state) {
                        VoiceCallState.IDLE -> if (state.hasPermission) "点击开始语音对话" else "需要录音权限"
                        VoiceCallState.LISTENING -> "正在听你说..."
                        VoiceCallState.PROCESSING -> "思考中..."
                        VoiceCallState.SPEAKING -> "正在回复..."
                        VoiceCallState.ERROR -> "出错了"
                    },
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold
                )

                if (state.transcript.isNotBlank()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        tonalElevation = 0.dp
                    ) {
                        Text(
                            text = state.transcript,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                if (state.aiResponse.isNotBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Amber500.copy(alpha = 0.1f)
                    ) {
                        Text(
                            text = state.aiResponse.take(150),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                state.error?.let { err ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.ErrorOutline,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(err, color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        },
        confirmButton = {
            when (state.state) {
                VoiceCallState.IDLE, VoiceCallState.ERROR -> {
                    Button(
                        onClick = onStart,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Brush.linearGradient(listOf(Amber500, Orange500)).let { Amber500 }
                        )
                    ) { Text("开始通话") }
                }
                VoiceCallState.LISTENING -> {
                    TextButton(onClick = onTogglePause) { Icon(Icons.Default.Pause, contentDescription = null, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(4.dp)); Text("暂停") }
                }
                VoiceCallState.PROCESSING, VoiceCallState.SPEAKING -> {
                    TextButton(onClick = onStop, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                        Icon(Icons.Default.CallEnd, contentDescription = null, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(4.dp)); Text("挂断")
                    }
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("关闭") }
        }
    )
}

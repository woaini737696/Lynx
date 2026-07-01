package com.lynnhub.app.ui.screen.panel

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.VoiceApiClient
import com.lynnhub.app.data.remote.dto.AttachmentDto
import com.lynnhub.app.data.remote.dto.IdeaCreateRequest
import com.lynnhub.app.data.remote.dto.IdeaDto
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.screen.home.formatRelativeTime
import com.lynnhub.app.ui.theme.*
import com.lynnhub.app.util.AudioRecorder
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

// ============ 灵感速记浮层（完整版） ============
// 设计要点（按视觉稿 lynx-android-ui-preview-v3.html）：
// 1. 多行输入框（min-height 130dp，圆角 24dp，液态玻璃背景）
// 2. 4 个胶囊标签（灵感/任务/记忆/对话，可切换，选中 Primary 色）
// 3. 附件上传（图片选择 + 预览 + 删除）
// 4. 语音输入（麦克风按钮录音 → ASR 转文字填入输入框）
// 5. 保存灵感按钮（渐变主色，全宽，圆角 20dp）
// 6. 最近灵感列表（展示最近 8 条，圆点 + 内容 + 时间）

data class IdeaPanelUiState(
    val text: String = "",
    val selectedTag: String = "灵感",
    val attachments: List<AttachmentDto> = emptyList(),
    val isSubmitting: Boolean = false,
    val isRecording: Boolean = false,
    val isTranscribing: Boolean = false,
    val recentIdeas: List<IdeaDto> = emptyList(),
    val toast: String? = null
)

@HiltViewModel
class IdeaPanelViewModel @Inject constructor(
    private val apiService: ApiService,
    private val voiceApiClient: VoiceApiClient
) : ViewModel() {

    private val _uiState = MutableStateFlow(IdeaPanelUiState())
    val uiState: StateFlow<IdeaPanelUiState> = _uiState.asStateFlow()

    private val audioRecorder = AudioRecorder()

    init {
        loadRecent()
    }

    private fun loadRecent() {
        viewModelScope.launch {
            try {
                val resp = apiService.getIdeas()
                _uiState.update { it.copy(recentIdeas = resp.data.take(8)) }
            } catch (_: Exception) {
                // 静默失败，保留空列表
            }
        }
    }

    fun updateText(t: String) {
        _uiState.update { it.copy(text = t) }
    }

    fun selectTag(tag: String) {
        _uiState.update { it.copy(selectedTag = tag) }
    }

    fun addAttachment(url: String, name: String = "") {
        _uiState.update {
            it.copy(attachments = it.attachments + AttachmentDto(type = "image", name = name, url = url))
        }
    }

    fun removeAttachment(index: Int) {
        _uiState.update {
            it.copy(attachments = it.attachments.toMutableList().also { list -> list.removeAt(index) })
        }
    }

    fun startRecording(): Boolean {
        val started = audioRecorder.start()
        if (started) {
            _uiState.update { it.copy(isRecording = true) }
        }
        return started
    }

    fun stopRecording() {
        if (!_uiState.value.isRecording) return
        val pcmData = audioRecorder.stop()
        val wavData = audioRecorder.pcmToWav(pcmData)
        _uiState.update { it.copy(isRecording = false, isTranscribing = true) }
        viewModelScope.launch {
            try {
                val text = voiceApiClient.recognizeSpeech(wavData)
                _uiState.update {
                    it.copy(
                        isTranscribing = false,
                        text = if (it.text.isBlank()) text else "${it.text} $text",
                        toast = if (text.isBlank()) "未识别到语音" else "语音已转入"
                    )
                }
                delay(1500)
                _uiState.update { it.copy(toast = null) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isTranscribing = false, toast = "语音识别失败: ${e.message}")
                }
                delay(2000)
                _uiState.update { it.copy(toast = null) }
            }
        }
    }

    fun submit() {
        val content = _uiState.value.text.trim()
        if (content.isBlank()) return
        if (_uiState.value.isSubmitting) return

        // 标签映射到 source
        val source = when (_uiState.value.selectedTag) {
            "灵感" -> "lightning"
            "任务" -> "task"
            "记忆" -> "memory"
            "对话" -> "conversation"
            else -> "lightning"
        }

        _uiState.update { it.copy(isSubmitting = true) }
        viewModelScope.launch {
            try {
                apiService.createIdea(
                    IdeaCreateRequest(
                        content = content,
                        source = source,
                        status = "inbox",
                        attachments = _uiState.value.attachments
                    )
                )
                _uiState.update {
                    it.copy(
                        text = "",
                        attachments = emptyList(),
                        isSubmitting = false,
                        toast = "已保存灵感"
                    )
                }
                loadRecent()
            } catch (_: Exception) {
                _uiState.update { it.copy(isSubmitting = false, toast = "保存失败") }
            }
            delay(1500)
            _uiState.update { it.copy(toast = null) }
        }
    }

    fun clearToast() {
        _uiState.update { it.copy(toast = null) }
    }

    override fun onCleared() {
        super.onCleared()
        // 退出页面时若仍在录音，停止并释放 AudioRecord 系统资源
        if (audioRecorder.isRecording()) {
            audioRecorder.stop()
        }
    }
}

@Composable
fun IdeaPanel(
    onBack: () -> Unit,
    viewModel: IdeaPanelViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val keyboardController = LocalSoftwareKeyboardController.current
    val context = LocalContext.current

    // 图片选择器
    val imagePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            viewModel.addAttachment(uri.toString(), uri.lastPathSegment ?: "image")
        }
    }

    // 录音权限请求
    val recordPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            if (viewModel.startRecording()) {
                // 录音开始
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .pointerInput(Unit) {
                detectTapGestures(onTap = {
                    keyboardController?.hide()
                })
            }
    ) {
        // 右滑返回手势检测层
        ReturnSwipeDetector(
            returnDirection = "right",
            onReturn = onBack,
            modifier = Modifier.fillMaxSize()
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(start = 22.dp, end = 22.dp, top = 16.dp, bottom = 24.dp)
        ) {
            // 标题栏（按视觉稿：panel-header）
            Row(verticalAlignment = Alignment.CenterVertically) {
                BackButton(onClick = onBack)
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "灵感速记",
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    modifier = Modifier.weight(1f)
                )
            }

            // 滑动提示（按视觉稿：panel-hint 独立一行，左缩进 50dp）
            SwipeHint(text = "← 右滑返回", modifier = Modifier.padding(start = 50.dp, top = 4.dp, bottom = 22.dp))

            Spacer(modifier = Modifier.height(0.dp))

            // 多行输入框（按视觉稿：min-height 130dp，圆角 24dp）
            OutlinedTextField(
                value = state.text,
                onValueChange = viewModel::updateText,
                placeholder = { Text("想到什么就写下来…", color = TextMuted, fontSize = 15.sp) },
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 130.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Surface),
                shape = RoundedCornerShape(24.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Primary.copy(alpha = 0.3f),
                    unfocusedBorderColor = BorderHover,
                    cursorColor = Primary,
                    focusedContainerColor = Surface,
                    unfocusedContainerColor = Surface
                ),
                textStyle = LocalTextStyle.current.copy(
                    color = TextPrimary,
                    fontSize = 15.sp,
                    lineHeight = 24.sp
                ),
                minLines = 4,
                maxLines = 8
            )

            // 附件预览区
            if (state.attachments.isNotEmpty()) {
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    state.attachments.forEachIndexed { index, attachment ->
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Surface)
                                .border(1.dp, BorderHover, RoundedCornerShape(12.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "IMG",
                                color = TextMuted,
                                fontSize = 10.sp
                            )
                            // 删除按钮
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .size(18.dp)
                                    .clip(CircleShape)
                                    .background(Danger.copy(alpha = 0.8f))
                                    .clickable { viewModel.removeAttachment(index) },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.Close,
                                    contentDescription = "删除",
                                    tint = androidx.compose.ui.graphics.Color.White,
                                    modifier = Modifier.size(12.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 胶囊标签（灵感/任务/记忆/对话）
            Spacer(modifier = Modifier.height(18.dp))
            val tags = listOf("灵感", "任务", "记忆", "对话")
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                tags.forEach { tag ->
                    val isSelected = state.selectedTag == tag
                    Text(
                        text = tag,
                        color = if (isSelected) Primary else TextMuted,
                        fontSize = 12.sp,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(
                                if (isSelected) Primary.copy(alpha = 0.12f) else Surface
                            )
                            .border(
                                1.dp,
                                if (isSelected) Primary.copy(alpha = 0.25f) else BorderSubtle,
                                RoundedCornerShape(999.dp)
                            )
                            .clickable { viewModel.selectTag(tag) }
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }
            }

            // 工具栏（附件 + 语音）
            Spacer(modifier = Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // 附件按钮
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Surface)
                        .border(1.dp, BorderHover, CircleShape)
                        .clickable { imagePicker.launch("image/*") },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.AttachFile,
                        contentDescription = "附件",
                        tint = TextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // 语音输入按钮
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(if (state.isRecording) Danger.copy(alpha = 0.15f) else Surface)
                        .border(
                            1.dp,
                            if (state.isRecording) Danger else BorderHover,
                            CircleShape
                        )
                        .clickable {
                            if (state.isRecording) {
                                viewModel.stopRecording()
                            } else {
                                val hasPermission = ContextCompat.checkSelfPermission(
                                    context,
                                    Manifest.permission.RECORD_AUDIO
                                ) == PackageManager.PERMISSION_GRANTED
                                if (hasPermission) {
                                    viewModel.startRecording()
                                } else {
                                    recordPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    if (state.isTranscribing) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = Primary
                        )
                    } else {
                        Icon(
                            imageVector = LynxIcons.Mic,
                            contentDescription = "语音",
                            tint = if (state.isRecording) Danger else TextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                // 录音状态提示
                if (state.isRecording) {
                    Text(
                        text = "录音中… 点击停止",
                        color = Danger,
                        fontSize = 11.sp
                    )
                }
            }

            // 保存按钮（渐变主色，全宽，圆角 20dp）
            Spacer(modifier = Modifier.height(22.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        if (state.isSubmitting) Brush.linearGradient(listOf(TextMuted, TextMuted))
                        else Brush.linearGradient(GradientPrimary)
                    )
                    .clickable(enabled = !state.isSubmitting) {
                        keyboardController?.hide()
                        viewModel.submit()
                    }
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                if (state.isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = androidx.compose.ui.graphics.Color.White
                    )
                } else {
                    Text(
                        text = "保存灵感",
                        color = androidx.compose.ui.graphics.Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            // toast 提示
            state.toast?.let { msg ->
                LaunchedEffect(msg) {
                    delay(1500)
                    viewModel.clearToast()
                }
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = msg,
                    color = Agent,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Agent.copy(alpha = 0.08f))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }

            // 最近灵感列表
            Spacer(modifier = Modifier.height(20.dp))
            if (state.recentIdeas.isNotEmpty()) {
                Text(
                    text = "最近灵感",
                    fontSize = 12.sp,
                    color = TextMuted,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(bottom = 10.dp)
                )
                state.recentIdeas.forEach { idea ->
                    IdeaRow(idea = idea)
                    Spacer(modifier = Modifier.height(10.dp))
                }
            }
        }
    }
}

@Composable
private fun IdeaRow(idea: IdeaDto) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Surface)
            .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.Top
    ) {
        // 灵感点（Primary 色 5dp 圆）
        Box(
            modifier = Modifier
                .padding(top = 6.dp)
                .size(5.dp)
                .clip(CircleShape)
                .background(Primary)
        )
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = idea.content.ifBlank { "(空灵感)" },
                color = TextPrimary,
                fontSize = 14.sp,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )
            if (idea.createdAt.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = formatRelativeTime(idea.createdAt),
                    color = TextMuted,
                    fontSize = 11.sp
                )
            }
        }
    }
}

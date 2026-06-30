package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.BuildConfig
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.local.UserInfo
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.*
import com.lynnhub.app.ui.screen.panel.BackButton
import com.lynnhub.app.ui.screen.panel.ReturnSwipeDetector
import com.lynnhub.app.ui.screen.panel.SwipeHint
import com.lynnhub.app.ui.theme.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Lynx v6 设置子页面 —— 阶段4完整实现
 *
 * 8 个子页面均使用统一脚手架 SubPageScaffold（含返回按钮 + 标题 + 右滑返回手势）
 */

// ============ 公共脚手架 ============

@Composable
private fun SubPageScaffold(
    title: String,
    onBack: () -> Unit,
    content: @Composable ColumnScope.() -> Unit
) {
    val keyboardController = LocalSoftwareKeyboardController.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
            .pointerInput(Unit) {
                detectTapGestures(onTap = { keyboardController?.hide() })
            }
    ) {
        // 右滑返回手势检测层（Initial 阶段，不消费事件）
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
            // 标题栏（按视觉稿：panel-title 19px/700）
            Row(verticalAlignment = Alignment.CenterVertically) {
                BackButton(onClick = onBack)
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = title,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    modifier = Modifier.weight(1f)
                )
            }
            // 滑动提示独立一行（按视觉稿 panel-hint）
            SwipeHint(text = "← 右滑返回", modifier = Modifier.padding(start = 50.dp, top = 4.dp, bottom = 22.dp))
            content()
        }
    }
}

// ============ 公共 UI 组件 ============

@Composable
private fun FieldLabel(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        color = TextMuted,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.5.sp,
        modifier = Modifier.padding(bottom = 6.dp)
    )
}

@Composable
private fun TextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String = "",
    password: Boolean = false,
    trailing: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = {
            Text(placeholder, color = TextMuted, fontSize = 13.sp)
        },
        singleLine = true,
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        trailingIcon = trailing,
        textStyle = LocalTextStyle.current.copy(
            color = TextPrimary,
            fontSize = 13.sp
        ),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Primary.copy(alpha = 0.3f),
            unfocusedBorderColor = BorderHover,
            cursorColor = Primary,
            focusedContainerColor = Surface,
            unfocusedContainerColor = Surface
        ),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier.fillMaxWidth()
    )
}

@Composable
private fun ToggleSwitch(
    on: Boolean,
    onToggle: () -> Unit
) {
    Box(
        modifier = Modifier
            .width(44.dp)
            .height(24.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (on) Primary else SurfaceActive)
            .border(1.dp, if (on) Primary else BorderHover, RoundedCornerShape(999.dp))
            .clickable { onToggle() },
        contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart
    ) {
        Box(
            modifier = Modifier
                .padding(horizontal = 2.dp)
                .size(18.dp)
                .clip(CircleShape)
                .background(TextPrimary)
        )
    }
}

@Composable
private fun InfoCard(title: String, text: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Surface)
            .border(1.dp, BorderSubtle, RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        Text(title, fontSize = 13.sp, color = TextPrimary, fontWeight = FontWeight.SemiBold)
        Spacer(modifier = Modifier.height(4.dp))
        Text(text, fontSize = 12.sp, color = TextMuted, lineHeight = 18.sp)
    }
}

@Composable
private fun PrimaryButton(text: String, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (enabled) Brush.linearGradient(GradientPrimary)
                else Brush.linearGradient(listOf(TextMuted, TextMuted))
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun SecondaryButton(text: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Surface)
            .border(1.dp, BorderHover, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = TextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ToastMessage(text: String, color: Color = Agent) {
    if (text.isBlank()) return
    Box(
        modifier = Modifier
            .padding(vertical = 8.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.08f))
            .border(1.dp, color.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Text(text, color = color, fontSize = 12.sp)
    }
}

// ====================================================================
// 1. 个人资料 ProfilePage
// ====================================================================

data class ProfileUiState(
    val user: UserInfo? = null,
    val displayName: String = "",
    val isSaving: Boolean = false,
    val toast: String = ""
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val userPreferences: UserPreferences,
    private val apiService: ApiService
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            userPreferences.userFlow.collect { user ->
                _uiState.value = _uiState.value.copy(
                    user = user,
                    displayName = user?.displayName?.ifBlank { null } ?: user?.username ?: ""
                )
            }
        }
    }

    fun updateDisplayName(name: String) {
        _uiState.value = _uiState.value.copy(displayName = name)
    }

    fun save() {
        val current = _uiState.value
        val user = current.user ?: return
        _uiState.value = current.copy(isSaving = true)
        viewModelScope.launch {
            try {
                // 后端暂无 update profile API，仅本地保存
                userPreferences.saveAuth(
                    token = userPreferences.getToken() ?: "",
                    user = user.copy(displayName = current.displayName)
                )
                _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    toast = "已保存"
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    toast = "保存失败: ${e.message}"
                )
            }
        }
    }

    fun clearToast() {
        _uiState.value = _uiState.value.copy(toast = "")
    }
}

@Composable
fun ProfilePage(onBack: () -> Unit, viewModel: ProfileViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    SubPageScaffold(title = "个人资料", onBack = onBack) {
        // 头像
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(GradientPrimary)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = (uiState.displayName.firstOrNull()?.toString())
                        ?: (uiState.user?.username?.firstOrNull()?.toString()) ?: "U",
                    color = TextPrimary,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text("点击更换头像", color = TextMuted, fontSize = 10.sp)
        }

        Spacer(modifier = Modifier.height(28.dp))

        // 昵称
        FieldLabel("昵称")
        TextField(
            value = uiState.displayName,
            onValueChange = viewModel::updateDisplayName,
            placeholder = "输入昵称"
        )

        Spacer(modifier = Modifier.height(16.dp))

        // 职业空间（只读）
        FieldLabel("职业空间")
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Surface)
                .border(1.dp, BorderHover, RoundedCornerShape(12.dp))
                .padding(horizontal = 12.dp, vertical = 14.dp)
        ) {
            Text(
                text = uiState.user?.role?.ifBlank { "未设置" } ?: "未设置",
                color = TextMuted,
                fontSize = 13.sp
            )
        }

        Spacer(modifier = Modifier.height(8.dp))
        ToastMessage(uiState.toast)

        Spacer(modifier = Modifier.height(16.dp))
        PrimaryButton(
            text = if (uiState.isSaving) "保存中..." else "保存",
            enabled = !uiState.isSaving,
            onClick = viewModel::save
        )
    }
}

// ====================================================================
// 2. AI Key AiKeyPage
// ====================================================================

data class AiKeyUiState(
    val providers: List<AiModelDto> = emptyList(),
    val defaultProvider: String? = null,
    val isLoading: Boolean = false,
    val toast: String = ""
)

@HiltViewModel
class AiKeyViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {
    private val _uiState = MutableStateFlow(AiKeyUiState())
    val uiState: StateFlow<AiKeyUiState> = _uiState.asStateFlow()

    init { loadModels() }

    fun loadModels() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            try {
                val resp = apiService.getAiModels()
                _uiState.value = AiKeyUiState(
                    providers = resp.providers,
                    defaultProvider = resp.defaultProvider,
                    isLoading = false,
                    toast = "已加载 ${resp.providers.size} 个服务商"
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    toast = "加载失败: ${e.message}"
                )
            }
        }
    }

    fun clearToast() {
        _uiState.value = _uiState.value.copy(toast = "")
    }
}

@Composable
fun AiKeyPage(onBack: () -> Unit, viewModel: AiKeyViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    var showKeyFor by remember { mutableStateOf<String?>(null) }

    SubPageScaffold(title = "AI Key", onBack = onBack) {
        if (uiState.isLoading) {
            Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
            }
        }

        // 服务商列表
        uiState.providers.forEach { provider ->
            val isDefault = provider.id == uiState.defaultProvider
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Surface)
                    .border(
                        1.dp,
                        if (isDefault) Primary.copy(alpha = 0.3f) else BorderSubtle,
                        RoundedCornerShape(16.dp)
                    )
                    .padding(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        provider.name.ifBlank { provider.id },
                        color = TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f)
                    )
                    if (isDefault) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(Primary.copy(alpha = 0.12f))
                                .padding(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("默认", color = Primary, fontSize = 10.sp)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "模型: ${provider.model.ifBlank { "未知" }}",
                    color = TextMuted,
                    fontSize = 11.sp
                )
                Text(
                    text = if (provider.available) "状态: 可用" else "状态: 未配置",
                    color = if (provider.available) Agent else Think,
                    fontSize = 11.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (showKeyFor == provider.id) "已配置的 Key 已显示" else "••••••••（出于安全考虑，App 端不展示完整 Key）",
                        color = TextMuted,
                        fontSize = 11.sp,
                        modifier = Modifier.weight(1f)
                    )
                    Icon(
                        imageVector = if (showKeyFor == provider.id) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        contentDescription = "切换显示",
                        tint = TextMuted,
                        modifier = Modifier
                            .size(16.dp)
                            .clickable {
                                showKeyFor = if (showKeyFor == provider.id) null else provider.id
                            }
                    )
                }
            }
        }

        if (uiState.providers.isEmpty() && !uiState.isLoading) {
            Box(
                Modifier.fillMaxWidth().padding(40.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("暂无配置，请在 Web 端配置 AI 服务商", color = TextMuted, fontSize = 12.sp)
            }
        }

        ToastMessage(uiState.toast)
        Spacer(modifier = Modifier.height(12.dp))
        InfoCard(
            title = "提示",
            text = "出于安全考虑，AI Key 配置仅在 Web 端管理。App 端可查看服务商与可用性。"
        )
    }
}

// ====================================================================
// 3. 设备管理 DevicesPage
// ====================================================================

data class DevicesUiState(
    val status: HermesStatusResponse? = null,
    val isLoading: Boolean = false,
    val toast: String = ""
)

@HiltViewModel
class DevicesViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {
    private val _uiState = MutableStateFlow(DevicesUiState())
    val uiState: StateFlow<DevicesUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            try {
                val resp = apiService.getHermesStatus()
                _uiState.value = DevicesUiState(status = resp, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    toast = "加载失败: ${e.message}"
                )
            }
        }
    }

    fun clearToast() {
        _uiState.value = _uiState.value.copy(toast = "")
    }
}

@Composable
fun DevicesPage(onBack: () -> Unit, viewModel: DevicesViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    SubPageScaffold(title = "已配对设备", onBack = onBack) {
        if (uiState.isLoading) {
            Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
            }
        }

        uiState.status?.let { status ->
            val connected = status.connected || (status.config?.status == "running")
            val deviceName = "PC · Hermes Agent"
            val version = status.installVersion ?: status.version ?: "未知版本"
            val task = if (connected) "运行中" else status.config?.status ?: "未启动"

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Surface)
                    .border(
                        1.dp,
                        if (connected) Agent.copy(alpha = 0.3f) else BorderSubtle,
                        RoundedCornerShape(16.dp)
                    )
                    .padding(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(if (connected) Agent else TextMuted)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        deviceName,
                        color = TextPrimary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        if (connected) "在线" else "离线",
                        color = if (connected) Agent else TextMuted,
                        fontSize = 11.sp
                    )
                }
                Spacer(modifier = Modifier.height(10.dp))
                Text("版本: $version", color = TextMuted, fontSize = 11.sp)
                Text("端点: ${status.config?.endpoint ?: "未配置"}", color = TextMuted, fontSize = 11.sp)
                Text("当前任务: $task", color = TextMuted, fontSize = 11.sp)
                if (!status.installed) {
                    Text("Agent 未安装", color = Danger, fontSize = 11.sp)
                }
            }
        }

        if (uiState.status == null && !uiState.isLoading) {
            Box(
                Modifier.fillMaxWidth().padding(40.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("暂无配对设备", color = TextMuted, fontSize = 12.sp)
            }
        }

        ToastMessage(uiState.toast)
        Spacer(modifier = Modifier.height(16.dp))
        InfoCard(
            title = "添加设备",
            text = "请前往 Web 端扫码配对新设备，App 端暂不支持主动配对。"
        )
    }
}

// ====================================================================
// 4. 记忆图谱 MemoryPage
// ====================================================================

data class MemoryUiState(
    val nodes: List<MemoryNodeDto> = emptyList(),
    val query: String = "",
    val isSearching: Boolean = false,
    val isLoading: Boolean = false,
    val expandedId: String? = null,
    val toast: String = ""
)

@HiltViewModel
class MemoryViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {
    private val _uiState = MutableStateFlow(MemoryUiState())
    val uiState: StateFlow<MemoryUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            try {
                val resp = apiService.getMemory()
                _uiState.value = _uiState.value.copy(
                    nodes = resp.nodes,
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

    fun search(q: String) {
        _uiState.value = _uiState.value.copy(query = q, isSearching = true)
        viewModelScope.launch {
            try {
                val resp = if (q.isBlank()) {
                    apiService.getMemory().let { MemorySearchResponse() }
                } else {
                    apiService.searchMemory(q)
                }
                val nodes = if (q.isBlank()) {
                    apiService.getMemory().nodes
                } else {
                    resp.results.mapIndexed { i, r ->
                        MemoryNodeDto(
                            id = r.id,
                            label = r.label,
                            type = r.type,
                            color = null,
                            strength = r.score,
                            connections = emptyList(),
                            fullContent = r.source,
                            score = r.score,
                            createdAt = ""
                        )
                    }
                }
                _uiState.value = _uiState.value.copy(
                    nodes = nodes,
                    isSearching = false
                )
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
        _uiState.value = _uiState.value.copy(toast = "")
    }
}

private fun typeColor(type: String): Color = when (type) {
    "idea" -> Primary
    "task" -> Agent
    "cognition" -> Think
    "conversation" -> TextMuted
    else -> Primary
}

private fun typeLabel(type: String): String = when (type) {
    "idea" -> "灵感"
    "task" -> "任务"
    "cognition" -> "认知"
    "conversation" -> "对话"
    else -> type
}

@Composable
fun MemoryPage(onBack: () -> Unit, viewModel: MemoryViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    SubPageScaffold(title = "记忆图谱", onBack = onBack) {
        // 搜索框
        TextField(
            value = uiState.query,
            onValueChange = viewModel::search,
            placeholder = "搜索记忆...",
            trailing = {
                if (uiState.isSearching) {
                    CircularProgressIndicator(
                        color = Primary,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(16.dp)
                    )
                } else {
                    Icon(Icons.Filled.Search, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
                }
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (uiState.isLoading) {
            Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
            }
        }

        // 节点列表
        uiState.nodes.forEach { node ->
            val expanded = uiState.expandedId == node.id
            val color = typeColor(node.type)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Surface)
                    .border(1.dp, color.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                    .clickable { viewModel.toggleExpand(node.id) }
                    .padding(12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(color)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        node.label.ifBlank { "未命名" },
                        color = TextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        typeLabel(node.type),
                        color = color,
                        fontSize = 10.sp
                    )
                }
                if (expanded) {
                    Spacer(modifier = Modifier.height(8.dp))
                    if (node.fullContent.isNotBlank()) {
                        Text(
                            node.fullContent,
                            color = TextMuted,
                            fontSize = 11.sp,
                            lineHeight = 16.sp
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "关联: ${node.connections.size} · 强度: ${"%.2f".format(node.strength)}",
                        color = TextMuted,
                        fontSize = 10.sp
                    )
                }
            }
        }

        if (uiState.nodes.isEmpty() && !uiState.isLoading) {
            Box(
                Modifier.fillMaxWidth().padding(40.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    if (uiState.query.isBlank()) "暂无记忆" else "未找到相关记忆",
                    color = TextMuted,
                    fontSize = 12.sp
                )
            }
        }

        ToastMessage(uiState.toast)
    }
}

// ====================================================================
// 5. 认知库 CognitionPage
// ====================================================================

data class CognitionUiState(
    val cognitions: List<CognitionDto> = emptyList(),
    val category: String = "method",  // method | experience | prompt
    val query: String = "",
    val isLoading: Boolean = false,
    val toast: String = ""
)

@HiltViewModel
class CognitionViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {
    private val _uiState = MutableStateFlow(CognitionUiState())
    val uiState: StateFlow<CognitionUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        _uiState.value = _uiState.value.copy(isLoading = true)
        viewModelScope.launch {
            try {
                val resp = apiService.getCognitions()
                _uiState.value = _uiState.value.copy(
                    cognitions = resp.cognitions,
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

    fun setCategory(category: String) {
        _uiState.value = _uiState.value.copy(category = category)
    }

    fun setQuery(q: String) {
        _uiState.value = _uiState.value.copy(query = q)
    }

    fun clearToast() {
        _uiState.value = _uiState.value.copy(toast = "")
    }
}

@Composable
fun CognitionPage(onBack: () -> Unit, viewModel: CognitionViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val categories = listOf("method" to "方法", "experience" to "经验", "prompt" to "提示词")

    val filtered = uiState.cognitions
        .filter { it.type == uiState.category }
        .filter { uiState.query.isBlank() || it.content.contains(uiState.query, ignoreCase = true) }

    SubPageScaffold(title = "认知库", onBack = onBack) {
        // 分类胶囊
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(999.dp))
                .background(Surface)
                .border(1.dp, BorderHover, RoundedCornerShape(999.dp))
                .padding(4.dp)
        ) {
            categories.forEach { (key, label) ->
                val selected = uiState.category == key
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (selected) Primary else Color.Transparent)
                        .clickable { viewModel.setCategory(key) }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        label,
                        color = if (selected) TextPrimary else TextMuted,
                        fontSize = 12.sp,
                        fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 搜索框
        TextField(
            value = uiState.query,
            onValueChange = viewModel::setQuery,
            placeholder = "搜索...",
            trailing = {
                Icon(Icons.Filled.Search, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
            }
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (uiState.isLoading) {
            Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
            }
        }

        // 列表
        filtered.forEach { cog ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Surface)
                    .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Text(
                    cog.content.take(60).let { if (cog.content.length > 60) "$it..." else it },
                    color = TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    cog.createdAt.take(10),
                    color = TextMuted,
                    fontSize = 10.sp
                )
            }
        }

        if (filtered.isEmpty() && !uiState.isLoading) {
            Box(
                Modifier.fillMaxWidth().padding(40.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("暂无内容", color = TextMuted, fontSize = 12.sp)
            }
        }

        ToastMessage(uiState.toast)
    }
}

// ====================================================================
// 6. 通知偏好 NotificationPage（纯本地状态）
// ====================================================================

@Composable
fun NotificationPage(onBack: () -> Unit) {
    var level by remember { mutableStateOf("all") }  // all | important | approval
    var voiceBroadcast by remember { mutableStateOf(true) }
    var continuousChat by remember { mutableStateOf(false) }
    var pushPeriod by remember { mutableStateOf("all") }  // all | 8-22

    SubPageScaffold(title = "通知偏好", onBack = onBack) {
        FieldLabel("通知档位")
        Column(modifier = Modifier.padding(bottom = 16.dp)) {
            listOf("all" to "全部", "important" to "仅重要", "approval" to "仅审批").forEach { (key, label) ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (level == key) Primary.copy(alpha = 0.08f) else Surface)
                        .border(
                            1.dp,
                            if (level == key) Primary.copy(alpha = 0.3f) else BorderSubtle,
                            RoundedCornerShape(12.dp)
                        )
                        .clickable { level = key }
                        .padding(horizontal = 12.dp, vertical = 12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .clip(CircleShape)
                            .border(1.dp, if (level == key) Primary else TextMuted, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        if (level == key) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(Primary)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(label, color = TextPrimary, fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.height(6.dp))
            }
        }

        // 开关组
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp)
        ) {
            Text("语音播报", color = TextPrimary, fontSize = 13.sp, modifier = Modifier.weight(1f))
            ToggleSwitch(on = voiceBroadcast) { voiceBroadcast = !voiceBroadcast }
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp)
        ) {
            Text("连续对话", color = TextPrimary, fontSize = 13.sp, modifier = Modifier.weight(1f))
            ToggleSwitch(on = continuousChat) { continuousChat = !continuousChat }
        }

        Spacer(modifier = Modifier.height(16.dp))
        FieldLabel("推送时段")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(999.dp))
                .background(Surface)
                .border(1.dp, BorderHover, RoundedCornerShape(999.dp))
                .padding(4.dp)
        ) {
            listOf("all" to "全天", "8-22" to "8:00-22:00").forEach { (key, label) ->
                val selected = pushPeriod == key
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (selected) Primary else Color.Transparent)
                        .clickable { pushPeriod = key }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        label,
                        color = if (selected) TextPrimary else TextMuted,
                        fontSize = 12.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))
        InfoCard(
            title = "说明",
            text = "通知偏好保存在本地，重启 App 后生效。云端推送策略以 Web 端设置为准。"
        )
    }
}

// ====================================================================
// 7. 检查更新 UpdatePage
// ====================================================================

data class UpdateUiState(
    val currentVersion: String = BuildConfig.VERSION_NAME,
    val latestVersion: String = "",
    val isChecking: Boolean = false,
    val isChecked: Boolean = false,
    val toast: String = ""
)

@HiltViewModel
class UpdateViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {
    private val _uiState = MutableStateFlow(UpdateUiState())
    val uiState: StateFlow<UpdateUiState> = _uiState.asStateFlow()

    init { checkUpdate() }

    fun checkUpdate() {
        _uiState.value = _uiState.value.copy(isChecking = true)
        viewModelScope.launch {
            try {
                val resp = apiService.mobileConfig()
                _uiState.value = _uiState.value.copy(
                    latestVersion = resp.latestVersion,
                    isChecking = false,
                    isChecked = true
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isChecking = false,
                    isChecked = true,
                    toast = "检查失败: ${e.message}"
                )
            }
        }
    }

    fun clearToast() {
        _uiState.value = _uiState.value.copy(toast = "")
    }
}

@Composable
fun UpdatePage(onBack: () -> Unit, viewModel: UpdateViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val hasUpdate = uiState.isChecked && uiState.latestVersion > uiState.currentVersion

    SubPageScaffold(title = "检查更新", onBack = onBack) {
        // 版本号
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                "v${uiState.currentVersion}",
                color = TextPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                "Build ${BuildConfig.VERSION_CODE}",
                color = TextMuted,
                fontSize = 11.sp
            )
        }

        // 更新状态
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Surface)
                .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp))
                .padding(12.dp)
        ) {
            Icon(
                imageVector = if (hasUpdate) Icons.Filled.SystemUpdate else Icons.Filled.CheckCircle,
                contentDescription = null,
                tint = if (hasUpdate) Think else Agent,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                when {
                    uiState.isChecking -> "正在检查..."
                    hasUpdate -> "发现新版本 v${uiState.latestVersion}"
                    uiState.isChecked -> "已是最新版本"
                    else -> "未检查"
                },
                color = if (hasUpdate) Think else Agent,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        PrimaryButton(
            text = if (uiState.isChecking) "检查中..." else if (hasUpdate) "立即更新" else "检查更新",
            enabled = !uiState.isChecking,
            onClick = viewModel::checkUpdate
        )

        ToastMessage(uiState.toast)

        Spacer(modifier = Modifier.height(20.dp))

        // 更新日志
        InfoCard(
            title = "最近更新",
            text = "v0.1.0\n· Lynx v6 极简 UI 重构\n· 四向手势交互\n· 单主页 + 浮层架构\n· 灵感速记/任务视图/AI 对话/Agent 远程"
        )
    }
}

// ====================================================================
// 8. 关于我们 AboutPage
// ====================================================================

@Composable
fun AboutPage(onBack: () -> Unit) {
    SubPageScaffold(title = "关于我们", onBack = onBack) {
        // Logo
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(GradientPrimary)),
                contentAlignment = Alignment.Center
            ) {
                Text("🦊", fontSize = 32.sp)
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                "Lynx",
                color = TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text("v${BuildConfig.VERSION_NAME}", color = TextMuted, fontSize = 12.sp)
            Text("Build ${BuildConfig.VERSION_CODE}", color = TextMuted, fontSize = 10.sp)
        }

        Spacer(modifier = Modifier.height(20.dp))

        // 链接项
        AboutRow(icon = Icons.Filled.PrivacyTip, label = "隐私政策") {
            // TODO: 跳转外部浏览器
        }
        AboutRow(icon = Icons.Filled.Description, label = "用户协议") {
            // TODO: 跳转外部浏览器
        }
        AboutRow(icon = Icons.Filled.Code, label = "开源许可") {
            // TODO: 展开列表
        }

        Spacer(modifier = Modifier.height(24.dp))
        InfoCard(
            title = "Lynx v6",
            text = "极简 · 人性 · 即时反馈。Lynx 是基于 HermesAgent 技术的超级助手，支持桌面/Shell/CLI/浏览器/应用控制、自主学习（重复 2x → 技能）、自我生长（记忆提取）、本地执行与隐私保护。"
        )
    }
}

@Composable
private fun AboutRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp)
    ) {
        Icon(icon, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            label,
            color = TextPrimary,
            fontSize = 13.sp,
            modifier = Modifier.weight(1f)
        )
        Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
    }
}

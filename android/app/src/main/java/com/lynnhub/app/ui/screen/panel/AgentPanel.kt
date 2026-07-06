package com.lynnhub.app.ui.screen.panel

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.HermesReportDto
import com.lynnhub.app.data.remote.dto.HermesStatusResponse
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.BorderHover
import com.lynnhub.app.ui.theme.Danger
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.Surface
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import com.lynnhub.app.ui.theme.Think
import com.lynnhub.app.ui.theme.Void
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

// ============ Agent 远程浮层（右滑进入，左滑返回） ============
// 设计要点：
// 1. 设备卡片：状态点 + 设备名 "Lynn-PC" + 当前任务（最近报告标题）
// 2. 快捷指令：3 个胶囊（整理灵感/跑巡检/生成日报），按颜色区分指令类型
// 3. 待审批卡片：红色边框，描述取最近报告 content 前 80 字，"拒绝"/"批准" 两个按钮
// 4. Agent 未连接时显示提示，toast 2s 自动清除
//
// PC 在线检测改造（v1.0.20+）：
// - 旧方案：调用 /api/hermes/status 仅查数据库配置，无法反映真实 PC 在线状态
// - 新方案：注入 WsGatewayClient 实时订阅 + 调用 /devices 查询在线 PC 列表
//           通过 /dispatch 下发指令到指定 PC，PC 执行后通过 WS 回传进度

data class AgentPanelUiState(
    val status: HermesStatusResponse? = null,
    val reports: List<HermesReportDto> = emptyList(),
    val onlineDevices: List<com.lynnhub.app.data.remote.dto.OnlineDeviceDto> = emptyList(),
    val wsConnected: Boolean = false,
    val isExecuting: Boolean = false,
    val toast: String? = null
) {
    /** 真实 PC 在线状态：WS 已连且有在线设备，或 devices 接口返回非空 */
    val pcOnline: Boolean get() = wsConnected || onlineDevices.isNotEmpty()
}

@HiltViewModel
class AgentPanelViewModel @Inject constructor(
    private val apiService: ApiService,
    private val wsGatewayClient: com.lynnhub.app.data.remote.WsGatewayClient,
    private val userPreferences: com.lynnhub.app.data.local.UserPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(AgentPanelUiState())
    val uiState: StateFlow<AgentPanelUiState> = _uiState.asStateFlow()

    init {
        // 1. 启动 WS 连接（订阅 PC 端 command-update 进度）
        wsGatewayClient.start()
        // 2. 监听 WS 连接状态
        viewModelScope.launch {
            wsGatewayClient.connectionState.collect { state ->
                _uiState.update { it.copy(wsConnected = state == com.lynnhub.app.data.remote.WsGatewayClient.ConnectionState.CONNECTED) }
            }
        }
        // 3. 加载历史报告 + 在线设备列表
        loadAll()
    }

    private fun loadAll() {
        viewModelScope.launch {
            try {
                val resp = apiService.getHermesReports(page = 1, pageSize = 3)
                _uiState.update { it.copy(reports = resp.reports) }
            } catch (_: Exception) {
                // 静默失败
            }
        }
        refreshOnlineDevices()
    }

    /** 查询当前用户在线 PC 设备列表（走 WS Gateway 的 HTTP 端点） */
    fun refreshOnlineDevices() {
        viewModelScope.launch {
            try {
                val userId = userPreferences.userFlow.let { flow ->
                    var id: String? = null
                    flow.collect { if (it != null) { id = it.id; return@collect } }
                    id
                }
                if (userId != null) {
                    val resp = apiService.getOnlineDevices(userId)
                    _uiState.update { it.copy(onlineDevices = resp.devices) }
                }
            } catch (_: Exception) {
                // 静默失败：可能 WS Gateway 未运行或不支持 /devices
            }
        }
    }

    fun executeCommand(prompt: String) {
        if (_uiState.value.isExecuting) return
        _uiState.update { it.copy(isExecuting = true) }
        viewModelScope.launch {
            try {
                val userId = userPreferences.userFlow.let { flow ->
                    var id: String? = null
                    flow.collect { if (it != null) { id = it.id; return@collect } }
                    id
                }
                if (userId == null) {
                    _uiState.update { it.copy(isExecuting = false, toast = "未登录") }
                    return@launch
                }
                // 通过 WS Gateway /dispatch 下发到 PC
                val targetDeviceId = _uiState.value.onlineDevices.firstOrNull()?.deviceId
                val resp = apiService.dispatchRemoteCommand(
                    com.lynnhub.app.data.remote.dto.DispatchRequest(
                        userId = userId,
                        command = prompt,
                        targetDeviceId = targetDeviceId
                    )
                )
                val msg = if (resp.dispatched) {
                    "指令已下发到 PC" + (resp.commandId?.let { "（任务ID: ${it.take(8)}）" } ?: "")
                } else {
                    resp.reason ?: "下发失败：PC 不在线"
                }
                _uiState.update { it.copy(isExecuting = false, toast = msg) }
                // 订阅指令进度
                resp.commandId?.let { wsGatewayClient.watchCommand(it) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isExecuting = false, toast = "下发失败: ${e.message ?: "网络错误"}") }
            }
        }
    }

    /**
     * 审批操作：通过 WS Gateway 下发 approve / reject 指令到 PC
     * @param action "approve" 或 "reject"
     * @param reportId 关联的报告 ID（可选）
     */
    fun approveOrReject(action: String, reportId: String? = null) {
        if (_uiState.value.isExecuting) return
        _uiState.update { it.copy(isExecuting = true) }
        viewModelScope.launch {
            try {
                val userId = userPreferences.userFlow.let { flow ->
                    var id: String? = null
                    flow.collect { if (it != null) { id = it.id; return@collect } }
                    id
                }
                if (userId == null) {
                    _uiState.update { it.copy(isExecuting = false, toast = "未登录") }
                    return@launch
                }

                val targetDeviceId = _uiState.value.onlineDevices.firstOrNull()?.deviceId
                val command = if (reportId != null) "${action}:${reportId}" else action
                val resp = apiService.dispatchRemoteCommand(
                    com.lynnhub.app.data.remote.dto.DispatchRequest(
                        userId = userId,
                        command = command,
                        targetDeviceId = targetDeviceId
                    )
                )
                val msg = if (resp.dispatched) {
                    val label = if (action == "approve") "批准" else "拒绝"
                    "已${label}，指令已下发到 PC" + (resp.commandId?.let { "（任务ID: ${it.take(8)}）" } ?: "")
                } else {
                    resp.reason ?: "下发失败：PC 不在线"
                }
                _uiState.update { it.copy(isExecuting = false, toast = msg) }
                resp.commandId?.let { wsGatewayClient.watchCommand(it) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isExecuting = false, toast = "审批失败: ${e.message ?: "网络错误"}") }
            }
        }
    }

    fun toast(msg: String) {
        _uiState.update { it.copy(toast = msg) }
    }

    fun clearToast() {
        _uiState.update { it.copy(toast = null) }
    }
}

@Composable
fun AgentPanel(
    onBack: () -> Unit,
    viewModel: AgentPanelViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val statusInfo = remember(state.status) { state.status.toStatusInfo() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // 反向滑动检测层（左滑返回）
        ReturnSwipeDetector(
            returnDirection = "left",
            onReturn = onBack,
            modifier = Modifier.fillMaxSize()
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 22.dp, end = 22.dp, top = 16.dp, bottom = 24.dp)
        ) {
            PanelHeader(title = "Agent", onBack = onBack, swipeHint = "→ 左滑返回")
            Spacer(modifier = Modifier.height(0.dp))

            // PC 在线状态提示
            if (!state.pcOnline) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = if (state.wsConnected) "WS 已连接，但未发现在线 PC" else "PC 未连接",
                            color = TextMuted,
                            fontSize = 13.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "请先在 PC 端启动奇思桌面端并登录",
                            color = TextMuted.copy(alpha = 0.6f),
                            fontSize = 11.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        // 手动刷新按钮
                        Text(
                            text = "刷新设备列表",
                            color = Primary,
                            fontSize = 12.sp,
                            modifier = Modifier.clickable { viewModel.refreshOnlineDevices() }
                        )
                    }
                }
            } else {
                // 设备卡片
                DeviceCard(
                    status = state.status,
                    statusInfo = statusInfo,
                    latestReport = state.reports.firstOrNull()
                )

                Spacer(modifier = Modifier.height(12.dp))

                // 快捷指令：3 个胶囊，按颜色区分
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    QuickChipColored(
                        text = "整理灵感",
                        accent = Primary,
                        enabled = !state.isExecuting,
                        onClick = { viewModel.executeCommand("整理灵感") }
                    )
                    QuickChipColored(
                        text = "跑巡检",
                        accent = Agent,
                        enabled = !state.isExecuting,
                        onClick = { viewModel.executeCommand("跑巡检") }
                    )
                    QuickChipColored(
                        text = "生成日报",
                        accent = Think,
                        enabled = !state.isExecuting,
                        onClick = { viewModel.executeCommand("生成日报") }
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // 待审批卡片
                ApprovalCard(
                    latestReport = state.reports.firstOrNull(),
                    isExecuting = state.isExecuting,
                    onApprove = {
                        val reportId = state.reports.firstOrNull()?.id
                        viewModel.approveOrReject("approve", reportId)
                    },
                    onReject = {
                        val reportId = state.reports.firstOrNull()?.id
                        viewModel.approveOrReject("reject", reportId)
                    }
                )
            }
        }

        // toast：2s 自动清除
        state.toast?.let { msg ->
            LaunchedEffect(msg) {
                delay(2000)
                viewModel.clearToast()
            }
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.BottomCenter
            ) {
                Text(
                    text = msg,
                    color = TextPrimary,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .padding(bottom = 32.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Surface)
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                )
            }
        }
    }
}

// ============ Agent 状态信息 ============
private data class AgentStatusInfo(
    val label: String,
    val color: Color,
    val connected: Boolean
)

private fun HermesStatusResponse?.toStatusInfo(): AgentStatusInfo {
    if (this == null) return AgentStatusInfo("未安装", TextMuted, false)
    return when {
        connected -> AgentStatusInfo("在线", Agent, true)
        config?.status == "running" -> AgentStatusInfo("运行中", Think, true)
        installed -> AgentStatusInfo("待启动", TextMuted, false)
        else -> AgentStatusInfo("未安装", TextMuted, false)
    }
}

// ============ 设备卡片 ============
@Composable
private fun DeviceCard(
    status: HermesStatusResponse?,
    statusInfo: AgentStatusInfo,
    latestReport: HermesReportDto?
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Surface)
            .border(1.dp, BorderHover, RoundedCornerShape(14.dp))
            .padding(14.dp)
    ) {
        // 状态行：状态点 + 设备名 + 右侧状态文字
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(statusInfo.color)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Lynn-PC",
                color = TextPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = statusInfo.label,
                color = statusInfo.color,
                fontSize = 12.sp
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // 版本或 endpoint
        val versionOrEndpoint = status?.version
            ?: status?.config?.endpoint
            ?: "—"
        Text(
            text = versionOrEndpoint,
            color = TextMuted,
            fontSize = 11.sp
        )

        // 当前任务：最近报告标题
        if (latestReport != null && latestReport.title.isNotBlank()) {
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "当前任务：",
                    color = TextMuted,
                    fontSize = 11.sp
                )
                Text(
                    text = latestReport.title,
                    color = TextPrimary,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

// ============ 快捷指令胶囊（带强调色） ============
@Composable
private fun QuickChipColored(
    text: String,
    accent: Color,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Text(
        text = text,
        color = if (enabled) accent else TextMuted,
        fontSize = 11.sp,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Surface)
            .border(1.dp, accent.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp)
    )
}

// ============ 待审批卡片 ============
@Composable
private fun ApprovalCard(
    latestReport: HermesReportDto?,
    isExecuting: Boolean,
    onApprove: () -> Unit,
    onReject: () -> Unit
) {
    val description = latestReport?.content?.take(80)?.ifBlank { "暂无审批内容" }
        ?: "暂无审批内容"

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Surface)
            .border(1.dp, Danger.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
            .padding(14.dp)
    ) {
        // 标题
        Text(
            text = "⚠ 待审批",
            color = Danger,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold
        )

        Spacer(modifier = Modifier.height(8.dp))

        // 描述
        Text(
            text = description,
            color = TextPrimary,
            fontSize = 12.sp,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis
        )

        Spacer(modifier = Modifier.height(12.dp))

        // 两个按钮：拒绝 + 批准
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .border(1.dp, Danger.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                    .clickable(enabled = !isExecuting, onClick = onReject)
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "拒绝",
                    color = Danger,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Agent)
                    .clickable(enabled = !isExecuting, onClick = onApprove)
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "批准",
                    color = Void,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}


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
import com.lynnhub.app.data.remote.dto.HermesExecuteRequest
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

data class AgentPanelUiState(
    val status: HermesStatusResponse? = null,
    val reports: List<HermesReportDto> = emptyList(),
    val isExecuting: Boolean = false,
    val toast: String? = null
)

@HiltViewModel
class AgentPanelViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(AgentPanelUiState())
    val uiState: StateFlow<AgentPanelUiState> = _uiState.asStateFlow()

    init {
        loadAll()
    }

    private fun loadAll() {
        viewModelScope.launch {
            try {
                val status = apiService.getHermesStatus()
                _uiState.update { it.copy(status = status) }
            } catch (_: Exception) {
                // 静默失败
            }
        }
        viewModelScope.launch {
            try {
                val resp = apiService.getHermesReports(page = 1, pageSize = 3)
                _uiState.update { it.copy(reports = resp.reports) }
            } catch (_: Exception) {
                // 静默失败
            }
        }
    }

    fun executeCommand(prompt: String) {
        if (_uiState.value.isExecuting) return
        _uiState.update { it.copy(isExecuting = true) }
        viewModelScope.launch {
            try {
                val resp = apiService.hermesExecute(
                    HermesExecuteRequest(prompt = prompt, mode = "auto")
                )
                val msg = if (resp.success) {
                    if (resp.output.isNotBlank()) {
                        "指令已发送：" + resp.output.take(100)
                    } else {
                        "指令已发送"
                    }
                } else {
                    "执行失败"
                }
                _uiState.update { it.copy(isExecuting = false, toast = msg) }
                // 重新加载状态
                loadAll()
            } catch (_: Exception) {
                _uiState.update { it.copy(isExecuting = false, toast = "执行失败") }
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
            .background(Void)
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
                .systemBarsPadding()
                .padding(start = 22.dp, end = 22.dp, top = 66.dp, bottom = 110.dp)
        ) {
            PanelHeader(title = "Agent", onBack = onBack, swipeHint = "→ 左滑返回")
            Spacer(modifier = Modifier.height(0.dp))

            // Agent 未连接提示
            if (!statusInfo.connected) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Agent 未连接，请先在 PC 端启动",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
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
                    onApprove = { viewModel.toast("已处理") },
                    onReject = { viewModel.toast("已处理") }
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


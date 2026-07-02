package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.HermesStatusResponse
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.BorderSubtle
import com.lynnhub.app.ui.theme.Danger
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.Surface
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** 3. 设备管理 */
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

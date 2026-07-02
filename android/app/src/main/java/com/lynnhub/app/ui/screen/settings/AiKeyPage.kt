package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.AiModelDto
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.BorderSubtle
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.Surface
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import com.lynnhub.app.ui.theme.Think
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** 2. AI Key */
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

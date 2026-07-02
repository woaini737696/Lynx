package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.Icon
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
import com.lynnhub.app.BuildConfig
import com.lynnhub.app.data.remote.ApiService
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

/** 7. 检查更新 */
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

package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.local.UserInfo
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.ui.theme.GradientPrimary
import com.lynnhub.app.ui.theme.BorderHover
import com.lynnhub.app.ui.theme.Surface
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** 1. 个人资料 */
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

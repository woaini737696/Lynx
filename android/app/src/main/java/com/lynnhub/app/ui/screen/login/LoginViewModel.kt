package com.lynnhub.app.ui.screen.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.LoginRequest
import com.lynnhub.app.data.remote.interceptor.DynamicBaseUrlInterceptor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val username: String = "",
    val password: String = "",
    val baseUrl: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val showServerConfig: Boolean = false,
    val loginSuccess: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val apiService: ApiService,
    private val userPreferences: UserPreferences,
    private val dynamicBaseUrlInterceptor: DynamicBaseUrlInterceptor
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val baseUrl = userPreferences.getBaseUrl()
            _uiState.value = _uiState.value.copy(baseUrl = baseUrl)
            // 同步到拦截器，确保后续请求使用正确的地址
            dynamicBaseUrlInterceptor.setBaseUrl(baseUrl)
        }
    }

    fun updateUsername(value: String) {
        _uiState.value = _uiState.value.copy(username = value, error = null)
    }

    fun updatePassword(value: String) {
        _uiState.value = _uiState.value.copy(password = value, error = null)
    }

    fun updateBaseUrl(value: String) {
        _uiState.value = _uiState.value.copy(baseUrl = value, error = null)
    }

    fun toggleServerConfig() {
        _uiState.value = _uiState.value.copy(showServerConfig = !_uiState.value.showServerConfig)
    }

    fun login() {
        val state = _uiState.value
        if (state.username.isBlank() || state.password.isBlank()) {
            _uiState.value = state.copy(error = "请输入手机号和密码")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, error = null)
            try {
                // 先保存 baseUrl 并同步到拦截器
                val baseUrl = normalizeUrl(state.baseUrl)
                userPreferences.setBaseUrl(baseUrl)
                dynamicBaseUrlInterceptor.setBaseUrl(baseUrl)

                val response = apiService.login(
                    LoginRequest(phone = state.username.trim(), password = state.password)
                )
                userPreferences.saveAuth(
                    token = response.token,
                    user = com.lynnhub.app.data.local.UserInfo(
                        id = response.user.id,
                        username = response.user.username,
                        displayName = response.user.displayName ?: response.user.username,
                        role = response.user.role
                    )
                )
                _uiState.value = state.copy(
                    isLoading = false,
                    loginSuccess = true
                )
            } catch (e: Exception) {
                _uiState.value = state.copy(
                    isLoading = false,
                    error = e.message ?: "登录失败，请检查网络或服务器地址"
                )
            }
        }
    }

    /** 确保 URL 以 http:// 或 https:// 开头且以 / 结尾 */
    private fun normalizeUrl(url: String): String {
        var normalized = url.trim()
        if (normalized.isEmpty()) return com.lynnhub.app.util.Constants.DEFAULT_BASE_URL
        if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
            normalized = "http://$normalized"
        }
        if (!normalized.endsWith("/")) normalized = "$normalized/"
        return normalized
    }
}

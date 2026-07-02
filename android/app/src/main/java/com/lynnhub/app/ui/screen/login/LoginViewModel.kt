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
            var baseUrl = userPreferences.getBaseUrl()
            // 迁移旧地址：模拟器本地地址和域名（被备案拦截）统一替换为 IP 直连
            if (baseUrl.contains("10.0.2.2") || baseUrl.contains("lynnhub.com") || baseUrl.contains("lynxdo.com")) {
                baseUrl = com.lynnhub.app.util.Constants.DEFAULT_BASE_URL
                userPreferences.setBaseUrl(baseUrl)
            }
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
                // 先保存 baseUrl 并同步到拦截器（本地调试允许 http 默认协议）
                val baseUrl = dynamicBaseUrlInterceptor.normalizeUrl(state.baseUrl, "http")
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
}

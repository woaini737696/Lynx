package com.lynnhub.app.ui.screen.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.local.UserInfo
import com.lynnhub.app.data.remote.ApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val user: UserInfo? = null,
    val theme: String = "system",
    val baseUrl: String = "",
    val isLoading: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val userPreferences: UserPreferences,
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            userPreferences.userFlow.collect { user ->
                _uiState.value = _uiState.value.copy(user = user)
            }
        }
        viewModelScope.launch {
            userPreferences.themeFlow.collect { theme ->
                _uiState.value = _uiState.value.copy(theme = theme)
            }
        }
        viewModelScope.launch {
            userPreferences.baseUrlFlow.collect { url ->
                _uiState.value = _uiState.value.copy(baseUrl = url)
            }
        }
    }

    fun setTheme(theme: String) {
        viewModelScope.launch { userPreferences.setTheme(theme) }
    }

    fun setBaseUrl(url: String) {
        viewModelScope.launch { userPreferences.setBaseUrl(url) }
    }

    fun logout() {
        viewModelScope.launch { userPreferences.clearAuth() }
    }
}

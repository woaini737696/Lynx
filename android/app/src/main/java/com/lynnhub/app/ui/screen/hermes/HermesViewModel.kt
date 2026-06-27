package com.lynnhub.app.ui.screen.hermes

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class HermesTab { EXECUTE, SKILLS, PATTERNS, REPORTS, MEMORY }

data class HermesUiState(
    val isLoading: Boolean = false,
    val isExecuting: Boolean = false,
    val currentTab: HermesTab = HermesTab.EXECUTE,
    // Status
    val status: HermesStatusResponse? = null,
    val statusLoading: Boolean = false,
    // Execute
    val prompt: String = "",
    val mode: String = "auto",
    val lastResult: HermesExecuteResponse? = null,
    val executionHistory: List<ExecutionRecord> = emptyList(),
    // Skills
    val skills: List<HermesSkillDto> = emptyList(),
    val skillsLoading: Boolean = false,
    // Patterns
    val patterns: List<HermesPatternDto> = emptyList(),
    // Reports
    val reports: List<HermesReportDto> = emptyList(),
    val reportGenerating: Boolean = false,
    // Memory
    val memoryQuery: String = "",
    val memoryResults: List<HermesMemoryItemDto> = emptyList(),
    val memorySearching: Boolean = false,
    // Profile
    val profile: HermesProfileResponse? = null,
    // Error
    val error: String? = null,
    val successMessage: String? = null
)

data class ExecutionRecord(
    val prompt: String,
    val mode: String,
    val success: Boolean,
    val output: String,
    val durationMs: Long?,
    val timestamp: Long = System.currentTimeMillis()
)

@HiltViewModel
class HermesViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(HermesUiState())
    val uiState: StateFlow<HermesUiState> = _uiState.asStateFlow()

    private var skillsLoaded = false
    private var patternsLoaded = false
    private var reportsLoaded = false
    private var profileLoaded = false

    init {
        loadStatus()
    }

    fun switchTab(tab: HermesTab) {
        _uiState.value = _uiState.value.copy(currentTab = tab)
        // 懒加载：只在首次切换到Tab时加载
        when (tab) {
            HermesTab.SKILLS -> if (!skillsLoaded) { skillsLoaded = true; loadSkills() }
            HermesTab.PATTERNS -> if (!patternsLoaded) { patternsLoaded = true; loadPatterns() }
            HermesTab.REPORTS -> if (!reportsLoaded) { reportsLoaded = true; loadReports() }
            HermesTab.MEMORY -> if (!profileLoaded) { profileLoaded = true; loadProfile() }
            HermesTab.EXECUTE -> {}
        }
    }

    fun updatePrompt(text: String) {
        _uiState.value = _uiState.value.copy(prompt = text, error = null)
    }

    fun updateMode(mode: String) {
        _uiState.value = _uiState.value.copy(mode = mode)
    }

    fun updateMemoryQuery(text: String) {
        _uiState.value = _uiState.value.copy(memoryQuery = text)
    }

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(error = null, successMessage = null)
    }

    // ============ Status ============
    fun loadStatus() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(statusLoading = true)
            try {
                val status = apiService.getHermesStatus()
                _uiState.value = _uiState.value.copy(status = status, statusLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    statusLoading = false,
                    status = HermesStatusResponse(connectionError = e.message)
                )
            }
        }
    }

    fun startHermes() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val resp = apiService.hermesInstall(HermesInstallRequest(action = "start"))
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    successMessage = if (resp.success) "Hermes 已启动" else resp.message
                )
                loadStatus()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun stopHermes() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val resp = apiService.hermesInstall(HermesInstallRequest(action = "stop"))
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    successMessage = if (resp.success) "Hermes 已停止" else resp.message
                )
                loadStatus()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun testConnection() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val resp = apiService.hermesTest(HermesTestRequest())
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    successMessage = if (resp.connected) "连接成功 (v${resp.version})" else "连接失败: ${resp.error}"
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    // ============ Execute ============
    fun execute() {
        val prompt = _uiState.value.prompt.trim()
        if (prompt.isBlank()) {
            _uiState.value = _uiState.value.copy(error = "请输入指令")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isExecuting = true, error = null)
            try {
                val resp = apiService.hermesExecute(
                    HermesExecuteRequest(prompt = prompt, mode = _uiState.value.mode)
                )
                val record = ExecutionRecord(
                    prompt = prompt,
                    mode = _uiState.value.mode,
                    success = resp.success,
                    output = resp.output,
                    durationMs = resp.durationMs
                )
                _uiState.value = _uiState.value.copy(
                    isExecuting = false,
                    lastResult = resp,
                    executionHistory = listOf(record) + _uiState.value.executionHistory.take(19),
                    prompt = "",
                    error = if (!resp.success) resp.error else null,
                    successMessage = if (resp.success) "执行完成 (${resp.durationMs}ms)" else null
                )
            } catch (e: Exception) {
                val record = ExecutionRecord(
                    prompt = prompt,
                    mode = _uiState.value.mode,
                    success = false,
                    output = "",
                    durationMs = null
                )
                _uiState.value = _uiState.value.copy(
                    isExecuting = false,
                    executionHistory = listOf(record) + _uiState.value.executionHistory.take(19),
                    error = e.message ?: "执行失败"
                )
            }
        }
    }

    // ============ Skills ============
    fun loadSkills() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(skillsLoading = true)
            try {
                val resp = apiService.getHermesSkills()
                _uiState.value = _uiState.value.copy(skills = resp.skills, skillsLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(skillsLoading = false)
            }
        }
    }

    fun preloadSkills() {
        viewModelScope.launch {
            try {
                val resp = apiService.hermesPreloadSkills()
                _uiState.value = _uiState.value.copy(
                    successMessage = resp.message
                )
                loadSkills()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    // ============ Patterns ============
    fun loadPatterns() {
        viewModelScope.launch {
            try {
                val resp = apiService.getHermesPatterns()
                _uiState.value = _uiState.value.copy(patterns = resp.patterns)
            } catch (e: Exception) {
                Log.w("HermesViewModel", "loadPatterns failed", e)
            }
        }
    }

    fun togglePatternAutoExecute(pattern: HermesPatternDto) {
        viewModelScope.launch {
            try {
                apiService.patchHermesPattern(
                    pattern.id,
                    HermesPatternPatchRequest(autoExecute = !pattern.autoExecute)
                )
                loadPatterns()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun deletePattern(id: String) {
        viewModelScope.launch {
            try {
                apiService.deleteHermesPattern(id)
                loadPatterns()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    // ============ Reports ============
    fun loadReports() {
        viewModelScope.launch {
            try {
                val resp = apiService.getHermesReports()
                _uiState.value = _uiState.value.copy(reports = resp.reports)
            } catch (e: Exception) {
                Log.w("HermesViewModel", "loadReports failed", e)
            }
        }
    }

    fun generateReport(type: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(reportGenerating = true)
            try {
                val resp = apiService.triggerHermesReport(HermesReportRequest(type = type))
                _uiState.value = _uiState.value.copy(
                    reportGenerating = false,
                    successMessage = if (resp.success) "汇报已生成" else "生成失败"
                )
                loadReports()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(reportGenerating = false, error = e.message)
            }
        }
    }

    // ============ Memory ============
    fun searchMemory() {
        val q = _uiState.value.memoryQuery.trim()
        if (q.isBlank()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(memorySearching = true)
            try {
                val resp = apiService.searchHermesMemory(q)
                _uiState.value = _uiState.value.copy(
                    memoryResults = resp.results,
                    memorySearching = false
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(memorySearching = false, error = e.message)
            }
        }
    }

    // ============ Profile ============
    fun loadProfile() {
        viewModelScope.launch {
            try {
                val resp = apiService.getHermesProfile()
                _uiState.value = _uiState.value.copy(profile = resp)
            } catch (e: Exception) {
                Log.w("HermesViewModel", "loadProfile failed", e)
            }
        }
    }
}

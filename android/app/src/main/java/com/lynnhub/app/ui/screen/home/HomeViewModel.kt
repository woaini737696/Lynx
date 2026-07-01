package com.lynnhub.app.ui.screen.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.Think
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import androidx.compose.ui.graphics.Color

// ============ 数据模型 ============
data class HomeUiState(
    val greeting: String = "",
    val userName: String = "",
    val summary: String = "",
    val agentStatus: AgentStatus = AgentStatus.OFFLINE,
    val agentLabel: String = "Lynx Agent 未连接",
    // 今日概览统计
    val activeTaskCount: Int = 0,
    val todayDoneCount: Int = 0,
    val pendingLarkTaskCount: Int = 0,
    // 最近飞书任务 Top 3
    val recentTasks: List<com.lynnhub.app.data.remote.dto.LarkTaskDto> = emptyList(),
    val isLoading: Boolean = false
)

enum class AgentStatus { ONLINE, BUSY, OFFLINE }

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val apiService: ApiService,
    private val userPreferences: UserPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState(isLoading = true))
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init { loadHome() }

    fun loadHome() {
        viewModelScope.launch {
            // 1. 用户信息 + 问候语
            val user = userPreferences.userFlow.first()
            val hour = LocalTime.now().hour
            val greeting = when (hour) {
                in 5..11 -> "早上好"
                in 12..17 -> "下午好"
                in 18..22 -> "晚上好"
                else -> "夜深了"
            }

            _uiState.value = _uiState.value.copy(
                greeting = greeting,
                userName = user?.displayName?.ifBlank { null } ?: user?.username ?: "用户",
                summary = "今日工作台"
            )

            // 2. 并行拉取：Agent 状态 + 看板任务统计 + 飞书任务列表
            val (agentStatus, agentLabel, activeCount, larkTasks) = try {
                coroutineScope {
                    val statusDeferred = async { safeHermesStatus() }
                    val tasksDeferred = async { safeTaskStats() }
                    val larkDeferred = async { safeLarkTasks() }

                    val (status, label) = statusDeferred.await()
                    val active = tasksDeferred.await()
                    val lark = larkDeferred.await()

                    Quad(status, label, active, lark)
                }
            } catch (_: Exception) {
                Quad(AgentStatus.OFFLINE, "Agent 未连接", 0, emptyList())
            }

            val pendingLark = larkTasks.count { !it.completed }

            _uiState.value = _uiState.value.copy(
                summary = "今日工作台",
                agentStatus = agentStatus,
                agentLabel = agentLabel,
                activeTaskCount = activeCount,
                pendingLarkTaskCount = pendingLark,
                // 今日完成数：飞书任务里 completed=true 的（简化统计）
                todayDoneCount = larkTasks.count { it.completed },
                recentTasks = larkTasks.take(3),
                isLoading = false
            )
        }
    }

    // ============ Agent 状态 ============
    private suspend fun safeHermesStatus(): Pair<AgentStatus, String> = try {
        val s = apiService.getHermesStatus()
        when {
            s.connected -> AgentStatus.ONLINE to ("Lynx Agent 在线")
            s.config?.status == "running" -> AgentStatus.BUSY to "Lynx Agent 连接中"
            s.installed -> AgentStatus.BUSY to "Lynx Agent 待启动"
            else -> AgentStatus.OFFLINE to "Lynx Agent 未连接"
        }
    } catch (_: Exception) {
        AgentStatus.OFFLINE to "Lynx Agent 未连接"
    }

    // ============ 看板任务统计（进行中数） ============
    private suspend fun safeTaskStats(): Int = try {
        apiService.getTaskStats().totalActive
    } catch (_: Exception) { 0 }

    // ============ 飞书任务列表（最近） ============
    private suspend fun safeLarkTasks(): List<com.lynnhub.app.data.remote.dto.LarkTaskDto> = try {
        apiService.getLarkTasks(view = "my", dbOnly = true).tasks
    } catch (_: Exception) { emptyList() }

    // 四元组辅助
    private data class Quad<A, B, C, D>(
        val a: A, val b: B, val c: C, val d: D
    )
}

/**
 * ISO 时间字符串 -> 相对时间文案
 * 例如："刚刚" / "5 分钟前" / "2 小时前" / "昨天 14:30" / "3 天前" / "2026-01-01"
 */
fun formatRelativeTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        val instant = Instant.parse(iso)
        val now = Instant.now()
        val zone = ZoneId.systemDefault()
        val dt = instant.atZone(zone)
        val nowDt = now.atZone(zone)

        val minutes = ChronoUnit.MINUTES.between(dt, nowDt)
        val hours = ChronoUnit.HOURS.between(dt, nowDt)
        val days = ChronoUnit.DAYS.between(dt.toLocalDate(), nowDt.toLocalDate())

        when {
            minutes < 1 -> "刚刚"
            minutes < 60 -> "$minutes 分钟前"
            hours < 24 && days == 0L -> "$hours 小时前"
            days == 1L -> "昨天 ${dt.format(DateTimeFormatter.ofPattern("HH:mm"))}"
            days < 7 -> "$days 天前"
            dt.year == nowDt.year -> dt.format(DateTimeFormatter.ofPattern("M-d HH:mm"))
            else -> dt.format(DateTimeFormatter.ofPattern("yyyy-M-d"))
        }
    } catch (_: DateTimeParseException) {
        iso.take(16).replace("T", " ")
    } catch (_: Exception) {
        ""
    }
}

/**
 * LocalDate 工具（保留备用）
 */
fun today(): LocalDate = LocalDate.now(ZoneId.systemDefault())

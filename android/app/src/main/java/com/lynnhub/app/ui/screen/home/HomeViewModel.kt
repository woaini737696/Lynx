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
    val timeline: List<TimelineItem> = emptyList(),
    val isLoading: Boolean = false
)

enum class AgentStatus { ONLINE, BUSY, OFFLINE }

/**
 * 时间流条目
 * @param type 类型：report/idea/cognition/task/memory —— 决定颜色与图标
 * @param createdAt ISO 时间字符串，用于排序与相对时间显示
 */
data class TimelineItem(
    val id: String,
    val title: String,
    val desc: String,
    val dotColor: Color,
    val type: String = "other",
    val createdAt: String? = null
)

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
                summary = "欢迎回来"
            )

            // 2. 并行拉取所有时间流数据源 + Agent 状态
            val (agentStatus, agentLabel, timeline) = try {
                coroutineScope {
                    val statusDeferred = async { safeHermesStatus() }
                    val reportsDeferred = async { safeHermesReports() }
                    val ideasDeferred = async { safeIdeas() }
                    val cognitionsDeferred = async { safeCognitions() }
                    val tasksDeferred = async { safeTasks() }
                    val memoryDeferred = async { safeMemory() }

                    val (status, label) = statusDeferred.await()
                    val reports = reportsDeferred.await()
                    val ideas = ideasDeferred.await()
                    val cognitions = cognitionsDeferred.await()
                    val tasks = tasksDeferred.await()
                    val memories = memoryDeferred.await()

                    // 合并 + 排序 + 截取前 25 条
                    val all = (reports + ideas + cognitions + tasks + memories)
                        .sortedByDescending { it.createdAt ?: "" }
                        .take(25)

                    Triple(status, label, all)
                }
            } catch (_: Exception) {
                Triple(AgentStatus.OFFLINE, "Agent 未连接", emptyList())
            }

            // 3. 摘要根据时间流动态生成
            val summaryText = when {
                timeline.isEmpty() -> "暂无动态"
                timeline.size == 1 -> "1 条最新动态"
                else -> "${timeline.size} 条最新动态"
            }

            _uiState.value = _uiState.value.copy(
                summary = summaryText,
                agentStatus = agentStatus,
                agentLabel = agentLabel,
                timeline = timeline,
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

    // ============ Hermes 报告（Agent 动态） ============
    private suspend fun safeHermesReports(): List<TimelineItem> = try {
        apiService.getHermesReports(page = 1, pageSize = 5).reports.map { r ->
            TimelineItem(
                id = "report_${r.id}",
                title = r.title.ifBlank { "Agent 报告" },
                desc = "Agent · ${typeLabel(r.type)}",
                dotColor = Agent,
                type = "report",
                createdAt = r.createdAt
            )
        }
    } catch (_: Exception) { emptyList() }

    // ============ 灵感 ============
    private suspend fun safeIdeas(): List<TimelineItem> = try {
        apiService.getIdeas().data.take(8).map { i ->
            TimelineItem(
                id = "idea_${i.id}",
                title = truncate(i.content, 40),
                desc = "灵感 · ${sourceLabel(i.source)}",
                dotColor = Primary,
                type = "idea",
                createdAt = i.createdAt
            )
        }
    } catch (_: Exception) { emptyList() }

    // ============ 认知 ============
    private suspend fun safeCognitions(): List<TimelineItem> = try {
        apiService.getCognitions().cognitions.take(8).map { c ->
            TimelineItem(
                id = "cognition_${c.id}",
                title = truncate(c.content, 40),
                desc = "认知 · ${typeLabel(c.type)}",
                dotColor = Think,
                type = "cognition",
                createdAt = c.createdAt
            )
        }
    } catch (_: Exception) { emptyList() }

    // ============ 任务 ============
    private suspend fun safeTasks(): List<TimelineItem> = try {
        apiService.getTasks().data
            .filter { !it.completed }
            .take(8)
            .map { t ->
                TimelineItem(
                    id = "task_${t.id}",
                    title = truncate(t.content, 40),
                    desc = "任务 · ${columnLabel(t.column)}",
                    dotColor = TextMuted,
                    type = "task",
                    createdAt = t.createdAt
                )
            }
    } catch (_: Exception) { emptyList() }

    // ============ 记忆 ============
    private suspend fun safeMemory(): List<TimelineItem> = try {
        apiService.getMemory().nodes.take(5).map { m ->
            TimelineItem(
                id = "memory_${m.id}",
                title = truncate(m.label.ifBlank { m.fullContent }, 40),
                desc = "记忆 · ${typeLabel(m.type)}",
                dotColor = Primary.copy(alpha = 0.6f),
                type = "memory",
                createdAt = m.createdAt
            )
        }
    } catch (_: Exception) { emptyList() }

    // ============ 辅助 ============
    private fun truncate(s: String, max: Int): String =
        if (s.length <= max) s else s.take(max) + "…"

    private fun typeLabel(t: String): String = when (t.lowercase()) {
        "daily" -> "日报"
        "weekly" -> "周报"
        "patrol" -> "巡检"
        "method" -> "方法"
        "experience" -> "经验"
        "prompt" -> "提示词"
        "idea" -> "灵感"
        "conversation" -> "对话"
        "cognition" -> "认知"
        else -> t
    }

    private fun sourceLabel(s: String): String = when (s.lowercase()) {
        "lightning" -> "闪念"
        "voice" -> "语音"
        "import" -> "导入"
        else -> s
    }

    private fun columnLabel(c: String): String = when (c.lowercase()) {
        "northstar" -> "北极星"
        "campaign" -> "战役"
        "task" -> "任务"
        "done" -> "已完成"
        else -> c
    }
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

package com.lynnhub.app.ui.screen.hermes

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.data.remote.dto.HermesExecuteResponse
import com.lynnhub.app.data.remote.dto.HermesMemoryItemDto
import com.lynnhub.app.data.remote.dto.HermesPatternDto
import com.lynnhub.app.data.remote.dto.HermesProfileResponse
import com.lynnhub.app.data.remote.dto.HermesReportDto
import com.lynnhub.app.data.remote.dto.HermesSkillDto
import com.lynnhub.app.data.remote.dto.HermesStatusResponse
import com.lynnhub.app.ui.theme.Amber500
import com.lynnhub.app.ui.theme.Orange500
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val SuccessGreen = Color(0xFF22C55E)

private val modeOptions = listOf(
    "auto" to "自动",
    "computer_use" to "桌面操控",
    "shell" to "Shell命令"
)

private val quickCommands: List<Pair<String, String>> = listOf(
    "浏览器搜索" to "打开浏览器，搜索并总结今日头条新闻",
    "整理桌面" to "将桌面上散乱的文件按类型分类整理到对应文件夹",
    "截屏分析" to "截取当前屏幕并分析屏幕上的内容",
    "Git提交" to "在当前项目执行 git add 和 git commit，提交信息概括本次改动",
    "系统资源" to "查看当前CPU、内存、磁盘使用情况并汇总",
    "打开音乐" to "打开系统默认音乐播放器并播放收藏歌曲"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HermesScreen(viewModel: HermesViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.error) {
        uiState.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }
    LaunchedEffect(uiState.successMessage) {
        uiState.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            HermesTopBar(
                status = uiState.status,
                modifier = Modifier.statusBarsPadding()
            )
            HermesStatusBar(
                status = uiState.status,
                loading = uiState.isLoading || uiState.statusLoading,
                onStart = viewModel::startHermes,
                onStop = viewModel::stopHermes,
                onTest = viewModel::testConnection,
                onRefresh = viewModel::loadStatus
            )
            HermesTabRow(
                selected = uiState.currentTab,
                onSelect = viewModel::switchTab
            )
            when (uiState.currentTab) {
                HermesTab.EXECUTE -> ExecuteTab(uiState, viewModel)
                HermesTab.SKILLS -> SkillsTab(uiState, viewModel)
                HermesTab.PATTERNS -> PatternsTab(uiState, viewModel)
                HermesTab.REPORTS -> ReportsTab(uiState, viewModel)
                HermesTab.MEMORY -> MemoryTab(uiState, viewModel)
            }
        }
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
        )
    }
}

// ============ TopBar ============
@Composable
private fun HermesTopBar(
    status: HermesStatusResponse?,
    modifier: Modifier = Modifier
) {
    val dotColor = when {
        status == null -> MaterialTheme.colorScheme.outline
        status.connectionError != null -> MaterialTheme.colorScheme.error
        status.connected && status.installed -> SuccessGreen
        else -> MaterialTheme.colorScheme.outline
    }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "Hermes",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
        Box(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .size(12.dp)
                .clip(CircleShape)
                .background(dotColor)
        )
    }
}

// ============ StatusBar ============
@Composable
private fun HermesStatusBar(
    status: HermesStatusResponse?,
    loading: Boolean,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onTest: () -> Unit,
    onRefresh: () -> Unit
) {
    val isRunning = status?.connected == true && status.installed
    val isError = status?.connectionError != null
    val statusText = when {
        status == null -> if (loading) "加载中..." else "未连接"
        status.connectionError != null -> "连接错误"
        status.connected && status.installed -> "运行中" + (status.version?.let { " v$it" } ?: "")
        status.installed -> "已安装 · 未连接"
        else -> "未安装"
    }
    val capabilities = status?.capabilities ?: emptyList()

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(Amber500, Orange500)
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.SmartToy,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = statusText,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (isError && !status?.connectionError.isNullOrBlank()) {
                        Text(
                            text = status?.connectionError ?: "",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = Amber500
                    )
                } else {
                    IconButton(onClick = onRefresh, modifier = Modifier.size(36.dp)) {
                        Icon(
                            imageVector = Icons.Filled.Refresh,
                            contentDescription = "刷新状态",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (isRunning) {
                    OutlinedButton(
                        onClick = onStop,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        enabled = !loading
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Stop,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("停止")
                    }
                    GradientButton(
                        text = "测试",
                        icon = Icons.Filled.Wifi,
                        onClick = onTest,
                        modifier = Modifier.weight(1f),
                        enabled = !loading,
                        height = 40.dp,
                        cornerRadius = 12.dp
                    )
                } else {
                    GradientButton(
                        text = "启动 Hermes",
                        icon = Icons.Filled.PlayArrow,
                        onClick = onStart,
                        modifier = Modifier.weight(1f),
                        enabled = !loading,
                        height = 40.dp,
                        cornerRadius = 12.dp
                    )
                }
            }

            if (capabilities.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    capabilities.take(3).forEach { cap ->
                        Surface(
                            color = Amber500.copy(alpha = 0.10f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = cap,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                color = Amber500,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

// ============ TabRow ============
@Composable
private fun HermesTabRow(
    selected: HermesTab,
    onSelect: (HermesTab) -> Unit
) {
    val tabs = HermesTab.entries
    val selectedIndex = tabs.indexOf(selected)
    ScrollableTabRow(
        selectedTabIndex = selectedIndex,
        containerColor = MaterialTheme.colorScheme.background,
        contentColor = Amber500,
        edgePadding = 8.dp,
        divider = {},
        indicator = { tabPositions ->
            TabRowDefaults.Indicator(
                modifier = Modifier.tabIndicatorOffset(tabPositions[selectedIndex]),
                color = Amber500,
                height = 3.dp
            )
        }
    ) {
        tabs.forEach { tab ->
            val isSelected = tab == selected
            Tab(
                selected = isSelected,
                onClick = { onSelect(tab) },
                text = {
                    Text(
                        text = tab.label(),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium
                    )
                },
                selectedContentColor = Amber500,
                unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun HermesTab.label(): String = when (this) {
    HermesTab.EXECUTE -> "执行"
    HermesTab.SKILLS -> "技能"
    HermesTab.PATTERNS -> "模式"
    HermesTab.REPORTS -> "汇报"
    HermesTab.MEMORY -> "记忆"
}

// ============ ExecuteTab ============
@Composable
private fun ExecuteTab(
    uiState: HermesUiState,
    viewModel: HermesViewModel
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // 输入区域
        OutlinedTextField(
            value = uiState.prompt,
            onValueChange = viewModel::updatePrompt,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 120.dp),
            placeholder = {
                Text("输入指令让Hermes在你的电脑上执行...")
            },
            shape = RoundedCornerShape(16.dp),
            minLines = 4,
            maxLines = 8,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Amber500,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                focusedContainerColor = MaterialTheme.colorScheme.surface,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface
            )
        )

        // 模式选择
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            modeOptions.forEach { (mode, label) ->
                FilterChip(
                    selected = uiState.mode == mode,
                    onClick = { viewModel.updateMode(mode) },
                    label = {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = if (uiState.mode == mode) FontWeight.SemiBold
                            else FontWeight.Medium
                        )
                    },
                    shape = RoundedCornerShape(10.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Amber500,
                        selectedLabelColor = Color.White,
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                        labelColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                )
            }
        }

        // 快捷指令
        Text(
            text = "快捷指令",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.SemiBold
        )
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(vertical = 2.dp)
        ) {
            items(quickCommands) { (label, prompt) ->
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.clickable { viewModel.updatePrompt(prompt) }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Bolt,
                            contentDescription = null,
                            tint = Amber500,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = label,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }

        // 执行按钮
        GradientButton(
            text = if (uiState.isExecuting) "正在执行..." else "执行指令",
            icon = Icons.Filled.Send,
            onClick = viewModel::execute,
            modifier = Modifier.fillMaxWidth(),
            enabled = !uiState.isExecuting,
            height = 52.dp,
            cornerRadius = 16.dp
        )

        // 执行中状态
        if (uiState.isExecuting) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = Amber500
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Hermes 正在你的电脑上执行...",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // 执行结果
        uiState.lastResult?.let { result ->
            ExecuteResultCard(result = result)
        }

        // 执行历史
        if (uiState.executionHistory.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Filled.History,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "执行历史",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = "${uiState.executionHistory.size} 条",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            uiState.executionHistory.forEach { record ->
                ExecutionHistoryItem(record = record)
            }
        }
        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun ExecuteResultCard(result: HermesExecuteResponse) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = if (result.success) Icons.Filled.CheckCircle
                    else Icons.Filled.Error,
                    contentDescription = null,
                    tint = if (result.success) SuccessGreen
                    else MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (result.success) "执行成功" else "执行失败",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                result.durationMs?.let {
                    Text(
                        text = "${it}ms",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (result.output.isNotBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 240.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .verticalScroll(rememberScrollState())
                            .padding(12.dp)
                    ) {
                        Text(
                            text = result.output,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }

            if (!result.steps.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "执行步骤",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(6.dp))
                result.steps.forEachIndexed { index, step ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Surface(
                            color = Amber500.copy(alpha = 0.12f),
                            shape = CircleShape,
                            modifier = Modifier.size(18.dp)
                        ) {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "${index + 1}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Amber500,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = step,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            if (!result.error.isNullOrBlank() && !result.success) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = result.error,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun ExecutionHistoryItem(record: ExecutionRecord) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (record.success) Icons.Filled.CheckCircle
                else Icons.Filled.Cancel,
                contentDescription = null,
                tint = if (record.success) SuccessGreen
                else MaterialTheme.colorScheme.error,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = record.prompt,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "${formatEpoch(record.timestamp)} · ${modeLabel(record.mode)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            record.durationMs?.let {
                Text(
                    text = "${it}ms",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

private fun modeLabel(mode: String): String = when (mode) {
    "auto" -> "自动"
    "computer_use" -> "桌面操控"
    "shell" -> "Shell"
    else -> mode
}

// ============ SkillsTab ============
@Composable
private fun SkillsTab(
    uiState: HermesUiState,
    viewModel: HermesViewModel
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "技能库 (${uiState.skills.size})",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
            GradientButton(
                text = "预置技能",
                icon = Icons.Filled.AutoAwesome,
                onClick = viewModel::preloadSkills,
                enabled = !uiState.skillsLoading,
                height = 36.dp,
                cornerRadius = 10.dp
            )
        }
        when {
            uiState.skillsLoading && uiState.skills.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Amber500)
                }
            }
            uiState.skills.isEmpty() -> EmptyState(
                icon = Icons.Filled.Hub,
                title = "暂无技能",
                subtitle = "点击右上角预置技能以加载"
            )
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        start = 16.dp,
                        end = 16.dp,
                        bottom = 24.dp
                    ),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uiState.skills, key = { it.id }) { skill ->
                        SkillItem(skill = skill)
                    }
                }
            }
        }
    }
}

@Composable
private fun SkillItem(skill: HermesSkillDto) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = skill.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (skill.category.isNotBlank()) {
                    AssistChip(
                        onClick = {},
                        label = {
                            Text(
                                text = skill.category,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold
                            )
                        },
                        shape = RoundedCornerShape(8.dp),
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = Amber500.copy(alpha = 0.12f),
                            labelColor = Amber500
                        )
                    )
                }
            }
            if (skill.description.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = skill.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// ============ PatternsTab ============
@Composable
private fun PatternsTab(
    uiState: HermesUiState,
    viewModel: HermesViewModel
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "任务模式 (${uiState.patterns.size})",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f)
            )
        }
        when {
            uiState.patterns.isEmpty() -> EmptyState(
                icon = Icons.Filled.Refresh,
                title = "暂无任务模式",
                subtitle = "常用执行模式将自动记录在此"
            )
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        start = 16.dp,
                        end = 16.dp,
                        bottom = 24.dp
                    ),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uiState.patterns, key = { it.id }) { pattern ->
                        PatternItem(
                            pattern = pattern,
                            onToggle = { viewModel.togglePatternAutoExecute(pattern) },
                            onDelete = { viewModel.deletePattern(pattern.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PatternItem(
    pattern: HermesPatternDto,
    onToggle: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = pattern.taskDescription.ifBlank { pattern.patternKey },
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "执行 ${pattern.executionCount} 次",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (pattern.autoExecute) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            color = Amber500.copy(alpha = 0.12f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = "自动",
                                modifier = Modifier.padding(
                                    horizontal = 6.dp,
                                    vertical = 2.dp
                                ),
                                color = Amber500,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Switch(
                checked = pattern.autoExecute,
                onCheckedChange = { onToggle() },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = Amber500,
                    uncheckedThumbColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    uncheckedTrackColor = MaterialTheme.colorScheme.surfaceVariant
                )
            )
            IconButton(onClick = onDelete, modifier = Modifier.size(36.dp)) {
                Icon(
                    imageVector = Icons.Filled.Delete,
                    contentDescription = "删除",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

// ============ ReportsTab ============
@Composable
private fun ReportsTab(
    uiState: HermesUiState,
    viewModel: HermesViewModel
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ReportTypeButton(
                text = "日报",
                onClick = { viewModel.generateReport("daily") },
                enabled = !uiState.reportGenerating,
                modifier = Modifier.weight(1f)
            )
            ReportTypeButton(
                text = "周报",
                onClick = { viewModel.generateReport("weekly") },
                enabled = !uiState.reportGenerating,
                modifier = Modifier.weight(1f)
            )
            ReportTypeButton(
                text = "巡检",
                onClick = { viewModel.generateReport("patrol") },
                enabled = !uiState.reportGenerating,
                modifier = Modifier.weight(1f)
            )
        }
        if (uiState.reportGenerating) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = Amber500
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "正在生成汇报...",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        when {
            uiState.reports.isEmpty() -> EmptyState(
                icon = Icons.Filled.Assessment,
                title = "暂无汇报",
                subtitle = "点击上方按钮生成日报/周报/巡检"
            )
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        start = 16.dp,
                        end = 16.dp,
                        bottom = 24.dp
                    ),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uiState.reports, key = { it.id }) { report ->
                        ReportItem(report = report)
                    }
                }
            }
        }
    }
}

@Composable
private fun ReportTypeButton(
    text: String,
    onClick: () -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier
) {
    GradientButton(
        text = text,
        icon = Icons.Filled.Description,
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        height = 40.dp,
        cornerRadius = 12.dp
    )
}

@Composable
private fun ReportItem(report: HermesReportDto) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = report.title.ifBlank { "未命名汇报" },
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Surface(
                    color = Amber500.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = reportTypeLabel(report.type),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        color = Amber500,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
            if (report.content.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = report.content,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = formatIso(report.createdAt),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun reportTypeLabel(type: String): String = when (type) {
    "daily" -> "日报"
    "weekly" -> "周报"
    "patrol" -> "巡检"
    else -> type
}

// ============ MemoryTab ============
@Composable
private fun MemoryTab(
    uiState: HermesUiState,
    viewModel: HermesViewModel
) {
    Column(modifier = Modifier.fillMaxSize()) {
        uiState.profile?.let { profile ->
            MemoryProfileStats(profile = profile)
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = uiState.memoryQuery,
                onValueChange = viewModel::updateMemoryQuery,
                modifier = Modifier.weight(1f),
                placeholder = { Text("搜索Hermes记忆...") },
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Filled.Search,
                        contentDescription = null,
                        tint = Amber500
                    )
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Amber500,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                )
            )
            GradientButton(
                text = "搜索",
                icon = Icons.Filled.Search,
                onClick = viewModel::searchMemory,
                modifier = Modifier.width(88.dp),
                enabled = !uiState.memorySearching && uiState.memoryQuery.isNotBlank(),
                height = 52.dp,
                cornerRadius = 12.dp
            )
        }
        when {
            uiState.memorySearching -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Amber500)
                }
            }
            uiState.memoryResults.isEmpty() -> EmptyState(
                icon = Icons.Filled.Psychology,
                title = "暂无记忆",
                subtitle = "Hermes执行过程中积累的记忆将在此展示"
            )
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        start = 16.dp,
                        end = 16.dp,
                        bottom = 24.dp
                    ),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(uiState.memoryResults) { item ->
                        MemoryResultItem(item = item)
                    }
                }
            }
        }
    }
}

@Composable
private fun MemoryProfileStats(profile: HermesProfileResponse) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        StatCard(
            label = "记忆",
            value = profile.memoryCount,
            modifier = Modifier.weight(1f)
        )
        StatCard(
            label = "技能",
            value = profile.skillsCount,
            modifier = Modifier.weight(1f)
        )
        StatCard(
            label = "会话",
            value = profile.sessionsCount,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun StatCard(
    label: String,
    value: Int,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = value.toString(),
                style = MaterialTheme.typography.headlineSmall,
                color = Amber500,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun MemoryResultItem(item: HermesMemoryItemDto) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = Amber500.copy(alpha = 0.12f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "相关度 ${(item.score * 100).toInt()}%",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        color = Amber500,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Text(
                    text = formatIso(item.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = item.content,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 4,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// ============ 通用组件 ============
@Composable
private fun GradientButton(
    text: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    height: Dp = 48.dp,
    cornerRadius: Dp = 12.dp
) {
    val alpha = if (enabled) 1f else 0.5f
    Box(
        modifier = modifier
            .height(height)
            .clip(RoundedCornerShape(cornerRadius))
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        Amber500.copy(alpha = alpha),
                        Orange500.copy(alpha = alpha)
                    )
                )
            )
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = text,
                color = Color.White,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun EmptyState(
    icon: ImageVector,
    title: String,
    subtitle: String
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Amber500.copy(alpha = 0.4f),
                modifier = Modifier.size(72.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

// ============ 时间格式化 ============
private fun formatEpoch(millis: Long): String {
    return try {
        val sdf = SimpleDateFormat("MM-dd HH:mm", Locale.getDefault())
        sdf.format(Date(millis))
    } catch (_: Exception) {
        ""
    }
}

private fun formatIso(iso: String): String {
    if (iso.isBlank()) return ""
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val date = inputFormat.parse(iso)
        val outputFormat = SimpleDateFormat("MM-dd HH:mm", Locale.getDefault())
        outputFormat.format(date ?: Date())
    } catch (_: Exception) {
        iso.take(16)
    }
}

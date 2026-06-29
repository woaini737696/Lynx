package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.dto.TokenAnalysisRequest
import com.lynnhub.app.data.remote.dto.TokenAnalysisResponse
import com.lynnhub.app.data.remote.dto.TokenPieceDto
import com.lynnhub.app.ui.screen.panel.BackButton
import com.lynnhub.app.ui.screen.panel.ReturnSwipeDetector
import com.lynnhub.app.ui.screen.panel.SwipeHint
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.Deep
import com.lynnhub.app.ui.theme.Danger
import com.lynnhub.app.ui.theme.LiquidBorder
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.Surface
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import com.lynnhub.app.ui.theme.Think
import com.lynnhub.app.ui.theme.Void
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

// ============ ViewModel ============
data class TokenAnalysisUiState(
    val input: String = "",
    val isLoading: Boolean = false,
    val result: TokenAnalysisResponse? = null,
    val error: String? = null
)

@HiltViewModel
class TokenAnalysisViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(TokenAnalysisUiState())
    val uiState: StateFlow<TokenAnalysisUiState> = _uiState.asStateFlow()

    fun updateInput(text: String) {
        _uiState.update { it.copy(input = text, error = null) }
    }

    fun analyze() {
        val text = _uiState.value.input.trim()
        if (text.isBlank()) {
            _uiState.update { it.copy(error = "请输入要分析的文本") }
            return
        }
        if (_uiState.value.isLoading) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val resp = apiService.analyzeTokens(TokenAnalysisRequest(text = text))
                _uiState.update { it.copy(isLoading = false, result = resp) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, error = "分析失败: ${e.message ?: "网络错误"}")
                }
            }
        }
    }
}

// ============ UI 页面 ============
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TokenAnalysisPage(
    onBack: () -> Unit,
    viewModel: TokenAnalysisViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var showHelp by remember { mutableStateOf(false) }
    val keyboardController = LocalSoftwareKeyboardController.current
    var isInputFocused by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
            .pointerInput(Unit) {
                detectTapGestures(onTap = { keyboardController?.hide() })
            }
    ) {
        ReturnSwipeDetector(
            returnDirection = "right",
            onReturn = onBack,
            modifier = Modifier.fillMaxSize()
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(start = 22.dp, end = 22.dp, top = 66.dp, bottom = 110.dp)
        ) {
            // 标题栏 + 使用说明按钮（按视觉稿：panel-title 19px/700）
            Row(verticalAlignment = Alignment.CenterVertically) {
                BackButton(onClick = onBack)
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "词元分析",
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    modifier = Modifier.weight(1f)
                )
                // 右上角使用说明按钮
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { showHelp = true },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.HelpOutline,
                        contentDescription = "使用说明",
                        tint = TextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
            SwipeHint(text = "← 右滑返回", modifier = Modifier.padding(start = 50.dp, top = 4.dp, bottom = 22.dp))

            // 输入框
            OutlinedTextField(
                value = state.input,
                onValueChange = viewModel::updateInput,
                placeholder = {
                    Text(
                        "输入要分析的文本（支持中英文混合）...",
                        color = TextMuted,
                        fontSize = 13.sp
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Surface)
                    .onFocusChanged { isInputFocused = it.isFocused },
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Primary.copy(alpha = 0.3f),
                    unfocusedBorderColor = Color.Transparent,
                    cursorColor = Primary,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary
                ),
                textStyle = androidx.compose.ui.text.TextStyle(
                    fontSize = 13.sp,
                    lineHeight = 18.sp
                )
            )

            Spacer(modifier = Modifier.height(12.dp))

            // 分析按钮
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = Primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("分析中...", color = TextMuted, fontSize = 12.sp)
                } else {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(Primary)
                            .clickable {
                                keyboardController?.hide()
                                viewModel.analyze()
                            }
                            .padding(horizontal = 20.dp, vertical = 8.dp)
                    ) {
                        Text(
                            "分析",
                            color = TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            // 错误提示
            state.error?.let { err ->
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = err,
                    color = Danger,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(Surface)
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                )
            }

            // 结果展示
            state.result?.let { result ->
                Spacer(modifier = Modifier.height(20.dp))

                // 统计卡片网格
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    StatCard(
                        label = "Token",
                        value = result.tokenCount.toString(),
                        color = Primary,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = "字符",
                        value = result.charCount.toString(),
                        color = Agent,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = "词数",
                        value = result.wordCount.toString(),
                        color = Think,
                        modifier = Modifier.weight(1f)
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    StatCard(
                        label = "句子",
                        value = result.sentenceCount.toString(),
                        color = Agent,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = "行数",
                        value = result.lineCount.toString(),
                        color = Primary,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = "无空格",
                        value = result.charCountNoSpaces.toString(),
                        color = Think,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // 字符类型分布
                SectionTitle("字符分布")
                CharDistributionBar(stats = result.stats)

                Spacer(modifier = Modifier.height(16.dp))

                // 预估费用
                SectionTitle("预估费用")
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(Surface)
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "模型: ${result.model}",
                        color = TextMuted,
                        fontSize = 12.sp
                    )
                    Text(
                        text = "¥${result.estimatedCost.input} / 1K tokens",
                        color = Primary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // 分词可视化
                SectionTitle("分词可视化")
                TokenVisualization(tokens = result.tokens)
            }

            Spacer(modifier = Modifier.height(40.dp))
        }
    }

    // 使用说明弹窗
    if (showHelp) {
        AlertDialog(
            onDismissRequest = { showHelp = false },
            containerColor = Deep,
            titleContentColor = TextPrimary,
            title = {
                Text(text = "词元分析使用说明", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            },
            text = {
                Column {
                    Text(
                        text = "1. 在输入框中输入要分析的文本（支持中英文混合）\n" +
                               "2. 点击「分析」按钮，系统将估算文本的 Token 数量\n" +
                               "3. 结果包含：Token 数、字符数、词数、句子数等统计\n" +
                               "4. 字符分布展示中英文、数字、标点的比例\n" +
                               "5. 预估费用基于 DeepSeek 定价计算\n" +
                               "6. 分词可视化用不同颜色标注各类 Token",
                        color = TextMuted,
                        fontSize = 12.sp,
                        lineHeight = 18.sp
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showHelp = false }) {
                    Text("知道了", color = Primary, fontWeight = FontWeight.SemiBold)
                }
            }
        )
    }
}

// ============ 子组件 ============

@Composable
private fun StatCard(
    label: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(Surface)
            .border(1.dp, color.copy(alpha = 0.15f), RoundedCornerShape(10.dp))
            .padding(vertical = 12.dp, horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = value,
            color = color,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            color = TextMuted,
            fontSize = 10.sp
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        color = TextMuted,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.5.sp,
        modifier = Modifier.padding(bottom = 8.dp)
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CharDistributionBar(stats: com.lynnhub.app.data.remote.dto.TokenStatsDto) {
    val total = listOf(stats.cjk, stats.latin, stats.digit, stats.punctuation, stats.space, stats.other)
        .sumOf { it.coerceAtLeast(0) }
        .coerceAtLeast(1)

    val segments = listOf(
        Triple(stats.cjk, Primary, "中文"),
        Triple(stats.latin, Agent, "英文"),
        Triple(stats.digit, Think, "数字"),
        Triple(stats.punctuation, Danger, "标点"),
        Triple(stats.space, TextMuted, "空白"),
        Triple(stats.other, TextMuted, "其他")
    )

    // 分布条
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(24.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(Surface)
    ) {
        segments.forEach { (count, color, _) ->
            if (count > 0) {
                val weight = count.toFloat() / total.toFloat()
                Box(
                    modifier = Modifier
                        .weight(weight)
                        .fillMaxSize()
                        .background(color.copy(alpha = 0.7f))
                )
            }
        }
    }

    Spacer(modifier = Modifier.height(8.dp))

    // 图例
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        segments.forEach { (count, color, label) ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(color)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "$label $count",
                    color = TextMuted,
                    fontSize = 10.sp
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TokenVisualization(tokens: List<TokenPieceDto>) {
    if (tokens.isEmpty()) {
        Text(
            text = "无分词数据",
            color = TextMuted,
            fontSize = 12.sp,
            modifier = Modifier.padding(vertical = 12.dp)
        )
        return
    }

    val typeColors = mapOf(
        "cjk" to Primary.copy(alpha = 0.12f),
        "latin" to Agent.copy(alpha = 0.12f),
        "digit" to Think.copy(alpha = 0.15f),
        "punctuation" to Danger.copy(alpha = 0.1f),
        "space" to Color.Transparent,
        "other" to Surface
    )
    val typeBorders = mapOf(
        "cjk" to Primary.copy(alpha = 0.3f),
        "latin" to Agent.copy(alpha = 0.3f),
        "digit" to Think.copy(alpha = 0.35f),
        "punctuation" to Danger.copy(alpha = 0.25f),
        "space" to Color.Transparent,
        "other" to LiquidBorder
    )

    FlowRow(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Surface)
            .padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        tokens.forEach { piece ->
            if (piece.type == "space") {
                // 空白符用小间隔表示
                val displayText = piece.text.replace("\n", "↵").replace("\t", "→").replace(" ", "·")
                if (displayText.isNotBlank()) {
                    Text(
                        text = displayText,
                        color = TextMuted.copy(alpha = 0.4f),
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 1.dp)
                    )
                }
            } else {
                val bg = typeColors[piece.type] ?: Surface
                val border = typeBorders[piece.type] ?: Color.Transparent
                Text(
                    text = piece.text,
                    color = TextPrimary,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(bg)
                        .border(1.dp, border, RoundedCornerShape(4.dp))
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                )
            }
        }
    }
}

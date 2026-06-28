package com.lynnhub.app.ui.component

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.Danger
import com.lynnhub.app.ui.theme.Deep
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.Think
import kotlinx.coroutines.delay

/**
 * Toast 语义类型
 * - Normal: 默认（Muted 色）
 * - Success: 成功（Agent 色）
 * - Error: 错误（Danger 色）
 * - Offline: 离线/警告（Think 色）
 */
enum class ToastType {
    Normal, Success, Error, Offline
}

/**
 * Toast 状态
 */
data class ToastState(
    val message: String = "",
    val type: ToastType = ToastType.Normal,
    val visible: Boolean = false
)

/**
 * Lynx v6 Toast 提示条
 *
 * 设计规范（来自 Lynx_Android_Complete_v6.html）：
 * - 位置：屏幕底部偏上 60dp，水平居中
 * - 样式：背景 rgba(15,20,35,0.95)，1px 描边，圆角 999px（胶囊形）
 * - 内边距：8px × 18px
 * - 字号：0.72rem（约 11.5sp），Muted 色
 * - 动效：0.3s ease，fade + translateY(20px → 0)
 * - 层级：z-index 50，pointer-events: none（不拦截点击）
 * - 三种语义色变体：error/success/offline
 *
 * 用法：
 *   var toastState by remember { mutableStateOf(ToastState()) }
 *   ToastBar(state = toastState, onDismiss = { toastState = toastState.copy(visible = false) })
 *   // 触发：toastState = ToastState(message = "已清理", type = ToastType.Success, visible = true)
 */
@Composable
fun ToastBar(
    state: ToastState,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    // 语义色映射
    val (textColor, borderColor) = when (state.type) {
        ToastType.Success -> Agent to Agent.copy(alpha = 0.2f)
        ToastType.Error -> Danger to Danger.copy(alpha = 0.2f)
        ToastType.Offline -> Think to Think.copy(alpha = 0.2f)
        ToastType.Normal -> TextMuted to Color(0x14FFFFFF)  // rgba(255,255,255,0.08)
    }

    // 自动消失（3 秒，与 undo 提示一致）
    LaunchedEffect(state.visible, state.message) {
        if (state.visible && state.message.isNotEmpty()) {
            delay(3000)
            onDismiss()
        }
    }

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.BottomCenter
    ) {
        AnimatedVisibility(
            visible = state.visible,
            enter = fadeIn() + slideInVertically(initialOffsetY = { it / 3 }),
            exit = fadeOut() + slideOutVertically(targetOffsetY = { it / 3 }),
            modifier = Modifier.padding(bottom = 60.dp)
        ) {
            Text(
                text = state.message,
                color = textColor,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Normal,
                letterSpacing = 0.3.sp,
                modifier = Modifier
                    .background(
                        color = Deep.copy(alpha = 0.95f),
                        shape = RoundedCornerShape(999.dp)
                    )
                    .border(
                        width = 1.dp,
                        color = borderColor,
                        shape = RoundedCornerShape(999.dp)
                    )
                    .padding(horizontal = 18.dp, vertical = 8.dp)
            )
        }
    }
}

/**
 * 便捷的 Toast 控制器（用于在 ViewModel 或 Composable 中管理 Toast 状态）
 */
class ToastController {
    private var _state = mutableStateOf(ToastState())
    val state get() = _state.value

    fun show(message: String, type: ToastType = ToastType.Normal) {
        _state.value = ToastState(message = message, type = type, visible = true)
    }

    fun success(message: String) = show(message, ToastType.Success)
    fun error(message: String) = show(message, ToastType.Error)
    fun offline(message: String) = show(message, ToastType.Offline)

    fun dismiss() {
        _state.value = _state.value.copy(visible = false)
    }
}

/**
 * 记忆 Toast 控制器的 Composable 工具
 */
@Composable
fun rememberToastController(): ToastController = remember { ToastController() }

package com.lynnhub.app.ui.component

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.ui.theme.Amber500
import com.lynnhub.app.ui.theme.Green500
import com.lynnhub.app.ui.theme.Orange500
import com.lynnhub.app.ui.theme.Red500
import kotlinx.coroutines.delay

private val CaptureGradient = Brush.linearGradient(listOf(Amber500, Orange500))

/**
 * 全局闪电输入悬浮条
 *
 * 收起状态：小型闪电 FAB；展开状态：输入框 + 提交按钮。
 * 提交后调用 ApiService.createIdea，显示短暂成功提示后收起。
 */
@Composable
fun CaptureBar(
    viewModel: CaptureBarViewModel = hiltViewModel(),
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsState()
    CaptureBarContent(
        state = state,
        onExpand = viewModel::expand,
        onCollapse = viewModel::collapse,
        onTextChange = viewModel::onTextChanged,
        onSubmit = viewModel::submit,
        onMessageShown = viewModel::clearMessage,
        modifier = modifier
    )
}

@Composable
private fun CaptureBarContent(
    state: CaptureBarUiState,
    onExpand: () -> Unit,
    onCollapse: () -> Unit,
    onTextChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onMessageShown: () -> Unit,
    modifier: Modifier = Modifier
) {
    // 成功提示 1.5s 后自动消失
    LaunchedEffect(state.successMessage) {
        if (state.successMessage != null) {
            delay(1500)
            onMessageShown()
        }
    }

    Box(
        modifier = modifier,
        contentAlignment = Alignment.BottomCenter
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            SuccessPill(message = state.successMessage)
            ErrorPill(message = state.error)

            AnimatedContent(
                targetState = state.isExpanded,
                transitionSpec = {
                    (fadeIn() + slideInVertically { it / 2 }) togetherWith
                        (fadeOut() + slideOutVertically { -it / 2 })
                },
                contentKey = { it },
                label = "capture-bar-toggle"
            ) { expanded ->
                if (expanded) {
                    ExpandedInputBar(
                        text = state.text,
                        onTextChange = onTextChange,
                        onSubmit = onSubmit,
                        onClose = onCollapse,
                        isSubmitting = state.isSubmitting
                    )
                } else {
                    CollapsedFab(onClick = onExpand)
                }
            }
        }
    }
}

@Composable
private fun CollapsedFab(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .shadow(6.dp, CircleShape)
            .clip(CircleShape)
            .background(CaptureGradient)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Rounded.Bolt,
            contentDescription = "闪电输入",
            tint = Color.White,
            modifier = Modifier.size(26.dp)
        )
    }
}

@Composable
private fun ExpandedInputBar(
    text: String,
    onTextChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onClose: () -> Unit,
    isSubmitting: Boolean
) {
    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current

    LaunchedEffect(Unit) {
        try {
            focusRequester.requestFocus()
        } catch (_: Exception) {
            // TextField 尚未附着时忽略
        }
        keyboard?.show()
    }

    Surface(
        shape = RoundedCornerShape(28.dp),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 8.dp,
        tonalElevation = 3.dp,
        border = BorderStroke(1.dp, Amber500.copy(alpha = 0.35f))
    ) {
        Row(
            modifier = Modifier
                .widthIn(min = 280.dp, max = 360.dp)
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = { keyboard?.hide(); onClose() },
                modifier = Modifier.size(40.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.Close,
                    contentDescription = "收起",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp)
                )
            }

            TextField(
                value = text,
                onValueChange = onTextChange,
                modifier = Modifier
                    .weight(1f)
                    .focusRequester(focusRequester),
                placeholder = { Text("捕捉一个灵感...", fontSize = 14.sp) },
                singleLine = true,
                textStyle = LocalTextStyle.current.copy(fontSize = 14.sp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(
                    onSend = { keyboard?.hide(); onSubmit() }
                ),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    disabledContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent
                )
            )

            val submitEnabled = text.isNotBlank() && !isSubmitting
            SubmitButton(
                enabled = submitEnabled,
                isSubmitting = isSubmitting,
                onClick = { keyboard?.hide(); onSubmit() }
            )
        }
    }
}

@Composable
private fun SubmitButton(
    enabled: Boolean,
    isSubmitting: Boolean,
    onClick: () -> Unit
) {
    val background = if (enabled) {
        CaptureGradient
    } else {
        Brush.linearGradient(
            listOf(Amber500.copy(alpha = 0.4f), Orange500.copy(alpha = 0.4f))
        )
    }
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(background)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (isSubmitting) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                strokeWidth = 2.dp,
                color = Color.White
            )
        } else {
            Icon(
                imageVector = Icons.Rounded.Send,
                contentDescription = "提交",
                tint = Color.White,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
private fun SuccessPill(message: String?) {
    AnimatedVisibility(
        visible = message != null,
        enter = fadeIn() + expandVertically(),
        exit = fadeOut() + shrinkVertically()
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Green500,
            contentColor = Color.White
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    imageVector = Icons.Rounded.Check,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = message ?: "",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun ErrorPill(message: String?) {
    AnimatedVisibility(
        visible = message != null,
        enter = fadeIn() + expandVertically(),
        exit = fadeOut() + shrinkVertically()
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Red500,
            contentColor = Color.White
        ) {
            Text(
                text = message ?: "",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                fontSize = 13.sp
            )
        }
    }
}

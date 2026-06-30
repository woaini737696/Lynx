package com.lynnhub.app.ui.screen.login

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.IntOffset
import androidx.compose.animation.core.*
import androidx.compose.runtime.LaunchedEffect
import com.lynnhub.app.R
import com.lynnhub.app.ui.theme.*

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showPassword by remember { mutableStateOf(false) }
    val keyboardController = LocalSoftwareKeyboardController.current
    val passwordFocusRequester = remember { FocusRequester() }

    LaunchedEffect(uiState.loginSuccess) {
        if (uiState.loginSuccess) onLoginSuccess()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Void)
            .imePadding(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Logo（产品标准Logo：黑色背景白色猞猁）
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Void)
                    .border(1.dp, LiquidBorder, RoundedCornerShape(18.dp))
                    .shadow(
                        elevation = 0.dp,
                        ambientColor = PrimaryGlow,
                        spotColor = PrimaryGlow
                    ),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.lynx_logo_standard),
                    contentDescription = "Lynx",
                    modifier = Modifier.size(52.dp)
                )
            }

            // 品牌名
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "Lynx",
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                ),
                color = TextPrimary
            )

            // 表单
            Spacer(modifier = Modifier.height(32.dp))
            Column(modifier = Modifier.fillMaxWidth()) {
                // 手机号
                LynxInputField(
                    value = uiState.username,
                    onValueChange = viewModel::updateUsername,
                    placeholder = "手机号",
                    imeAction = ImeAction.Next,
                    onImeAction = { passwordFocusRequester.requestFocus() }
                )

                Spacer(modifier = Modifier.height(10.dp))

                // 密码
                LynxInputField(
                    value = uiState.password,
                    onValueChange = viewModel::updatePassword,
                    placeholder = "密码",
                    isPassword = !showPassword,
                    imeAction = ImeAction.Done,
                    onImeAction = {
                        keyboardController?.hide()
                        viewModel.login()
                    },
                    modifier = Modifier.focusRequester(passwordFocusRequester),
                    trailingIcon = {
                        IconButton(
                            onClick = { showPassword = !showPassword },
                            modifier = Modifier.size(20.dp)
                        ) {
                            Icon(
                                imageVector = if (showPassword) Icons.Filled.VisibilityOff
                                    else Icons.Filled.Visibility,
                                contentDescription = "切换密码可见",
                                tint = TextMuted,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                )

                // inline 错误提示
                val errorMsg = uiState.error
                if (errorMsg != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = errorMsg,
                        color = Danger,
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = 12.sp
                    )
                }

                // 登录按钮
                Spacer(modifier = Modifier.height(16.dp))
                val buttonBrush = if (uiState.isLoading) {
                    Brush.horizontalGradient(listOf(Primary.copy(alpha = 0.3f), Primary.copy(alpha = 0.3f)))
                } else {
                    Brush.horizontalGradient(GradientPrimary)
                }
                Button(
                    onClick = {
                        keyboardController?.hide()
                        viewModel.login()
                    },
                    enabled = !uiState.isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .background(buttonBrush, RoundedCornerShape(12.dp)),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.Transparent,
                        disabledContainerColor = Color.Transparent
                    ),
                    contentPadding = PaddingValues(vertical = 0.dp)
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            color = Color.White,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(18.dp)
                        )
                    } else {
                        Text(
                            "登录",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            // 注册提示
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "首次使用？请在 Web 端注册",
                color = TextMuted,
                fontSize = 11.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Lynx v6 统一输入框样式
 * 圆角 12px，深色背景，聚焦时蓝色边框
 */
@Composable
private fun LynxInputField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    isPassword: Boolean = false,
    imeAction: ImeAction = ImeAction.Default,
    onImeAction: () -> Unit = {},
    modifier: Modifier = Modifier,
    trailingIcon: @Composable (() -> Unit)? = null
) {
    TextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = {
            Text(
                text = placeholder,
                color = TextMuted,
                fontSize = 14.sp
            )
        },
        singleLine = true,
        visualTransformation = if (isPassword) PasswordVisualTransformation()
            else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            keyboardType = if (isPassword) KeyboardType.Password else KeyboardType.Text,
            imeAction = imeAction
        ),
        keyboardActions = KeyboardActions(onAny = { onImeAction() }),
        trailingIcon = trailingIcon,
        colors = TextFieldDefaults.colors(
            focusedContainerColor = Surface,
            unfocusedContainerColor = Surface,
            disabledContainerColor = Surface,
            focusedIndicatorColor = Primary.copy(alpha = 0.5f),
            unfocusedIndicatorColor = BorderHover,
            disabledIndicatorColor = Color.Transparent,
            cursorColor = Primary,
            focusedTextColor = TextPrimary,
            unfocusedTextColor = TextPrimary
        ),
        textStyle = MaterialTheme.typography.bodyMedium.copy(
            fontSize = 14.sp
        ),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
    )
}

// 颜色引用（避免顶层 import 冲突）
private val Color = androidx.compose.ui.graphics.Color

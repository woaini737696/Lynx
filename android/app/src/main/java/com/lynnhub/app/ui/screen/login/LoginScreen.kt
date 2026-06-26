package com.lynnhub.app.ui.screen.login

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.ui.theme.Amber500
import com.lynnhub.app.ui.theme.Orange500

private val SuccessGreen = Color(0xFF22C55E)
private val Red500 = Color(0xFFEF4444)

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showPassword by remember { mutableStateOf(false) }
    var isFocused by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current

    // Animation states
    var isEntering by remember { mutableStateOf(false) }
    val pageAlpha by animateFloatAsState(
        targetValue = if (isEntering) 1f else 0f,
        animationSpec = tween(durationMillis = 500),
        label = "pageAlpha"
    )

    LaunchedEffect(Unit) {
        isEntering = true
    }

    LaunchedEffect(uiState.loginSuccess) {
        if (uiState.loginSuccess) onLoginSuccess()
    }

    // Button charge animation based on input
    val inputProgress = remember(uiState.username, uiState.password) {
        val hasUsername = uiState.username.isNotBlank()
        val hasPassword = uiState.password.isNotBlank()
        when {
            hasUsername && hasPassword -> 1f
            hasUsername || hasPassword -> 0.5f
            else -> 0f
        }
    }
    val buttonScale by animateFloatAsState(
        targetValue = if (uiState.isLoading) 0.96f else 1f,
        animationSpec = spring(dampingRatio = 0.6f, stiffness = 400f),
        label = "buttonScale"
    )

    // Shake animation for error
    val shakeOffset by animateFloatAsState(
        targetValue = if (uiState.error != null) 1f else 0f,
        animationSpec = if (uiState.error != null) {
            keyframes {
                durationMillis = 400
                0f at 0
                -10f at 50
                10f at 100
                -8f at 150
                8f at 200
                -4f at 250
                4f at 300
                0f at 400
            }
        } else {
            tween(durationMillis = 0)
        },
        label = "shake"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .graphicsLayer { alpha = pageAlpha }
    ) {
        // Background decoration - bottom gradient glow
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(300.dp)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color.Transparent,
                            Amber500.copy(alpha = 0.08f)
                        )
                    )
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 32.dp)
                .imePadding()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.height(80.dp))

            // Logo with floating animation
            LogoSection()

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "欢迎回来",
                fontSize = 28.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "登录 LynnHub",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(40.dp))

            // Username input with charge bar
            UsernameInput(
                value = uiState.username,
                onValueChange = viewModel::updateUsername,
                onFocusChanged = { isFocused = it }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Password input with charge bar
            PasswordInput(
                value = uiState.password,
                onValueChange = viewModel::updatePassword,
                showPassword = showPassword,
                onTogglePassword = { showPassword = !showPassword },
                onFocusChanged = { isFocused = it }
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Server config toggle
            ServerConfigToggle(
                expanded = uiState.showServerConfig,
                onToggle = viewModel::toggleServerConfig
            )

            AnimatedVisibility(
                visible = uiState.showServerConfig,
                enter = expandVertically(animationSpec = tween(300)) + fadeIn(),
                exit = shrinkVertically(animationSpec = tween(300)) + fadeOut()
            ) {
                ServerConfigInput(
                    value = uiState.baseUrl,
                    onValueChange = viewModel::updateBaseUrl
                )
            }

            // Error message with icon
            AnimatedVisibility(
                visible = uiState.error != null,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                uiState.error?.let { error ->
                    Spacer(modifier = Modifier.height(12.dp))
                    ErrorMessage(message = error)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Login button with charge effect
            LoginButton(
                enabled = uiState.username.isNotBlank() && uiState.password.isNotBlank(),
                isLoading = uiState.isLoading,
                inputProgress = inputProgress,
                buttonScale = buttonScale,
                shakeOffset = shakeOffset,
                onClick = {
                    keyboardController?.hide()
                    viewModel.login()
                }
            )

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "还没有账号？立即注册",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.clickable { /* TODO: navigate to register */ }
            )

            Spacer(modifier = Modifier.height(60.dp))
        }
    }
}

@Composable
private fun LogoSection() {
    val infiniteTransition = rememberInfiniteTransition(label = "logoFloat")
    val floatOffset by infiniteTransition.animateFloat(
        initialValue = -8f,
        targetValue = 8f,
        animationSpec = infiniteRepeatable(
            animation = tween(2000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "floatOffset"
    )

    Box(
        modifier = Modifier
            .offset(y = floatOffset.dp)
            .size(80.dp),
        contentAlignment = Alignment.Center
    ) {
        // Glow effect
        Box(
            modifier = Modifier
                .size(90.dp)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            Amber500.copy(alpha = 0.3f),
                            Color.Transparent
                        )
                    ),
                    shape = RoundedCornerShape(24.dp)
                )
        )
        Box(
            modifier = Modifier
                .size(80.dp)
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(Amber500, Orange500)
                    ),
                    shape = RoundedCornerShape(24.dp)
                )
                .shadow(12.dp, RoundedCornerShape(24.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "L",
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

@Composable
private fun UsernameInput(
    value: String,
    onValueChange: (String) -> Unit,
    onFocusChanged: (Boolean) -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    // Text scale animation
    val textScale by animateFloatAsState(
        targetValue = if (isPressed) 1.02f else 1f,
        animationSpec = tween(100),
        label = "textScale"
    )

    // Input field glow animation
    val glowAlpha by animateFloatAsState(
        targetValue = if (isFocused) 0.3f else 0f,
        animationSpec = tween(200),
        label = "glowAlpha"
    )

    Box {
        // Glow background
        if (isFocused) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .padding(-4.dp)
                    .background(
                        Amber500.copy(alpha = glowAlpha),
                        shape = RoundedCornerShape(20.dp)
                    )
            )
        }

        OutlinedTextField(
            value = value,
            onValueChange = { if (it.length <= 20) onValueChange(it) },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { focusState -> isFocused = focusState.isFocused; onFocusChanged(focusState.isFocused) },
            placeholder = {
                Text(
                    "请输入用户名",
                    modifier = Modifier.graphicsLayer { scaleX = textScale }
                )
            },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Filled.Person,
                    contentDescription = null,
                    tint = if (isFocused) Amber500 else MaterialTheme.colorScheme.onSurfaceVariant
                )
            },
            singleLine = true,
            shape = RoundedCornerShape(20.dp),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Amber500,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                focusedLeadingIconColor = Amber500,
                cursorColor = Amber500
            ),
            interactionSource = interactionSource
        )

        // Charge bar at bottom
        ChargeBar(progress = value.length.coerceAtMost(20) / 20f, isFocused = isFocused)
    }
}

@Composable
private fun PasswordInput(
    value: String,
    onValueChange: (String) -> Unit,
    showPassword: Boolean,
    onTogglePassword: () -> Unit,
    onFocusChanged: (Boolean) -> Unit
) {
    var isFocused by remember { mutableStateOf(false) }
    val interactionSource = remember { MutableInteractionSource() }

    // Password visibility toggle rotation
    val iconRotation by animateFloatAsState(
        targetValue = if (showPassword) 180f else 0f,
        animationSpec = tween(200),
        label = "iconRotation"
    )

    val glowAlpha by animateFloatAsState(
        targetValue = if (isFocused) 0.3f else 0f,
        animationSpec = tween(200),
        label = "glowAlpha"
    )

    Box {
        if (isFocused) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .padding(-4.dp)
                    .background(
                        Amber500.copy(alpha = glowAlpha),
                        shape = RoundedCornerShape(20.dp)
                    )
            )
        }

        OutlinedTextField(
            value = value,
            onValueChange = { if (it.length <= 30) onValueChange(it) },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { focusState -> isFocused = focusState.isFocused; onFocusChanged(focusState.isFocused) },
            placeholder = { Text("请输入密码") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Filled.Lock,
                    contentDescription = null,
                    tint = if (isFocused) Amber500 else MaterialTheme.colorScheme.onSurfaceVariant
                )
            },
            singleLine = true,
            shape = RoundedCornerShape(20.dp),
            visualTransformation = if (showPassword) VisualTransformation.None
            else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            trailingIcon = {
                IconButton(onClick = onTogglePassword) {
                    Icon(
                        imageVector = if (showPassword) Icons.Filled.VisibilityOff
                        else Icons.Filled.Visibility,
                        contentDescription = "显示/隐藏密码",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.graphicsLayer { rotationZ = iconRotation }
                    )
                }
            },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Amber500,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                focusedLeadingIconColor = Amber500,
                cursorColor = Amber500
            ),
            interactionSource = interactionSource
        )

        ChargeBar(progress = value.length.coerceAtMost(30) / 30f, isFocused = isFocused)
    }
}

@Composable
private fun ChargeBar(progress: Float, isFocused: Boolean) {
    val chargeProgress by animateFloatAsState(
        targetValue = if (isFocused) progress else 0f,
        animationSpec = tween(300),
        label = "chargeProgress"
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(3.dp)
            .padding(horizontal = 20.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(3.dp)
                .background(
                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                    shape = RoundedCornerShape(1.5.dp)
                )
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(chargeProgress.coerceIn(0f, 1f))
                .height(3.dp)
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(Amber500, Orange500)
                    ),
                    shape = RoundedCornerShape(1.5.dp)
                )
        )
    }
}

@Composable
private fun ServerConfigToggle(
    expanded: Boolean,
    onToggle: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onToggle() }
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.Start,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (expanded) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = "高级: 配置服务器",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )
    }
}

@Composable
private fun ServerConfigInput(
    value: String,
    onValueChange: (String) -> Unit
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        placeholder = { Text("http://10.0.2.2:5176/") },
        leadingIcon = {
            Icon(
                imageVector = Icons.Filled.Lock,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        singleLine = true,
        shape = RoundedCornerShape(20.dp),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Amber500,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
            focusedLeadingIconColor = Amber500,
            cursorColor = Amber500
        )
    )
}

@Composable
private fun ErrorMessage(message: String) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Red500.copy(alpha = 0.1f),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Filled.ErrorOutline,
                contentDescription = null,
                tint = Red500,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = Red500
            )
        }
    }
}

@Composable
private fun LoginButton(
    enabled: Boolean,
    isLoading: Boolean,
    inputProgress: Float,
    buttonScale: Float,
    shakeOffset: Float,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    // Calculate button color based on charge
    val disabledAlpha = 0.35f + (inputProgress * 0.25f)
    val buttonAlpha = if (enabled) 1f else disabledAlpha

    val scale by animateFloatAsState(
        targetValue = when {
            isLoading -> 0.96f
            isPressed -> 0.96f
            else -> 1f
        },
        animationSpec = spring(dampingRatio = 0.6f, stiffness = 400f),
        label = "scale"
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .offset(x = shakeOffset.dp)
            .scale(scale)
            .shadow(if (enabled) 8.dp else 0.dp, RoundedCornerShape(16.dp)),
        contentAlignment = Alignment.Center
    ) {
        // Button background
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Amber500.copy(alpha = buttonAlpha),
                            Orange500.copy(alpha = buttonAlpha)
                        )
                    ),
                    shape = RoundedCornerShape(16.dp)
                )
                .border(
                    width = if (enabled) 0.dp else 1.dp,
                    color = Amber500.copy(alpha = buttonAlpha * 0.5f),
                    shape = RoundedCornerShape(16.dp)
                )
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    enabled = !isLoading
                ) { onClick() },
            contentAlignment = Alignment.Center
        ) {
            Crossfade(
                targetState = isLoading,
                animationSpec = tween(200),
                label = "buttonContent"
            ) { loading ->
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = Color.White,
                        strokeWidth = 2.5.dp
                    )
                } else {
                    Text(
                        text = "登 录",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White.copy(alpha = buttonAlpha)
                    )
                }
            }
        }
    }
}

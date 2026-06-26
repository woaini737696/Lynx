package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.ui.theme.Amber500
import com.lynnhub.app.ui.theme.Orange500
import com.lynnhub.app.ui.theme.Red500
import com.lynnhub.app.util.Constants

@Composable
fun SettingsScreen(
    onLogout: () -> Unit,
    onNavigateToInbox: () -> Unit = {},
    onNavigateToMemory: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showBaseUrlDialog by remember { mutableStateOf(false) }
    var showLogoutDialog by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(scrollState)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Amber500, Orange500)
                    )
                )
                .statusBarsPadding()
                .padding(bottom = 32.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "我的",
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 28.sp
                    ),
                    color = Color.White,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 24.dp)
                )

                val nameForAvatar = (uiState.user?.displayName?.takeIf { it.isNotBlank() }
                    ?: uiState.user?.username?.takeIf { it.isNotBlank() }
                    ?: "U")
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(Color.White.copy(alpha = 0.3f), Color.White.copy(alpha = 0.1f))
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = nameForAvatar.first().toString(),
                        fontSize = 28.sp,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = uiState.user?.displayName?.takeIf { it.isNotBlank() }
                        ?: uiState.user?.username?.takeIf { it.isNotBlank() }
                        ?: "未登录",
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.SemiBold
                    ),
                    color = Color.White
                )

                Spacer(modifier = Modifier.height(4.dp))

                val subtitle = uiState.user?.username?.takeIf { it.isNotBlank() }?.let { "@$it" } ?: ""
                if (subtitle.isNotEmpty()) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.8f)
                    )
                }
            }
        }

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .offset(y = (-16).dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 20.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(count = "0", label = "想法")
                StatItem(count = "0", label = "任务")
                StatItem(count = "0", label = "笔记")
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        SettingsSection(title = "功能") {
            SettingsItem(
                icon = Icons.Default.Inbox,
                title = "灵感收件箱",
                onClick = onNavigateToInbox
            )
            HorizontalDivider(
                modifier = Modifier.padding(start = 56.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
                thickness = 0.5.dp
            )
            SettingsItem(
                icon = Icons.Default.Psychology,
                title = "记忆认知",
                onClick = onNavigateToMemory
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        SettingsSection(title = "外观") {
            ThemeSelector(
                currentTheme = uiState.theme,
                onThemeChange = { viewModel.setTheme(it) }
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        SettingsSection(title = "服务器") {
            SettingsItem(
                icon = Icons.Default.Dns,
                title = "服务器地址",
                subtitle = uiState.baseUrl,
                onClick = { showBaseUrlDialog = true }
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        SettingsSection(title = "关于") {
            SettingsItem(
                icon = Icons.Default.Info,
                title = "版本",
                subtitle = "0.1.0"
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        OutlinedButton(
            onClick = { showLogoutDialog = true },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .height(48.dp),
            shape = RoundedCornerShape(12.dp),
            border = ButtonDefaults.outlinedButtonBorder.copy(
                brush = Brush.horizontalGradient(listOf(Red500, Red500))
            ),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = Red500
            )
        ) {
            Icon(Icons.Default.Logout, contentDescription = null, tint = Red500)
            Spacer(modifier = Modifier.width(8.dp))
            Text("退出登录", fontWeight = FontWeight.SemiBold, color = Red500)
        }

        Spacer(modifier = Modifier.height(32.dp))
    }

    if (showBaseUrlDialog) {
        var text by remember { mutableStateOf(uiState.baseUrl) }
        AlertDialog(
            onDismissRequest = { showBaseUrlDialog = false },
            shape = RoundedCornerShape(20.dp),
            title = { Text("服务器地址") },
            text = {
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    label = { Text("URL") },
                    placeholder = { Text(Constants.DEFAULT_BASE_URL) },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Amber500,
                        focusedLabelColor = Amber500,
                        cursorColor = Amber500
                    )
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.setBaseUrl(text.trim())
                        showBaseUrlDialog = false
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = Amber500)
                ) { Text("保存") }
            },
            dismissButton = {
                TextButton(onClick = { showBaseUrlDialog = false }) { Text("取消") }
            }
        )
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            shape = RoundedCornerShape(20.dp),
            title = { Text("退出登录") },
            text = { Text("确定要退出登录吗？") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.logout()
                        onLogout()
                        showLogoutDialog = false
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = Red500)
                ) { Text("退出") }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) { Text("取消") }
            }
        )
    }
}

@Composable
private fun StatItem(count: String, label: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = count,
            style = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp
            ),
            color = Amber500
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun SettingsSection(
    title: String,
    content: @Composable () -> Unit
) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge.copy(
            fontWeight = FontWeight.SemiBold
        ),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
    )
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column { content() }
    }
}

@Composable
private fun SettingsItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String? = null,
    onClick: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = onClick != null) { onClick?.invoke() }
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Amber500.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = Amber500,
                modifier = Modifier.size(22.dp)
            )
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = FontWeight.Medium
                ),
                color = MaterialTheme.colorScheme.onSurface
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1
                )
            }
        }
        if (onClick != null) {
            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f),
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
private fun ThemeSelector(
    currentTheme: String,
    onThemeChange: (String) -> Unit
) {
    Column(modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
        ThemeOption("跟随系统", Constants.THEME_SYSTEM, currentTheme, onThemeChange)
        HorizontalDivider(
            modifier = Modifier.padding(start = 48.dp),
            color = MaterialTheme.colorScheme.surfaceVariant,
            thickness = 0.5.dp
        )
        ThemeOption("浅色模式", Constants.THEME_LIGHT, currentTheme, onThemeChange)
        HorizontalDivider(
            modifier = Modifier.padding(start = 48.dp),
            color = MaterialTheme.colorScheme.surfaceVariant,
            thickness = 0.5.dp
        )
        ThemeOption("深色模式", Constants.THEME_DARK, currentTheme, onThemeChange)
    }
}

@Composable
private fun ThemeOption(
    label: String,
    value: String,
    currentValue: String,
    onSelect: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onSelect(value) }
            .padding(horizontal = 8.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Amber500.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                when (value) {
                    Constants.THEME_LIGHT -> Icons.Default.LightMode
                    Constants.THEME_DARK -> Icons.Default.DarkMode
                    else -> Icons.Default.SettingsSuggest
                },
                contentDescription = null,
                tint = Amber500,
                modifier = Modifier.size(22.dp)
            )
        }
        Spacer(modifier = Modifier.width(14.dp))
        Text(
            text = label,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodyLarge.copy(
                fontWeight = FontWeight.Medium
            ),
            color = MaterialTheme.colorScheme.onSurface
        )
        RadioButton(
            selected = value == currentValue,
            onClick = { onSelect(value) },
            colors = RadioButtonDefaults.colors(
                selectedColor = Amber500,
                unselectedColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
            )
        )
    }
}

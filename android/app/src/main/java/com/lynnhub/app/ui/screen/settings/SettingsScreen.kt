package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
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
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.theme.*
import com.lynnhub.app.ui.screen.panel.ReturnSwipeDetector

/**
 * Lynx v6 设置面板
 *
 * 从右侧 88% 宽度侧滑进入，左侧 12% 为透明遮罩（点击关闭）。
 * 支持右滑关闭，无返回按钮，Dock 隐藏。
 */
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    onNavigateToProfile: () -> Unit = {},
    onNavigateToAiKey: () -> Unit = {},
    onNavigateToDevices: () -> Unit = {},
    onNavigateToMemory: () -> Unit = {},
    onNavigateToCognition: () -> Unit = {},
    onNavigateToNotification: () -> Unit = {},
    onNavigateToUpdate: () -> Unit = {},
    onNavigateToAbout: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showClearCacheDialog by remember { mutableStateOf(false) }
    var showLogoutDialog by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.35f))
    ) {
        Row(modifier = Modifier.fillMaxSize()) {
            // 左侧 12% 遮罩：点击关闭面板
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .weight(0.12f)
                    .clickable { onBack() }
            )

            // 右侧 88% 面板
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .weight(0.88f)
                    .background(Void)
                    .border(1.dp, LiquidBorder)
            ) {
                // 右滑关闭手势
                ReturnSwipeDetector(
                    returnDirection = "right",
                    onReturn = onBack,
                    modifier = Modifier.fillMaxSize()
                )

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .systemBarsPadding()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 18.dp)
                ) {
                    Spacer(modifier = Modifier.height(36.dp))

                    // 顶部标题
                    Text(
                        text = "设置",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        letterSpacing = (-0.3).sp
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // 个人信息区
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(Brush.linearGradient(GradientPrimary)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = (uiState.user?.displayName?.firstOrNull()?.toString())
                                    ?: (uiState.user?.username?.firstOrNull()?.toString()) ?: "U",
                                color = Color.White,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = uiState.user?.displayName?.ifBlank { null }
                                    ?: uiState.user?.username ?: "用户",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = uiState.user?.role ?: "",
                                fontSize = 11.sp,
                                color = TextMuted,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // AI & Agent 分组
                    SettingsGroupTitle("AI & Agent")
                    SettingsRow(
                        icon = LynxIcons.Key,
                        label = "AI Key",
                        onClick = onNavigateToAiKey
                    )
                    SettingsRow(
                        icon = LynxIcons.Device,
                        label = "已配对设备",
                        value = "1 台",
                        onClick = onNavigateToDevices
                    )

                    // 数据分组
                    SettingsGroupTitle("数据")
                    SettingsRow(
                        icon = LynxIcons.Memory,
                        label = "记忆图谱",
                        onClick = onNavigateToMemory
                    )
                    SettingsRow(
                        icon = LynxIcons.Assistant,
                        label = "认知库",
                        onClick = onNavigateToCognition
                    )

                    // 通知分组
                    SettingsGroupTitle("通知")
                    SettingsRow(
                        icon = LynxIcons.Notification,
                        label = "通知偏好",
                        value = "全部",
                        onClick = onNavigateToNotification
                    )
                    SettingsRow(
                        icon = LynxIcons.Mic,
                        label = "语音播报"
                    ) {
                        // Toggle 占位
                    }

                    // 关于分组
                    SettingsGroupTitle("关于")
                    SettingsRow(
                        icon = LynxIcons.Clock,
                        label = "检查更新",
                        onClick = onNavigateToUpdate
                    )
                    SettingsRow(
                        icon = LynxIcons.Info,
                        label = "关于我们",
                        onClick = onNavigateToAbout
                    )

                    // 个人资料入口
                    Spacer(modifier = Modifier.height(16.dp))
                    SettingsGroupTitle("账号")
                    SettingsRow(
                        icon = LynxIcons.Person,
                        label = "个人资料",
                        onClick = onNavigateToProfile
                    )

                    // 危险区域
                    Spacer(modifier = Modifier.height(24.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(Danger.copy(alpha = 0.1f))
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    DangerRow(
                        icon = LynxIcons.Trash,
                        label = "清除缓存",
                        onClick = { showClearCacheDialog = true }
                    )
                    DangerRow(
                        icon = LynxIcons.Logout,
                        label = "退出登录",
                        onClick = { showLogoutDialog = true }
                    )

                    Spacer(modifier = Modifier.height(40.dp))
                }
            }
        }
    }

    // 清除缓存确认弹窗
    if (showClearCacheDialog) {
        ConfirmDialog(
            title = "清除缓存？",
            text = "将清除本地缓存数据，不会影响云端数据",
            confirmText = "确认",
            onConfirm = {
                showClearCacheDialog = false
            },
            onDismiss = { showClearCacheDialog = false }
        )
    }

    // 退出登录确认弹窗
    if (showLogoutDialog) {
        ConfirmDialog(
            title = "退出登录？",
            text = "退出后需要重新登录",
            confirmText = "退出",
            onConfirm = {
                showLogoutDialog = false
                onLogout()
            },
            onDismiss = { showLogoutDialog = false }
        )
    }
}

@Composable
private fun SettingsGroupTitle(text: String) {
    Text(
        text = text,
        fontSize = 10.sp,
        color = TextMuted,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.5.sp,
        modifier = Modifier.padding(start = 4.dp, bottom = 6.dp, top = 12.dp)
    )
}

@Composable
private fun SettingsRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String? = null,
    onClick: (() -> Unit)? = null
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(enabled = onClick != null) { onClick?.invoke() }
            .padding(horizontal = 4.dp, vertical = 12.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = TextMuted,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = label,
            fontSize = 13.sp,
            color = TextPrimary,
            modifier = Modifier.weight(1f)
        )
        if (value != null) {
            Text(
                text = value,
                fontSize = 12.sp,
                color = TextMuted
            )
            Spacer(modifier = Modifier.width(4.dp))
        }
        if (onClick != null) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = null,
                tint = TextMuted,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun DangerRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 4.dp, vertical = 12.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Danger,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = label,
            fontSize = 13.sp,
            color = Danger
        )
    }
}

// ============ 确认弹窗组件 ============
@Composable
fun ConfirmDialog(
    title: String,
    text: String,
    confirmText: String = "确认",
    cancelText: String = "取消",
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Deep,
        titleContentColor = TextPrimary,
        title = {
            Text(text = title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        },
        text = {
            Text(text = text, color = TextMuted, fontSize = 12.sp)
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(confirmText, color = Danger, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(cancelText, color = TextPrimary)
            }
        }
    )
}

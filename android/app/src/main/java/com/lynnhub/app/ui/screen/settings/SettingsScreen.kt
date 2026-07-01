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
import androidx.compose.ui.window.Dialog
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
    onNavigateToTokenAnalysis: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showClearCacheDialog by remember { mutableStateOf(false) }
    var showLogoutDialog by remember { mutableStateOf(false) }
    var showThemeDialog by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background.copy(alpha = 0.55f))
    ) {
        Row(modifier = Modifier.fillMaxSize()) {
            // 左侧 12% 遮罩：点击关闭面板
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .weight(0.12f)
                    .clickable { onBack() }
            )

            // 右侧 88% 面板（28dp 左圆角，紧贴顶部不留空）
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .weight(0.88f)
                    .clip(RoundedCornerShape(topStart = 28.dp, bottomStart = 28.dp))
                    .background(MaterialTheme.colorScheme.background)
                    .border(1.dp, LiquidBorder, RoundedCornerShape(topStart = 28.dp, bottomStart = 28.dp))
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
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 22.dp)
                ) {
                    Spacer(modifier = Modifier.height(20.dp))

                    // 顶部标题
                    Text(
                        text = "设置",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        letterSpacing = (-0.3).sp
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // 个人信息区（glass 卡片包裹）
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(24.dp))
                            .background(Liquid2)
                            .border(1.dp, LiquidBorder, RoundedCornerShape(24.dp))
                            .padding(22.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(62.dp)
                                .clip(CircleShape)
                                .background(Brush.linearGradient(listOf(Primary, Agent))),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = (uiState.user?.displayName?.firstOrNull()?.toString())
                                    ?: (uiState.user?.username?.firstOrNull()?.toString()) ?: "U",
                                color = TextPrimary,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(
                                text = uiState.user?.displayName?.ifBlank { null }
                                    ?: uiState.user?.username ?: "用户",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = uiState.user?.role ?: "",
                                fontSize = 12.sp,
                                color = TextMuted,
                                modifier = Modifier.padding(top = 4.dp)
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
                    SettingsRow(
                        icon = LynxIcons.Assistant,
                        label = "词元分析",
                        onClick = onNavigateToTokenAnalysis
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

                    // 外观分组（主题切换）
                    SettingsGroupTitle("外观")
                    SettingsRow(
                        icon = LynxIcons.Info,
                        label = "主题模式",
                        value = themeLabel(uiState.theme),
                        onClick = { showThemeDialog = true }
                    )

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

    // 主题切换弹窗
    if (showThemeDialog) {
        ThemePickerDialog(
            currentTheme = uiState.theme,
            onSelect = { theme ->
                viewModel.setTheme(theme)
                showThemeDialog = false
            },
            onDismiss = { showThemeDialog = false }
        )
    }
}

/** 主题模式中文标签 */
private fun themeLabel(theme: String): String = when (theme) {
    "dark" -> "深色"
    "light" -> "浅色"
    else -> "跟随系统"
}

/**
 * 毛玻璃弹窗容器：半透明 + 渐变 + 细描边，营造液态玻璃质感
 * 兼容所有 Android 版本（无 blur 依赖，靠半透明 + 渐变模拟）
 */
@Composable
private fun FrostedGlassDialog(
    onDismiss: () -> Unit,
    content: @Composable () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(24.dp))
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.surface.copy(alpha = 0.82f),
                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.72f)
                        )
                    )
                )
                .border(
                    1.dp,
                    MaterialTheme.colorScheme.outline.copy(alpha = 0.18f),
                    RoundedCornerShape(24.dp)
                )
        ) {
            content()
        }
    }
}

/**
 * 主题选择弹窗：深色 / 浅色 / 跟随系统
 * 选择后立即生效（MainActivity 监听 themeFlow 自动 recomposition）
 * 毛玻璃背景效果，半透明 + 渐变
 */
@Composable
private fun ThemePickerDialog(
    currentTheme: String,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val options = listOf(
        "light" to "浅色（白天）",
        "dark" to "深色（夜晚）",
        "system" to "跟随系统"
    )
    FrostedGlassDialog(onDismiss = onDismiss) {
        Column(modifier = Modifier.padding(24.dp)) {
            Text(
                text = "主题模式",
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(16.dp))
            options.forEach { (value, label) ->
                val isSelected = value == currentTheme
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isSelected) Primary.copy(alpha = 0.12f) else Color.Transparent)
                        .clickable { onSelect(value) }
                        .padding(horizontal = 12.dp, vertical = 12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(if (isSelected) Primary else Color.Transparent)
                            .border(
                                1.dp,
                                if (isSelected) Primary else MaterialTheme.colorScheme.outline,
                                CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isSelected) {
                            Icon(
                                imageVector = LynxIcons.Check,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.size(12.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = label,
                        fontSize = 14.sp,
                        color = if (isSelected) Primary else MaterialTheme.colorScheme.onSurface,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "关闭",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp,
                modifier = Modifier
                    .align(Alignment.End)
                    .clickable { onDismiss() }
                    .padding(vertical = 8.dp, horizontal = 12.dp)
            )
        }
    }
}

@Composable
private fun SettingsGroupTitle(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        color = TextMuted,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.2.sp,
        modifier = Modifier.padding(start = 4.dp, bottom = 10.dp, top = 22.dp)
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
            .padding(bottom = 10.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(Liquid3)
            .border(1.dp, LiquidBorder, RoundedCornerShape(18.dp))
            .clickable(enabled = onClick != null) { onClick?.invoke() }
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        // 34dp 玻璃图标容器
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Liquid3)
                .border(1.dp, BorderSubtle, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = TextPrimary,
                modifier = Modifier.size(18.dp)
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        // 标签 + 值垂直堆叠（按视觉稿 settings-row-text）
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                fontSize = 14.sp,
                color = TextPrimary,
                fontWeight = FontWeight.Medium
            )
            if (value != null) {
                Text(
                    text = value,
                    fontSize = 12.sp,
                    color = TextMuted,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }
        if (onClick != null) {
            Spacer(modifier = Modifier.width(4.dp))
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
            .padding(bottom = 10.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(Liquid3)
            .border(1.dp, Danger.copy(alpha = 0.12f), RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        // 34dp 玻璃图标容器
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Danger.copy(alpha = 0.08f))
                .border(1.dp, Danger.copy(alpha = 0.15f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Danger,
                modifier = Modifier.size(18.dp)
            )
        }
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = label,
            fontSize = 13.sp,
            color = Danger
        )
    }
}

// ============ 确认弹窗组件（毛玻璃背景） ============
@Composable
fun ConfirmDialog(
    title: String,
    text: String,
    confirmText: String = "确认",
    cancelText: String = "取消",
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    FrostedGlassDialog(onDismiss = onDismiss) {
        Column(modifier = Modifier.padding(24.dp)) {
            Text(
                text = title,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = text,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 12.sp
            )
            Spacer(modifier = Modifier.height(20.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                Text(
                    text = cancelText,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .clickable { onDismiss() }
                        .padding(vertical = 8.dp, horizontal = 12.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = confirmText,
                    color = Danger,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .clickable { onConfirm() }
                        .padding(vertical = 8.dp, horizontal = 12.dp)
                )
            }
        }
    }
}

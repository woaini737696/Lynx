package com.lynnhub.app.ui.screen.settings

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.lynnhub.app.ui.component.LynxIcons
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.BorderSubtle
import com.lynnhub.app.ui.theme.Danger
import com.lynnhub.app.ui.theme.GlassBorderDeep
import com.lynnhub.app.ui.theme.GlassBorderSubtle
import com.lynnhub.app.ui.theme.GlassDeepSoft
import com.lynnhub.app.ui.theme.GlassHighlightDeep
import com.lynnhub.app.ui.theme.GlassShadowDeep
import com.lynnhub.app.ui.theme.Liquid2
import com.lynnhub.app.ui.theme.Liquid3
import com.lynnhub.app.ui.theme.LiquidBorder
import com.lynnhub.app.ui.theme.Motion
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.PrimaryDeep
import com.lynnhub.app.ui.theme.SettingsPanelBg
import com.lynnhub.app.ui.theme.SettingsScrim
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import com.lynnhub.app.ui.screen.panel.ReturnSwipeDetector

/**
 * Lynx v6 设置面板 v2（iOS26 液态玻璃 + 解决跳动）
 *
 * 修复要点：
 * 1. 分离静态遮罩与滑入面板
 *    - 静态遮罩立即覆盖全屏（SettingsScrim），不参与滑入动画 → 消除跳动
 *    - 面板单独使用 Animatable 控制 offsetX 从 panelWidth 到 0
 * 2. 面板背景改用 SettingsPanelBg (95% Void) 深色
 * 3. 内部使用 LazyColumn 替代 verticalScroll（性能更好）
 * 4. 设置项改用 iOS26 液态玻璃风格（GlassDeepSoft + 高光描边）
 *
 * 配合 AppNavigation 中 Settings 路由的 enterTransition 改为 fadeIn（短淡入）
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

    // ====== 面板滑入动画 ======
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val panelWidthPx = with(density) { (configuration.screenWidthDp.dp * 0.88f).toPx() }
    val panelOffset = remember { Animatable(panelWidthPx) }
    LaunchedEffect(Unit) {
        panelOffset.animateTo(
            targetValue = 0f,
            animationSpec = tween(
                durationMillis = Motion.DURATION_SETTINGS_PANEL,
                easing = Motion.EaseGlass
            )
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            // 静态遮罩立即覆盖全屏，不参与滑入动画
            .background(SettingsScrim)
    ) {
        // 左侧 12% 遮罩点击区（点击关闭面板）
        Box(
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(0.12f)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onBack
                )
        )

        // 右侧 88% 面板：使用 graphicsLayer 应用 offsetX，独立于遮罩
        Box(
            modifier = Modifier
                .align(Alignment.CenterEnd)
                .fillMaxHeight()
                .fillMaxWidth(0.88f)
                .graphicsLayer { translationX = panelOffset.value }
                .clip(RoundedCornerShape(topStart = 28.dp, bottomStart = 28.dp))
                .background(SettingsPanelBg)
                .border(1.dp, GlassBorderDeep, RoundedCornerShape(topStart = 28.dp, bottomStart = 28.dp))
                .drawBehind {
                    // 左侧高光（面板标志性元素）
                    drawLine(
                        color = GlassHighlightDeep.copy(alpha = 0.4f),
                        start = Offset(0f, 28f),
                        end = Offset(0f, size.height - 28f),
                        strokeWidth = 1f
                    )
                }
        ) {
            // 右滑关闭手势
            ReturnSwipeDetector(
                returnDirection = "right",
                onReturn = onBack,
                modifier = Modifier.fillMaxSize()
            )

            // 固定顶部标题栏
            Column(
                modifier = Modifier.fillMaxSize()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 22.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "设置",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        letterSpacing = (-0.5).sp
                    )
                }

                // 可滚动内容
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 22.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    // 个人信息区
                    item {
                        ProfileCard(
                            displayName = uiState.user?.displayName?.ifBlank { null }
                                ?: uiState.user?.username ?: "用户",
                            role = uiState.user?.role ?: "",
                            initial = (uiState.user?.displayName?.firstOrNull()?.toString())
                                ?: (uiState.user?.username?.firstOrNull()?.toString()) ?: "U"
                        )
                    }

                    // AI & Agent 分组
                    item { SettingsGroupTitle("AI & Agent") }
                    item {
                        SettingsRow(
                            icon = LynxIcons.Key,
                            label = "AI Key",
                            onClick = onNavigateToAiKey
                        )
                    }
                    item {
                        SettingsRow(
                            icon = LynxIcons.Device,
                            label = "已配对设备",
                            value = "1 台",
                            onClick = onNavigateToDevices
                        )
                    }
                    item {
                        SettingsRow(
                            icon = LynxIcons.Assistant,
                            label = "词元分析",
                            onClick = onNavigateToTokenAnalysis
                        )
                    }

                    // 数据分组
                    item { SettingsGroupTitle("数据") }
                    item {
                        SettingsRow(
                            icon = LynxIcons.Memory,
                            label = "记忆图谱",
                            onClick = onNavigateToMemory
                        )
                    }
                    item {
                        SettingsRow(
                            icon = LynxIcons.Assistant,
                            label = "认知库",
                            onClick = onNavigateToCognition
                        )
                    }

                    // 通知分组
                    item { SettingsGroupTitle("通知") }
                    item {
                        SettingsRow(
                            icon = LynxIcons.Notification,
                            label = "通知偏好",
                            value = "全部",
                            onClick = onNavigateToNotification
                        )
                    }
                    item {
                        SettingsRow(
                            icon = LynxIcons.Mic,
                            label = "语音播报"
                        )
                    }

                    // 关于分组
                    item { SettingsGroupTitle("关于") }
                    item {
                        SettingsRow(
                            icon = LynxIcons.Clock,
                            label = "检查更新",
                            onClick = onNavigateToUpdate
                        )
                    }
                    item {
                        SettingsRow(
                            icon = LynxIcons.Info,
                            label = "关于我们",
                            onClick = onNavigateToAbout
                        )
                    }

                    // 账号
                    item { SettingsGroupTitle("账号") }
                    item {
                        SettingsRow(
                            icon = LynxIcons.Person,
                            label = "个人资料",
                            onClick = onNavigateToProfile
                        )
                    }

                    // 危险区域
                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(Danger.copy(alpha = 0.1f))
                        )
                    }
                    item {
                        DangerRow(
                            icon = LynxIcons.Trash,
                            label = "清除缓存",
                            onClick = { showClearCacheDialog = true }
                        )
                    }
                    item {
                        DangerRow(
                            icon = LynxIcons.Logout,
                            label = "退出登录",
                            onClick = { showLogoutDialog = true }
                        )
                    }

                    item { Spacer(modifier = Modifier.height(40.dp)) }
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
            onConfirm = { showClearCacheDialog = false },
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

// ============ 个人信息卡片 ============
@Composable
private fun ProfileCard(
    displayName: String,
    role: String,
    initial: String
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(GlassDeepSoft)
            .border(1.dp, GlassBorderSubtle, RoundedCornerShape(24.dp))
            .drawBehind {
                // 顶部高光
                drawLine(
                    color = GlassHighlightDeep.copy(alpha = 0.5f),
                    start = Offset(24f, 0f),
                    end = Offset(size.width - 24f, 0f),
                    strokeWidth = 1f
                )
            }
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
                text = initial,
                color = TextPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )
        }
        Spacer(modifier = Modifier.width(16.dp))
        Column {
            Text(
                text = displayName,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
            Text(
                text = role,
                fontSize = 12.sp,
                color = TextMuted,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

@Composable
private fun SettingsGroupTitle(text: String) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        color = TextMuted,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.2.sp,
        modifier = Modifier.padding(start = 4.dp, top = 22.dp, bottom = 10.dp)
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
            .padding(bottom = 6.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(GlassDeepSoft)
            .border(1.dp, GlassBorderSubtle, RoundedCornerShape(18.dp))
            .drawBehind {
                drawLine(
                    color = GlassHighlightDeep.copy(alpha = 0.25f),
                    start = Offset(18f, 0f),
                    end = Offset(size.width - 18f, 0f),
                    strokeWidth = 1f
                )
            }
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                enabled = onClick != null,
                onClick = { onClick?.invoke() }
            )
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
            .padding(bottom = 6.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(GlassDeepSoft)
            .border(1.dp, Danger.copy(alpha = 0.12f), RoundedCornerShape(18.dp))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            )
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
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

// ============ 确认弹窗组件（深色液态玻璃） ============
@Composable
fun ConfirmDialog(
    title: String,
    text: String,
    confirmText: String = "确认",
    cancelText: String = "取消",
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    com.lynnhub.app.ui.component.FrostedGlassDialog(onDismiss = onDismiss) {
        Column(modifier = Modifier.padding(28.dp)) {
            Text(
                text = title,
                fontWeight = FontWeight.SemiBold,
                fontSize = 17.sp,
                color = TextPrimary
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = text,
                color = TextMuted,
                fontSize = 13.sp,
                lineHeight = 18.sp
            )
            Spacer(modifier = Modifier.height(24.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                Text(
                    text = cancelText,
                    color = TextMuted,
                    fontSize = 14.sp,
                    modifier = Modifier
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = onDismiss
                        )
                        .padding(vertical = 8.dp, horizontal = 14.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = confirmText,
                    color = Danger,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    modifier = Modifier
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = onConfirm
                        )
                        .padding(vertical = 8.dp, horizontal = 14.dp)
                )
            }
        }
    }
}

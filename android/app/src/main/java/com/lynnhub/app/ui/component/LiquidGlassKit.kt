package com.lynnhub.app.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lynnhub.app.ui.theme.Agent
import com.lynnhub.app.ui.theme.BubbleAssistantBorder
import com.lynnhub.app.ui.theme.BubbleAssistantDeep
import com.lynnhub.app.ui.theme.BubbleUserBorder
import com.lynnhub.app.ui.theme.BubbleUserDeep
import com.lynnhub.app.ui.theme.DialogDeepPrimary
import com.lynnhub.app.ui.theme.DialogDeepSecondary
import com.lynnhub.app.ui.theme.DialogScrim
import com.lynnhub.app.ui.theme.GlassBorderDeep
import com.lynnhub.app.ui.theme.GlassBorderSubtle
import com.lynnhub.app.ui.theme.GlassDeepBase
import com.lynnhub.app.ui.theme.GlassDeepSoft
import com.lynnhub.app.ui.theme.GlassDeepSubtle
import com.lynnhub.app.ui.theme.GlassGlowPrimary
import com.lynnhub.app.ui.theme.GlassHighlightDeep
import com.lynnhub.app.ui.theme.GlassShadowDeep
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary
import com.lynnhub.app.ui.theme.TopBarDeep
import com.lynnhub.app.ui.theme.TopBarDeepBlur
import com.lynnhub.app.ui.theme.Void

/**
 * iOS26 液态玻璃统一组件库 v4
 *
 * 设计目标：1:1 还原 iOS26 App Store 视觉效果
 * - 多层深色叠加（避免白色 .copy(alpha) 染色）
 * - 顶部高光描边 + 底部阴影
 * - 28dp 大圆角（App Store 卡片标准）
 * - 全局 glass 缓动动效
 *
 * 用法：
 *   GlassDialog    —— 深色液态玻璃弹窗
 *   GlassTopBar    —— 固定顶部栏（含返回按钮）
 *   GlassPageScaffold —— 子页面统一脚手架
 *   GlassBubble    —— 聊天气泡
 *   GlassIconButton —— 玻璃图标按钮
 */

// ============ 玻璃强度枚举 ============
enum class GlassStrength {
    Strong,   // 85% Void
    Normal,   // 70% Void
    Subtle    // 50% Deep
}

private fun glassBaseColor(strength: GlassStrength): Color = when (strength) {
    GlassStrength.Strong -> GlassDeepBase
    GlassStrength.Normal -> GlassDeepSoft
    GlassStrength.Subtle -> GlassDeepSubtle
}

// ============ 1. 液态玻璃容器基础 ============
/**
 * 液态玻璃容器：深色叠加 + 顶部高光 + 描边 + 阴影
 * 1:1 还原 iOS26 App Store 卡片视觉
 *
 * @param strength 玻璃强度
 * @param cornerRadius 圆角，默认 28dp（App Store 标准）
 * @param showHighlight 是否显示顶部高光线
 * @param showShadow 是否显示底部阴影
 */
@Composable
fun LiquidGlassSurface(
    modifier: Modifier = Modifier,
    strength: GlassStrength = GlassStrength.Normal,
    cornerRadius: Dp = 28.dp,
    showHighlight: Boolean = true,
    showShadow: Boolean = true,
    content: @Composable BoxScope.() -> Unit
) {
    val baseColor = glassBaseColor(strength)
    val shape = RoundedCornerShape(cornerRadius)
    val borderColor = if (strength == GlassStrength.Strong) GlassBorderDeep else GlassBorderSubtle

    Box(
        modifier = modifier
            .clip(shape)
            .then(if (showShadow) Modifier.shadow(
                elevation = if (strength == GlassStrength.Strong) 24.dp else 12.dp,
                shape = shape,
                ambientColor = GlassShadowDeep,
                spotColor = GlassShadowDeep
            ) else Modifier)
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        baseColor,
                        DialogDeepSecondary
                    ),
                    start = Offset(0f, 0f),
                    end = Offset(0f, Float.POSITIVE_INFINITY)
                )
            )
            .border(1.dp, borderColor, shape)
            .then(
                if (showHighlight) {
                    Modifier.drawBehind {
                        // 顶部 1px 高光线（iOS26 液态玻璃标志性元素）
                        drawLine(
                            color = GlassHighlightDeep.copy(alpha = 0.5f),
                            start = Offset(cornerRadius.toPx(), 0f),
                            end = Offset(size.width - cornerRadius.toPx(), 0f),
                            strokeWidth = 1f
                        )
                        // 左上微弱渐变高光（模拟环境光反射）
                        drawRect(
                            brush = Brush.linearGradient(
                                colors = listOf(
                                    GlassHighlightDeep.copy(alpha = 0.08f),
                                    Color.Transparent
                                ),
                                start = Offset(0f, 0f),
                                end = Offset(size.width * 0.6f, size.height * 0.4f)
                            ),
                            size = size
                        )
                        // Primary 微弱光晕（左下）
                        drawRect(
                            brush = Brush.radialGradient(
                                colors = listOf(
                                    GlassGlowPrimary,
                                    Color.Transparent
                                ),
                                center = Offset(size.width * 0.1f, size.height * 0.9f),
                                radius = size.minDimension * 0.6f
                            ),
                            size = size
                        )
                    }
                } else Modifier
            ),
        content = content
    )
}

// ============ 2. 深色液态玻璃弹窗 ============
/**
 * 深色液态玻璃弹窗容器
 *
 * 解决旧 FrostedGlassDialog 的白色 .copy(alpha=0.95f) 问题
 * 采用 DialogDeepPrimary 深色叠加 + 双层模糊模拟
 *
 * @param onDismiss 关闭回调
 * @param cornerRadius 圆角，默认 28dp
 */
@Composable
fun LiquidGlassDialog(
    onDismiss: () -> Unit,
    cornerRadius: Dp = 28.dp,
    content: @Composable () -> Unit
) {
    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(cornerRadius))
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            DialogDeepPrimary,      // 90% Void 顶部
                            DialogDeepSecondary     // 70% Deep 底部
                        )
                    )
                )
                .border(1.dp, GlassBorderDeep, RoundedCornerShape(cornerRadius))
                .drawBehind {
                    // 顶部高光
                    drawLine(
                        color = GlassHighlightDeep.copy(alpha = 0.6f),
                        start = Offset(cornerRadius.toPx(), 0f),
                        end = Offset(size.width - cornerRadius.toPx(), 0f),
                        strokeWidth = 1.5f
                    )
                    // 左上环境光反射
                    drawRect(
                        brush = Brush.linearGradient(
                            colors = listOf(
                                GlassHighlightDeep.copy(alpha = 0.1f),
                                Color.Transparent
                            ),
                            start = Offset(0f, 0f),
                            end = Offset(size.width * 0.7f, size.height * 0.5f)
                        ),
                        size = size
                    )
                }
        ) {
            content()
        }
    }
}

// ============ 3. 固定顶部栏 ============
/**
 * 固定顶部栏（iOS26 App Store 风格）
 *
 * 特性：
 * - 半透明深色背景 + 模糊层模拟
 * - 状态栏安全区域
 * - 顶部高光描边
 * - 不随页面滚动
 *
 * @param title 标题
 * @param onBack 返回回调
 * @param actions 右侧操作按钮区
 */
@Composable
fun GlassTopBar(
    title: String,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {}
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        TopBarDeep,        // 80% Void 顶部
                        TopBarDeepBlur     // 60% Deep 底部，渐变模糊
                    )
                )
            )
            .statusBarsPadding()
            .drawBehind {
                // 底部分隔线（iOS26 App Store 顶部栏标志性元素）
                drawLine(
                    color = GlassBorderSubtle,
                    start = Offset(0f, size.height),
                    end = Offset(size.width, size.height),
                    strokeWidth = 1f
                )
                // 顶部高光
                drawLine(
                    color = GlassHighlightDeep.copy(alpha = 0.3f),
                    start = Offset(0f, 0f),
                    end = Offset(size.width, 0f),
                    strokeWidth = 1f
                )
            }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f)
            ) {
                if (onBack != null) {
                    GlassBackButton(onClick = onBack)
                }
                Text(
                    text = title,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    letterSpacing = (-0.3).sp
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                content = actions
            )
        }
    }
}

// ============ 4. 玻璃返回按钮 ============
@Composable
fun GlassBackButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(38.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(GlassDeepSoft)
            .border(1.dp, GlassBorderSubtle, RoundedCornerShape(12.dp))
            .clickable(
                interactionSource = androidx.compose.runtime.remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = "返回",
            tint = TextPrimary,
            modifier = Modifier.size(20.dp)
        )
    }
}

// ============ 5. 子页面统一脚手架 ============
/**
 * 子页面统一脚手架（解决顶部不悬浮问题）
 *
 * 结构：固定 GlassTopBar + LazyColumn 滚动内容
 * 返回按钮固定吸附顶部，不被内容遮挡
 *
 * @param title 页面标题
 * @param onBack 返回回调
 * @param actions TopBar 右侧操作区
 * @param content LazyColumn 内容
 */
@Composable
fun GlassPageScaffold(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
    content: LazyListScope.() -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // 固定顶部栏
            GlassTopBar(title = title, onBack = onBack, actions = actions)

            // 可滚动内容
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(
                    start = 22.dp,
                    end = 22.dp,
                    top = 16.dp,
                    bottom = 32.dp
                ),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                content = content
            )
        }
    }
}

// ============ 6. 聊天气泡 ============
/**
 * iOS26 液态玻璃聊天气泡
 *
 * 用户在右（蓝色描边 + 深蓝底）
 * AI在左（青色描边 + 深青底）
 */
/**
 * 统一顶部栏脚手架（普通 Column 内容版，支持 verticalScroll）
 *
 * 用于表单/输入型子页面（如灵感速记）：
 * - 顶部 GlassTopBar 固定吸附状态栏
 * - 内容区 verticalScroll 滚动
 * - 自动处理状态栏安全区域
 *
 * @param title 顶部栏标题
 * @param onBack 返回回调
 * @param actions TopBar 右侧操作区
 * @param contentPadding 内容区内边距
 * @param content 可滚动内容
 */
@Composable
fun TopBarColumnScaffold(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
    contentPadding: PaddingValues = PaddingValues(
        start = 22.dp, end = 22.dp, top = 16.dp, bottom = 24.dp
    ),
    content: @Composable ColumnScope.() -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // 固定顶部栏（不随滚动）
            GlassTopBar(title = title, onBack = onBack, actions = actions)

            // 可滚动内容
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .imePadding()
                    .verticalScroll(rememberScrollState())
                    .padding(contentPadding),
                content = content
            )
        }
    }
}

@Composable
fun GlassBubble(
    message: String,
    isUser: Boolean,
    modifier: Modifier = Modifier
) {
    val bubbleColor = if (isUser) BubbleUserDeep else BubbleAssistantDeep
    val borderColor = if (isUser) BubbleUserBorder else BubbleAssistantBorder
    val cornerRadius = 20.dp

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.78f)
                .clip(
                    RoundedCornerShape(
                        topStart = cornerRadius,
                        topEnd = cornerRadius,
                        bottomStart = if (isUser) cornerRadius else 4.dp,
                        bottomEnd = if (isUser) 4.dp else cornerRadius
                    )
                )
                .background(bubbleColor)
                .border(1.dp, borderColor, RoundedCornerShape(
                    topStart = cornerRadius,
                    topEnd = cornerRadius,
                    bottomStart = if (isUser) cornerRadius else 4.dp,
                    bottomEnd = if (isUser) 4.dp else cornerRadius
                ))
                .drawBehind {
                    // 顶部高光
                    drawLine(
                        color = GlassHighlightDeep.copy(alpha = 0.3f),
                        start = Offset(8f, 0f),
                        end = Offset(size.width - 8f, 0f),
                        strokeWidth = 1f
                    )
                }
                .padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Text(
                text = message.ifBlank { "(空消息)" },
                color = TextPrimary,
                fontSize = 13.5.sp,
                lineHeight = 20.sp
            )
        }
    }
}

// ============ 7. 玻璃图标按钮 ============
/**
 * 玻璃图标按钮（iOS26 App Store 圆形按钮）
 */
@Composable
fun GlassIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    tint: Color = TextPrimary
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(size / 2.5f))
            .background(GlassDeepSoft)
            .border(1.dp, GlassBorderSubtle, RoundedCornerShape(size / 2.5f))
            .drawBehind {
                drawLine(
                    color = GlassHighlightDeep.copy(alpha = 0.4f),
                    start = Offset(4f, 0f),
                    end = Offset(this.size.width - 4f, 0f),
                    strokeWidth = 1f
                )
            }
            .clickable(
                interactionSource = androidx.compose.runtime.remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = tint,
            modifier = Modifier.size(size * 0.45f)
        )
    }
}

// ============ 8. 玻璃分组标题 ============
@Composable
fun GlassGroupTitle(
    text: String,
    modifier: Modifier = Modifier
) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        color = TextMuted,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.2.sp,
        modifier = modifier.padding(start = 4.dp, bottom = 10.dp, top = 22.dp)
    )
}

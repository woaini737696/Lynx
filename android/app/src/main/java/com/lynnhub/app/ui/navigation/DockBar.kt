package com.lynnhub.app.ui.navigation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lynnhub.app.ui.component.Pressable
import com.lynnhub.app.ui.theme.Liquid3
import com.lynnhub.app.ui.theme.LiquidBorder
import com.lynnhub.app.ui.theme.LiquidHighlight
import com.lynnhub.app.ui.theme.Motion
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.TextPrimary

/**
 * 底部 Dock 导航栏
 *
 * - 仅出现在四个核心页面
 * - 药丸圆角、玻璃材质、顶部高光
 * - 选中态：品牌蓝 + 浅蓝背景高亮
 */
@Composable
fun DockBar(
    currentRoute: String,
    onTabSelected: (String) -> Unit,
    visible: Boolean,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(
        visible = visible,
        enter = slideInVertically(Motion.dockSpec()) { it },
        exit = slideOutVertically(Motion.dockSpec()) { it },
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 10.dp)
                .navigationBarsPadding()
        ) {
            Row(
                horizontalArrangement = Arrangement.SpaceAround,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(999.dp))
                    .background(Liquid3)
                    .border(1.dp, LiquidBorder, RoundedCornerShape(999.dp))
                    .padding(vertical = 10.dp, horizontal = 6.dp)
            ) {
                bottomTabs.forEach { tab ->
                    val selected = tab.route == currentRoute
                    DockItem(
                        tab = tab,
                        selected = selected,
                        onClick = { onTabSelected(tab.route) }
                    )
                }
            }
        }
    }
}

@Composable
private fun DockItem(
    tab: BottomTab,
    selected: Boolean,
    onClick: () -> Unit
) {
    val contentColor = if (selected) Primary else TextPrimary.copy(alpha = 0.55f)
    val bgColor = if (selected) Primary.copy(alpha = 0.12f) else androidx.compose.ui.graphics.Color.Transparent

    Pressable(
        onClick = onClick,
        modifier = Modifier
            .clip(RoundedCornerShape(18.dp))
            .background(bgColor)
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) { _ ->
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(5.dp)
        ) {
            Icon(
                imageVector = tab.icon,
                contentDescription = tab.title,
                tint = contentColor,
                modifier = Modifier.size(24.dp)
            )
            Text(
                text = tab.title,
                color = contentColor,
                fontSize = 9.sp,
                letterSpacing = 0.5.sp
            )
        }
    }
}

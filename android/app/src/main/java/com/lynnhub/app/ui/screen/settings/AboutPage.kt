package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.PrivacyTip
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lynnhub.app.BuildConfig
import com.lynnhub.app.ui.theme.GradientPrimary
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary

/** 8. 关于我们 */
@Composable
fun AboutPage(onBack: () -> Unit) {
    SubPageScaffold(title = "关于我们", onBack = onBack) {
        // Logo
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(GradientPrimary)),
                contentAlignment = Alignment.Center
            ) {
                Text("🦊", fontSize = 32.sp)
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                "Lynx",
                color = TextPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text("v${BuildConfig.VERSION_NAME}", color = TextMuted, fontSize = 12.sp)
            Text("Build ${BuildConfig.VERSION_CODE}", color = TextMuted, fontSize = 10.sp)
        }

        Spacer(modifier = Modifier.height(20.dp))

        // 链接项
        AboutRow(icon = Icons.Filled.PrivacyTip, label = "隐私政策") {
            // TODO: 跳转外部浏览器
        }
        AboutRow(icon = Icons.Filled.Description, label = "用户协议") {
            // TODO: 跳转外部浏览器
        }
        AboutRow(icon = Icons.Filled.Code, label = "开源许可") {
            // TODO: 展开列表
        }

        Spacer(modifier = Modifier.height(24.dp))
        InfoCard(
            title = "Lynx v6",
            text = "极简 · 人性 · 即时反馈。Lynx 是基于 HermesAgent 技术的超级助手，支持桌面/Shell/CLI/浏览器/应用控制、自主学习（重复 2x → 技能）、自我生长（记忆提取）、本地执行与隐私保护。"
        )
    }
}

@Composable
private fun AboutRow(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp)
    ) {
        Icon(icon, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            label,
            color = TextPrimary,
            fontSize = 13.sp,
            modifier = Modifier.weight(1f)
        )
        Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
    }
}

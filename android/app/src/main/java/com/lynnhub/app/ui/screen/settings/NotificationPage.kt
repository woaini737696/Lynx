package com.lynnhub.app.ui.screen.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lynnhub.app.ui.theme.BorderHover
import com.lynnhub.app.ui.theme.BorderSubtle
import com.lynnhub.app.ui.theme.Primary
import com.lynnhub.app.ui.theme.Surface
import com.lynnhub.app.ui.theme.TextMuted
import com.lynnhub.app.ui.theme.TextPrimary

/** 6. 通知偏好（纯本地状态） */
@Composable
fun NotificationPage(onBack: () -> Unit) {
    var level by remember { mutableStateOf("all") }  // all | important | approval
    var voiceBroadcast by remember { mutableStateOf(true) }
    var continuousChat by remember { mutableStateOf(false) }
    var pushPeriod by remember { mutableStateOf("all") }  // all | 8-22

    SubPageScaffold(title = "通知偏好", onBack = onBack) {
        FieldLabel("通知档位")
        Column(modifier = Modifier.padding(bottom = 16.dp)) {
            listOf("all" to "全部", "important" to "仅重要", "approval" to "仅审批").forEach { (key, label) ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (level == key) Primary.copy(alpha = 0.08f) else Surface)
                        .border(
                            1.dp,
                            if (level == key) Primary.copy(alpha = 0.3f) else BorderSubtle,
                            RoundedCornerShape(12.dp)
                        )
                        .clickable { level = key }
                        .padding(horizontal = 12.dp, vertical = 12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .clip(CircleShape)
                            .border(1.dp, if (level == key) Primary else TextMuted, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        if (level == key) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(Primary)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(label, color = TextPrimary, fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.height(6.dp))
            }
        }

        // 开关组
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp)
        ) {
            Text("语音播报", color = TextPrimary, fontSize = 13.sp, modifier = Modifier.weight(1f))
            ToggleSwitch(on = voiceBroadcast) { voiceBroadcast = !voiceBroadcast }
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp)
        ) {
            Text("连续对话", color = TextPrimary, fontSize = 13.sp, modifier = Modifier.weight(1f))
            ToggleSwitch(on = continuousChat) { continuousChat = !continuousChat }
        }

        Spacer(modifier = Modifier.height(16.dp))
        FieldLabel("推送时段")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(999.dp))
                .background(Surface)
                .border(1.dp, BorderHover, RoundedCornerShape(999.dp))
                .padding(4.dp)
        ) {
            listOf("all" to "全天", "8-22" to "8:00-22:00").forEach { (key, label) ->
                val selected = pushPeriod == key
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (selected) Primary else Color.Transparent)
                        .clickable { pushPeriod = key }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        label,
                        color = if (selected) TextPrimary else TextMuted,
                        fontSize = 12.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))
        InfoCard(
            title = "说明",
            text = "通知偏好保存在本地，重启 App 后生效。云端推送策略以 Web 端设置为准。"
        )
    }
}

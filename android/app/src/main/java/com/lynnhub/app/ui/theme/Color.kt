package com.lynnhub.app.ui.theme

import androidx.compose.ui.graphics.Color

// ============ Lynx v6 深海蓝深色主题 ============
// 设计文档：极简 · 人性 · 即时反馈

// ---------- 基础背景 ----------
val Void = Color(0xFF030816)        // 页面背景
val Deep = Color(0xFF0A0F1E)        // 次级背景（确认框等）

// ---------- Surface（卡片背景，半透明白） ----------
val Surface = Color(0x0AFFFFFF)          // rgba(255,255,255,0.04)
val SurfaceHover = Color(0x12FFFFFF)     // rgba(255,255,255,0.07)
val SurfaceActive = Color(0x1AFFFFFF)    // rgba(255,255,255,0.1)

// ---------- 品牌色 ----------
val Primary = Color(0xFF2B7FFF)          // 品牌、按钮、选中态
val PrimaryGlow = Color(0x402B7FFF)      // rgba(43,127,255,0.25) 光晕

// ---------- Agent 色 ----------
val Agent = Color(0xFF00D4AA)            // 成功、在线、Agent
val AgentGlow = Color(0x4000D4AA)        // rgba(0,212,170,0.25)

// ---------- Think 色 ----------
val Think = Color(0xFFFFB020)            // 思考、警告、离线
val ThinkGlow = Color(0x33FFB020)        // rgba(255,176,32,0.2)

// ---------- 危险色 ----------
val Danger = Color(0xFFFF4444)           // 删除、错误、退出

// ---------- 文字色 ----------
val TextPrimary = Color(0xFFE8ECF4)      // 主文本
val TextMuted = Color(0xFF5A6070)        // 辅助文本

// ---------- 边框/分割线（半透明白） ----------
val BorderSubtle = Color(0x0FFFFFFF)     // rgba(255,255,255,0.06)
val BorderHover = Color(0x14FFFFFF)      // rgba(255,255,255,0.08)
val Divider = Color(0x08FFFFFF)          // rgba(255,255,255,0.03)

// ---------- 渐变 ----------
val GradientPrimary = listOf(Primary, Agent)  // 主按钮渐变
val GradientBreath = listOf(PrimaryGlow, Color(0x082B7FFF))  // 呼吸球渐变

// ---------- 兼容旧代码（避免大量编译错误，后续逐步移除） ----------
@Deprecated("v6 已弃用，使用 Primary", ReplaceWith("Primary"))
val Amber500 = Primary
@Deprecated("v6 已弃用，使用 Agent", ReplaceWith("Agent"))
val Orange500 = Agent
@Deprecated("v6 已弃用，使用 Agent", ReplaceWith("Agent"))
val Green500 = Agent
@Deprecated("v6 已弃用，使用 Danger", ReplaceWith("Danger"))
val Red500 = Danger
@Deprecated("v6 已弃用，使用 Primary", ReplaceWith("Primary"))
val Blue500 = Primary
@Deprecated("v6 已弃用，使用 Think", ReplaceWith("Think"))
val Purple500 = Think

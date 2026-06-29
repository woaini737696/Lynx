package com.lynnhub.app.ui.theme

import androidx.compose.ui.graphics.Color

// ============ Lynx Android UI 重构设计规范 v3 ============
// 风格：iOS 26 液态玻璃 + 深邃星空蓝 + 极简人性
// 来源：docs/specs/2026-06-28-lynx-android-ui-redesign-spec.md
// 视觉稿：docs/design-assets/lynx-android-ui-preview-v3.html

// ---------- 基础背景 ----------
val Void = Color(0xFF02040C)        // 页面背景 #02040c
val Deep = Color(0xFF070B18)        // 次级背景 / 浮层底层 #070b18

// ---------- 品牌色 ----------
val Primary = Color(0xFF4B9FFF)          // 品牌蓝 #4B9FFF
val PrimaryDeep = Color(0xFF2563EB)      // 品牌深蓝 #2563EB
val PrimaryGlow = Color(0x404B9FFF)      // rgba(75,159,255,0.25) 光晕

// ---------- Agent 色 ----------
val Agent = Color(0xFF30D6B5)            // Agent 青 #30D6B5
val AgentGlow = Color(0x4030D6B5)        // rgba(48,214,181,0.25)

// ---------- Think 色 ----------
val Think = Color(0xFFFFC857)            // Think 琥珀 #FFC857
val ThinkGlow = Color(0x33FFC857)        // rgba(255,200,87,0.2)

// ---------- 危险色 ----------
val Danger = Color(0xFFFF5A5A)           // 危险红 #FF5A5A

// ---------- 兼容性颜色（旧组件 CaptureBar / ErrorState 仍引用） ----------
val Amber500 = Color(0xFFFFB020)         // 琥珀黄（对应 Think）
val Orange500 = Color(0xFFFF8C42)        // 橙黄
val Green500 = Color(0xFF30D6B5)         // 青绿（对应 Agent）
val Red500 = Color(0xFFFF5A5A)           // 红（对应 Danger）

// ---------- 文字色 ----------
val TextPrimary = Color(0xFFF6F8FF)      // 主文本 #F6F8FF
val TextMuted = Color(0xFF8A93A8)        // 辅助文本 #8A93A8

// ---------- Surface（液态玻璃，半透明白） ----------
val Surface = Color(0x08FFFFFF)          // liquid-3: rgba(255,255,255,0.04)
val SurfaceHover = Color(0x12FFFFFF)     // rgba(255,255,255,0.07)
val SurfaceActive = Color(0x16FFFFFF)    // rgba(255,255,255,0.085)

// ---------- 玻璃材质 ----------
val Liquid1 = Color(0x24FFFFFF)          // rgba(255,255,255,0.14) 强玻璃
val Liquid2 = Color(0x14FFFFFF)          // rgba(255,255,255,0.08) 玻璃卡片
val Liquid3 = Color(0x0AFFFFFF)          // rgba(255,255,255,0.04) 玻璃底层
val LiquidBorder = Color(0x38FFFFFF)     // rgba(255,255,255,0.22) 玻璃边框
val LiquidHighlight = Color(0x59FFFFFF)  // rgba(255,255,255,0.35) 玻璃高光

// ---------- 边框/分割线 ----------
val BorderSubtle = Color(0x0FFFFFFF)     // rgba(255,255,255,0.06)
val BorderHover = Color(0x1AFFFFFF)      // rgba(255,255,255,0.10)
val Divider = Color(0x08FFFFFF)          // rgba(255,255,255,0.03)

// ---------- 渐变 ----------
val GradientPrimary = listOf(Primary, PrimaryDeep)           // 主按钮渐变
val GradientBreath = listOf(Primary.copy(alpha = 0.40f), Agent.copy(alpha = 0.15f)) // 呼吸球渐变

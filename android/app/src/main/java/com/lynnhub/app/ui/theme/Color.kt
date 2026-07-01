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

// ============ iOS26 液态玻璃 v4 专用色板（App Store 风格 1:1 还原）============
// 设计原则：深色主题下，玻璃容器必须以"深色叠加"为基础，避免任何 .copy(alpha) 覆盖白色染色

// 玻璃容器深色基底（替代旧 Liquid2/3 的白色染色方案）
// 直接采用 Void/Deep 降透明度，确保深色主题下永远是深色叠加
val GlassDeepBase = Color(0xD902040C)        // 85% Void，强玻璃容器底色
val GlassDeepSoft = Color(0xB302040C)        // 70% Void，普通玻璃容器底色
val GlassDeepSubtle = Color(0x80070B18)      // 50% Deep，轻量玻璃容器底色

// 弹窗专用深色叠加（避免使用 Surface.copy(alpha)）
val DialogDeepPrimary = Color(0xE602040C)    // 90% Void，弹窗主背景
val DialogDeepSecondary = Color(0xB3070B18)  // 70% Deep，弹窗渐变次色
val DialogScrim = Color(0x99000000)          // 60% Black，弹窗外遮罩

// 顶部 TopBar 专用（半透明深色 + 模糊背景）
val TopBarDeep = Color(0xCC02040C)           // 80% Void，TopBar背景
val TopBarDeepBlur = Color(0x99070B18)       // 60% Deep，TopBar模糊层

// 高光描边（保留 LiquidHighlight 但提供深色版）
val GlassHighlightDeep = Color(0x59FFFFFF)   // 35% 白色高光（用于深色玻璃顶部光）
val GlassBorderDeep = Color(0x33FFFFFF)      // 20% 白色描边（深色玻璃）
val GlassBorderSubtle = Color(0x1FFFFFFF)    // 12% 白色描边（轻量深色玻璃）

// 液态玻璃动态阴影
val GlassShadowDeep = Color(0x66000000)      // 40% Black 阴影
val GlassGlowPrimary = Color(0x264B9FFF)     // 15% Primary 光晕

// 设置面板专用（解决跳动+深色风格）
val SettingsPanelBg = Color(0xF202040C)      // 95% Void，设置面板主背景
val SettingsScrim = Color(0x80000000)        // 50% Black，设置面板遮罩

// 聊天气泡专用（液态玻璃深色版）
val BubbleUserDeep = Color(0xCC070B18)       // 80% Deep，用户气泡
val BubbleAssistantDeep = Color(0xCC0A1228)  // 80% 蓝黑，AI气泡
val BubbleUserBorder = Color(0x334B9FFF)     // 20% Primary 描边
val BubbleAssistantBorder = Color(0x3330D6B5) // 20% Agent 描边

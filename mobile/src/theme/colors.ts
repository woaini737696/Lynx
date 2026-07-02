// ============ 深邃星空蓝深色主题色板 ============
// 与 Kotlin 端 android/app/src/main/java/com/lynnhub/app/ui/theme/Color.kt 对齐
// 强制深色主题，所有页面统一引用此处常量，避免散落的硬编码颜色

/**
 * 背景色系
 */
export const Void = '#02040C'; // 页面主背景（最深）
export const Deep = '#070B18'; // 次级背景（卡片底、输入框底等）

/**
 * 品牌色系
 */
export const Primary = '#4B9FFF'; // 主品牌色
export const PrimaryDeep = '#2563EB'; // 深品牌色（渐变端点）
export const PrimaryGlow = 'rgba(75, 159, 255, 0.25)'; // 品牌辉光

/**
 * 功能色系
 */
export const Agent = '#30D6B5'; // Agent 青
export const Think = '#FFC857'; // 思考琥珀
export const Danger = '#FF5A5A'; // 危险红

/**
 * 文字色系
 */
export const TextPrimary = '#F6F8FF'; // 主文字
export const TextMuted = '#8A93A8'; // 辅助文字

/**
 * 液态玻璃材质（浅色玻璃叠层，用于深色背景上的卡片）
 */
export const Liquid1 = 'rgba(255, 255, 255, 0.14)'; // 一级玻璃（强）
export const Liquid2 = 'rgba(255, 255, 255, 0.08)'; // 二级玻璃（中，常用卡片底）
export const Liquid3 = 'rgba(255, 255, 255, 0.04)'; // 三级玻璃（弱）

/**
 * 玻璃边框 / 高光
 */
export const LiquidBorder = 'rgba(255, 255, 255, 0.22)'; // 玻璃描边
export const LiquidHighlight = 'rgba(255, 255, 255, 0.35)'; // 玻璃高光

/**
 * 深色玻璃专用（基于 Void 混色，用于弹窗 / 深色面板）
 */
export const GlassDeepBase = 'rgba(2, 4, 12, 0.85)'; // 85% Void
export const GlassDeepSoft = 'rgba(2, 4, 12, 0.70)'; // 70% Void
export const DialogDeepPrimary = 'rgba(2, 4, 12, 0.90)'; // 90% Void（对话框主底）

/**
 * 聊天气泡（深色主题专用）
 */
export const BubbleUserDeep = 'rgba(7, 11, 24, 0.80)'; // 80% Deep（用户气泡）
export const BubbleAssistantDeep = 'rgba(37, 99, 235, 0.80)'; // 80% 蓝黑（助理气泡）

/**
 * Tab Bar 深色液态玻璃底（Android 半透明深色模拟）
 */
export const TabBarDarkAndroid = 'rgba(2, 4, 12, 0.85)';

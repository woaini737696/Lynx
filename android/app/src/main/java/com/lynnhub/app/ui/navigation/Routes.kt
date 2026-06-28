package com.lynnhub.app.ui.navigation

/**
 * Lynx v6 路由定义
 * 单主页 + 浮层 + 设置面板 + 子页面
 */
object Routes {
    // 主页面
    const val HOME = "home"

    // 浮层（从首页手势触发）
    const val IDEA_PANEL = "idea"       // 上滑：灵感速记
    const val TASK_PANEL = "task"       // 下滑：任务视图
    const val CHAT_PANEL = "chat"       // 左滑：AI 对话
    const val AGENT_PANEL = "agent"     // 右滑：Agent 远程

    // 全屏覆盖
    const val CALL = "call"             // 双击呼吸球：全双工通话

    // 设置面板（点击头像右侧滑入）
    const val SETTINGS = "settings"

    // 设置子页面（从右侧滑入）
    const val PROFILE = "profile"           // 个人资料
    const val AI_KEY = "ai_key"             // AI Key 配置
    const val DEVICES = "devices"           // 设备管理
    const val MEMORY = "memory"             // 记忆图谱
    const val COGNITION = "cognition"       // 认知库
    const val NOTIFICATION = "notification" // 通知偏好
    const val UPDATE = "update"             // 检查更新
    const val ABOUT = "about"               // 关于我们
}

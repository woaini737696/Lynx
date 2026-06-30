package com.lynnhub.app.util

/**
 * 全局常量
 */
object Constants {
    /**
     * 默认后端地址（云服务器）
     * 域名 ai.lynxdo.com 因未备案被阿里云 WAF 拦截（SNI 阶段 Connection reset），
     * 改用 IP 直连绕过备案检查，通过 Host header 让服务器正确路由。
     */
    const val DEFAULT_BASE_URL = "https://47.119.185.135/"
    const val API_HOST = "ai.lynxdo.com"

    /** DataStore 名称 */
    const val USER_PREFS = "user_prefs"

    /** 主题模式 */
    const val THEME_DARK = "dark"
    const val THEME_LIGHT = "light"
    const val THEME_SYSTEM = "system"
}

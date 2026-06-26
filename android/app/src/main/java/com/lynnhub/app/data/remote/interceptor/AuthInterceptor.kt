package com.lynnhub.app.data.remote.interceptor

import com.lynnhub.app.data.local.UserPreferences
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

/**
 * 认证拦截器：自动注入 Bearer Token，401 时不处理（由上层统一跳登录）
 */
class AuthInterceptor @Inject constructor(
    private val userPreferences: UserPreferences
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { userPreferences.getToken() }
        val request = chain.request().newBuilder()
            .apply {
                if (token != null) {
                    addHeader("Authorization", "Bearer $token")
                }
            }
            .build()
        return chain.proceed(request)
    }
}

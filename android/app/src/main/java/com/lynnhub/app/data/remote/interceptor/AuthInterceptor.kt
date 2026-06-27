package com.lynnhub.app.data.remote.interceptor

import com.lynnhub.app.data.local.UserPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import okhttp3.Interceptor
import okhttp3.Response
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 认证拦截器：自动注入 Bearer Token，401 时不处理（由上层统一跳登录）
 * 使用内存缓存 + AtomicReference 避免 runBlocking 阻塞 OkHttp 线程池
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val userPreferences: UserPreferences
) : Interceptor {

    private val tokenRef = AtomicReference<String?>(null)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    init {
        scope.launch {
            userPreferences.tokenFlow.collectLatest { token ->
                tokenRef.set(token)
            }
        }
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenRef.get()
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

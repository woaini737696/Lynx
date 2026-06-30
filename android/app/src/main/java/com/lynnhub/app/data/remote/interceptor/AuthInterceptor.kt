package com.lynnhub.app.data.remote.interceptor

import com.lynnhub.app.data.local.UserPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import okhttp3.Interceptor
import okhttp3.Response
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 认证拦截器：自动注入 Bearer Token，401 时发出登出事件
 * 使用内存缓存 + AtomicReference 避免 runBlocking 阻塞 OkHttp 线程池
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val userPreferences: UserPreferences
) : Interceptor {

    private val tokenRef = AtomicReference<String?>(null)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** 401 事件总线：MainActivity 收到后跳转登录页 */
    private val _unauthorizedEvents = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val unauthorizedEvents: SharedFlow<Unit> = _unauthorizedEvents.asSharedFlow()

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
        val response = chain.proceed(request)
        // 401 时清除 token 并广播登出事件（仅在 API 请求上触发，避免登录接口自身 401）
        if (response.code == 401 && request.url.encodedPath.contains("/api/")) {
            // 跳过登录接口自身的 401
            val path = request.url.encodedPath
            if (!path.contains("/api/auth/login") && !path.contains("/api/auth/register")) {
                scope.launch {
                    userPreferences.clearAuth()
                    _unauthorizedEvents.tryEmit(Unit)
                }
            }
        }
        return response
    }
}


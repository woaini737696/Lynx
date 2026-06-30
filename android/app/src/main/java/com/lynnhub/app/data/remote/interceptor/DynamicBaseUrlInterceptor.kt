package com.lynnhub.app.data.remote.interceptor

import com.lynnhub.app.util.Constants
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import java.util.concurrent.atomic.AtomicReference

/**
 * 动态 BaseUrl 拦截器
 *
 * 解决 Retrofit Singleton 无法运行时切换 baseUrl 的问题。
 * 当使用 IP 直连时（绕过阿里云 WAF 备案拦截），自动添加 Host header。
 */
class DynamicBaseUrlInterceptor : Interceptor {

    private val currentBaseUrl = AtomicReference(Constants.DEFAULT_BASE_URL)

    fun setBaseUrl(url: String) {
        val normalized = normalizeUrl(url)
        currentBaseUrl.set(normalized)
    }

    fun getBaseUrl(): String = currentBaseUrl.get()

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val baseUrlStr = currentBaseUrl.get()
        val baseUrl = baseUrlStr.toHttpUrlOrNull() ?: return chain.proceed(originalRequest)

        val originalUrl = originalRequest.url
        val newUrl = originalUrl.newBuilder()
            .scheme(baseUrl.scheme)
            .host(baseUrl.host)
            .port(baseUrl.port)
            .build()

        val builder = originalRequest.newBuilder().url(newUrl)

        // IP 直连时添加 Host header（让 Nginx 正确路由到 ai.lynxdo.com）
        if (baseUrl.host != Constants.API_HOST) {
            builder.header("Host", Constants.API_HOST)
        }

        return chain.proceed(builder.build())
    }

    private fun normalizeUrl(url: String): String {
        var normalized = url.trim()
        if (normalized.isEmpty()) return Constants.DEFAULT_BASE_URL
        if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
            normalized = "https://$normalized"
        }
        if (!normalized.endsWith("/")) normalized = "$normalized/"
        return normalized
    }
}

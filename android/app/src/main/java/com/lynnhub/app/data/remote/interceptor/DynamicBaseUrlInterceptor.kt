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
 * 在 Application 启动时从 DataStore 异步加载真实 baseUrl 并调用 [setBaseUrl]，
 * 后续每次请求都会替换 host 为当前持有的 baseUrl。
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

        val newRequest = originalRequest.newBuilder()
            .url(newUrl)
            .build()

        return chain.proceed(newRequest)
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

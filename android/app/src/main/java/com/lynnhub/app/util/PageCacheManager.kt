package com.lynnhub.app.util

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * 页面级缓存管理器（进程级单例）
 *
 * 解决问题：切换页面回来后数据丢失，需要重新加载
 *
 * 策略：
 * 1. 每个 ViewModel 在 load() 成功后把数据存入这里
 * 2. ViewModel init 时先从缓存读取并立即更新 UI（无感加载）
 * 3. 然后后台请求最新数据，到了再覆盖（增量更新）
 *
 * 缓存过期策略：
 * - TTL 5分钟，超过后视为过期，需要重新加载
 * - 手动调用 invalidate(key) 可立即失效
 */
object PageCacheManager {

    private const val DEFAULT_TTL_MS = 5 * 60 * 1000L  // 5 分钟

    private val cache = mutableMapOf<String, CacheEntry<*>>()
    private val mutex = Mutex()

    /**
     * 存入缓存
     */
    suspend fun <T> put(key: String, data: T) {
        mutex.withLock {
            cache[key] = CacheEntry(data, System.currentTimeMillis())
        }
    }

    /**
     * 读取缓存
     * @return Pair<数据, 是否过期>；若不存在返回 null
     */
    suspend fun <T> get(key: String, ttlMs: Long = DEFAULT_TTL_MS): Pair<T, Boolean>? {
        mutex.withLock {
            val entry = cache[key] ?: return null
            @Suppress("UNCHECKED_CAST")
            val data = entry.data as T
            val isExpired = System.currentTimeMillis() -entry.timestamp > ttlMs
            return data to isExpired
        }
    }

    /**
     * 读取缓存（不检查过期）
     */
    suspend fun <T> getFresh(key: String): T? {
        mutex.withLock {
            val entry = cache[key] ?: return null
            @Suppress("UNCHECKED_CAST")
            return entry.data as T
        }
    }

    /**
     * 失效指定缓存
     */
    suspend fun invalidate(key: String) {
        mutex.withLock {
            cache.remove(key)
        }
    }

    /**
     * 清空所有缓存
     */
    suspend fun clear() {
        mutex.withLock {
            cache.clear()
        }
    }

    private data class CacheEntry<T>(val data: T, val timestamp: Long)
}

/** 缓存键约定 */
object CacheKeys {
    const val HOME = "home_ui_state"
    const val TASKS = "tasks_ui_state"
    const val MEMORY = "memory_ui_state"
    const val ASSISTANT_MESSAGES = "assistant_messages"
    const val ASSISTANT_SESSION = "assistant_session"
}

package com.lynnhub.app.data.local

import android.content.Context
import android.util.Base64
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.lynnhub.app.util.Constants
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = Constants.USER_PREFS)

/**
 * 用户偏好存储：Token、用户信息、主题、后端地址
 *
 * 安全说明：Token 通过 XOR + Base64 进行简单混淆存储（非明文），
 * 避免直接使用 EncryptedSharedPreferences 带来的额外依赖。
 * 注意：这只能防止 casual 读取，无法抵御定向攻击；如需更强安全，
 * 后续应集成 Jetpack Security（Tink）。
 * Token 加密向后兼容：读取时若不是加密前缀，则视为历史明文 token 原样返回。
 */
class UserPreferences(private val context: Context) {

    companion object {
        private val KEY_TOKEN = stringPreferencesKey("token")
        private val KEY_USER_ID = stringPreferencesKey("user_id")
        private val KEY_USERNAME = stringPreferencesKey("username")
        private val KEY_DISPLAY_NAME = stringPreferencesKey("display_name")
        private val KEY_ROLE = stringPreferencesKey("role")
        private val KEY_THEME = stringPreferencesKey("theme")
        private val KEY_BASE_URL = stringPreferencesKey("base_url")
        private val KEY_AI_PROVIDER = stringPreferencesKey("ai_provider")
        private val KEY_AI_MODEL = stringPreferencesKey("ai_model")
        private val KEY_CACHE_LARK_TASKS = stringPreferencesKey("cache_lark_tasks")

        /** Token 混淆用的 XOR 密钥 */
        private val TOKEN_XOR_KEY = "LynnHub!".toByteArray(Charsets.UTF_8)

        /** 加密 token 存储前缀，用于识别新格式 & 向后兼容旧明文 */
        private const val TOKEN_ENC_PREFIX = "enc:"

        /**
         * XOR + Base64 加密：把明文 token 混淆为 "enc:<base64>" 字符串。
         */
        private fun encryptToken(plain: String): String {
            val bytes = plain.toByteArray(Charsets.UTF_8)
            val key = TOKEN_XOR_KEY
            val out = ByteArray(bytes.size)
            for (i in bytes.indices) {
                out[i] = (bytes[i].toInt() xor key[i % key.size].toInt()).toByte()
            }
            return TOKEN_ENC_PREFIX + Base64.encodeToString(out, Base64.NO_WRAP)
        }

        /**
         * 解密 token。向后兼容：若不是加密前缀，则视为历史明文 token 原样返回。
         */
        private fun decryptToken(stored: String?): String? {
            if (stored.isNullOrEmpty()) return null
            if (!stored.startsWith(TOKEN_ENC_PREFIX)) return stored
            return try {
                val b64 = stored.substring(TOKEN_ENC_PREFIX.length)
                val decoded = Base64.decode(b64, Base64.NO_WRAP)
                val key = TOKEN_XOR_KEY
                val out = ByteArray(decoded.size)
                for (i in decoded.indices) {
                    out[i] = (decoded[i].toInt() xor key[i % key.size].toInt()).toByte()
                }
                String(out, Charsets.UTF_8)
            } catch (e: Exception) {
                // 解密失败（数据损坏），返回 null 避免返回错误数据
                null
            }
        }
    }

    /**
     * 飞书任务缓存内存层：避免每次 getTasksCache() 都 .first() 读 DataStore。
     * holder 同时记录是否已从 DataStore 加载，避免“无缓存”和“未加载”混淆。
     */
    private data class TasksCacheHolder(val value: String? = null, val loaded: Boolean = false)

    private val tasksCacheHolder = MutableStateFlow(TasksCacheHolder())

    /** 缓存飞书任务 JSON，用于离线浏览 */
    suspend fun saveTasksCache(json: String) {
        context.dataStore.edit { it[KEY_CACHE_LARK_TASKS] = json }
        tasksCacheHolder.value = TasksCacheHolder(value = json, loaded = true)
    }

    suspend fun getTasksCache(): String? {
        val holder = tasksCacheHolder.value
        if (holder.loaded) return holder.value
        val value = context.dataStore.data.map { it[KEY_CACHE_LARK_TASKS] }.first()
        tasksCacheHolder.value = TasksCacheHolder(value = value, loaded = true)
        return value
    }

    val tokenFlow: Flow<String?> = context.dataStore.data.map { decryptToken(it[KEY_TOKEN]) }
    val userFlow: Flow<UserInfo?> = context.dataStore.data.map {
        val id = it[KEY_USER_ID] ?: return@map null
        UserInfo(
            id = id,
            username = it[KEY_USERNAME] ?: "",
            displayName = it[KEY_DISPLAY_NAME] ?: "",
            role = it[KEY_ROLE] ?: "user"
        )
    }
    val themeFlow: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_THEME] ?: Constants.THEME_DARK
    }
    val baseUrlFlow: Flow<String> = context.dataStore.data.map {
        it[KEY_BASE_URL] ?: Constants.DEFAULT_BASE_URL
    }
    val aiProviderFlow: Flow<String> = context.dataStore.data.map {
        it[KEY_AI_PROVIDER] ?: "deepseek"
    }
    val aiModelFlow: Flow<String> = context.dataStore.data.map {
        it[KEY_AI_MODEL] ?: "deepseek-chat"
    }

    suspend fun getToken(): String? = tokenFlow.first()
    suspend fun getBaseUrl(): String = baseUrlFlow.first()

    suspend fun saveAuth(token: String, user: UserInfo) {
        context.dataStore.edit {
            it[KEY_TOKEN] = encryptToken(token)
            it[KEY_USER_ID] = user.id
            it[KEY_USERNAME] = user.username
            it[KEY_DISPLAY_NAME] = user.displayName
            it[KEY_ROLE] = user.role
        }
    }

    suspend fun clearAuth() {
        context.dataStore.edit {
            it.remove(KEY_TOKEN)
            it.remove(KEY_USER_ID)
            it.remove(KEY_USERNAME)
            it.remove(KEY_DISPLAY_NAME)
            it.remove(KEY_ROLE)
        }
    }

    suspend fun setTheme(theme: String) {
        context.dataStore.edit { it[KEY_THEME] = theme }
    }

    suspend fun setBaseUrl(url: String) {
        context.dataStore.edit { it[KEY_BASE_URL] = url }
    }

    suspend fun setAiProvider(provider: String, model: String) {
        context.dataStore.edit {
            it[KEY_AI_PROVIDER] = provider
            it[KEY_AI_MODEL] = model
        }
    }
}

data class UserInfo(
    val id: String,
    val username: String,
    val displayName: String,
    val role: String
)

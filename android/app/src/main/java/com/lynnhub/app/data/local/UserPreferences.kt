package com.lynnhub.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.lynnhub.app.util.Constants
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = Constants.USER_PREFS)

/**
 * 用户偏好存储：Token、用户信息、主题、后端地址
 *
 * TODO: 安全改进 - Token 当前以明文形式存储在 DataStore Preferences 中
 * 后续应集成 EncryptedSharedPreferences 或 Jetpack Security 进行加密存储
 * 参考: https://developer.android.com/topic/security/data
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
    }

    /** 缓存飞书任务 JSON，用于离线浏览 */
    suspend fun saveTasksCache(json: String) {
        context.dataStore.edit { it[KEY_CACHE_LARK_TASKS] = json }
    }

    suspend fun getTasksCache(): String? =
        context.dataStore.data.map { it[KEY_CACHE_LARK_TASKS] }.first()

    val tokenFlow: Flow<String?> = context.dataStore.data.map { it[KEY_TOKEN] }
    val userFlow: Flow<UserInfo?> = context.dataStore.data.map {
        val id = it[KEY_USER_ID] ?: return@map null
        UserInfo(
            id = id,
            username = it[KEY_USERNAME] ?: "",
            displayName = it[KEY_DISPLAY_NAME] ?: "",
            role = it[KEY_ROLE] ?: "user"
        )
    }
    val themeFlow: Flow<String> = context.dataStore.data.map {
        it[KEY_THEME] ?: Constants.THEME_SYSTEM
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
            it[KEY_TOKEN] = token
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

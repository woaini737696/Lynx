package com.lynnhub.app.data.remote

import com.lynnhub.app.data.local.UserPreferences
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SSE 流式对话客户端
 * 使用 OkHttp EventSource 替代 H5 的 fetch + ReadableStream
 */
@Singleton
class StreamChatClient @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val userPreferences: UserPreferences,
    private val json: Json
) {

    /**
     * 流式发送消息
     * 返回 Flow<SseEvent>，逐个产出服务端事件
     */
    fun streamChat(
        messages: List<com.lynnhub.app.data.remote.dto.ChatMessageRequest>,
        sessionId: String? = null,
        provider: String = "deepseek",
        model: String? = null,
        assistantMode: Boolean = false
    ): Flow<SseEvent> = flow {
        val baseUrl = userPreferences.getBaseUrl()
        val token = userPreferences.getToken()

        val requestBody = json.encodeToString(
            kotlinx.serialization.serializer<StreamChatRequest>(),
            StreamChatRequest(
                messages = messages,
                provider = provider,
                model = model,
                assistantMode = assistantMode,
                stream = true
            )
        )

        val request = Request.Builder()
            .url("${baseUrl}api/ai/chat")
            .post(requestBody.toRequestBody("application/json".toMediaType()))
            .apply {
                if (token != null) {
                    addHeader("Authorization", "Bearer $token")
                }
                addHeader("Accept", "text/event-stream")
            }
            .build()

        // 使用 OkHttp 原始响应读取 SSE 流
        val response = okHttpClient.newCall(request).execute()
        if (!response.isSuccessful) {
            emit(SseEvent.Error("HTTP ${response.code}: ${response.message}"))
            response.close()
            return@flow
        }

        val source = EventSources.createFactory(okHttpClient)
            .newEventSource(request, object : EventSourceListener() {
                // 在 flow 中处理，这里不做实际监听
            })

        // 手动读取 SSE 流
        response.body?.byteStream()?.bufferedReader()?.use { reader ->
            var currentData = StringBuilder()
            var currentEvent = "message"

            while (true) {
                val line = reader.readLine() ?: break

                when {
                    line.startsWith("event:") -> {
                        currentEvent = line.removePrefix("event:").trim()
                    }
                    line.startsWith("data:") -> {
                        val data = line.removePrefix("data:").trim()
                        if (data.isNotEmpty()) {
                            currentData.append(data)
                        }
                    }
                    line.isEmpty() -> {
                        // 空行表示事件结束
                        if (currentData.isNotEmpty()) {
                            val dataStr = currentData.toString()
                            when (currentEvent) {
                                "message" -> emit(SseEvent.Message(dataStr))
                                "tool_call" -> emit(parseToolCall(dataStr))
                                "done" -> emit(SseEvent.Done)
                                "error" -> emit(SseEvent.Error(dataStr))
                            }
                            currentData = StringBuilder()
                        }
                        currentEvent = "message"
                    }
                }
            }
        }

        response.close()
        emit(SseEvent.Done)
    }

    private fun parseToolCall(data: String): SseEvent.ToolCall {
        return try {
            val obj = json.parseToJsonElement(data).jsonObject
            SseEvent.ToolCall(
                name = obj["name"]?.jsonPrimitive?.contentOrNull ?: "",
                arguments = obj["arguments"]?.jsonPrimitive?.contentOrNull,
                result = obj["result"]?.jsonPrimitive?.contentOrNull
            )
        } catch (_: Exception) {
            SseEvent.ToolCall(name = data)
        }
    }
}

/** SSE 事件 */
sealed class SseEvent {
    data class Message(val content: String) : SseEvent()
    data class ToolCall(val name: String, val arguments: String? = null, val result: String? = null) : SseEvent()
    object Done : SseEvent()
    data class Error(val message: String) : SseEvent()
}

@kotlinx.serialization.Serializable
data class StreamChatRequest(
    val messages: List<com.lynnhub.app.data.remote.dto.ChatMessageRequest>,
    val provider: String = "deepseek",
    val model: String? = null,
    val assistantMode: Boolean = false,
    val stream: Boolean = true
)

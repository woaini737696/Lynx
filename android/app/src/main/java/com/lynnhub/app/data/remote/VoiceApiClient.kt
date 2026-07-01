package com.lynnhub.app.data.remote

import android.util.Log
import com.lynnhub.app.data.local.UserPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import okio.ByteString.Companion.toByteString
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 语音 API 客户端
 *
 * 三种工作模式：
 *  1. recognizeSpeech：单次 multipart ASR（保留作为 fallback，含详细错误日志）
 *  2. streamTTS：SSE 流式 TTS（已有）
 *  3. StreamingVoiceSession：WebSocket 全双工流式 ASR（新增，失败自动 fallback）
 *
 * ASR:400 错误诊断：保留旧接口完整 response body 输出，方便定位 MiMo 服务端根因。
 */
@Singleton
class VoiceApiClient @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val userPreferences: UserPreferences,
    private val json: Json
) {

    companion object {
        private const val TAG = "VoiceApiClient"
        /** HTTP fallback 分段长度（毫秒），平衡延迟与识别准确率 */
        const val FALLBACK_CHUNK_MS = 2500L
    }

    /**
     * ASR 语音识别（单次 multipart，保留作为 fallback）
     *
     * 关键修复：打印完整 response body 帮助定位 400 根因（MiMo 服务端错误）
     */
    suspend fun recognizeSpeech(wavData: ByteArray): String = withContext(Dispatchers.IO) {
        val baseUrl = userPreferences.getBaseUrl()
        val token = userPreferences.getToken()

        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("file", "audio.wav",
                wavData.toRequestBody("audio/wav".toMediaType()))
            .build()

        val request = Request.Builder()
            .url("${baseUrl}api/ai/asr")
            .post(requestBody)
            .apply {
                if (token != null) addHeader("Authorization", "Bearer $token")
            }
            .build()

        val response = okHttpClient.newCall(request).execute()
        val body = response.body?.string() ?: ""
        if (!response.isSuccessful) {
            // 关键修复：打印完整 response body 帮助定位 400 根因
            Log.e(TAG, "ASR ${response.code} | body=${body.take(800)} | wavSize=${wavData.size}")
            throw Exception("ASR ${response.code}: ${body.take(200)}")
        }

        return@withContext try {
            val obj = json.parseToJsonElement(body).jsonObject
            obj["text"]?.jsonPrimitive?.contentOrNull ?: ""
        } catch (e: Exception) {
            Log.w(TAG, "ASR 响应解析失败，返回原文: ${e.message}")
            body
        }
    }

    /**
     * 流式 TTS：返回 Flow<TtsEvent>，每个 chunk 是音频片段
     * 使用 SSE 接收音频数据
     */
    fun streamTTS(text: String, voice: String = "default"): Flow<TtsEvent> = flow {
        val baseUrl = userPreferences.getBaseUrl()
        val token = userPreferences.getToken()

        val requestBody = json.encodeToString(
            kotlinx.serialization.serializer<TtsRequest>(),
            TtsRequest(text = text, voice = voice, stream = true)
        )

        val request = Request.Builder()
            .url("${baseUrl}api/ai/tts/stream")
            .post(requestBody.toRequestBody("application/json".toMediaType()))
            .apply {
                if (token != null) addHeader("Authorization", "Bearer $token")
                addHeader("Accept", "text/event-stream")
            }
            .build()

        val response = okHttpClient.newCall(request).execute()
        if (!response.isSuccessful) {
            val errBody = response.body?.string()?.take(500) ?: ""
            Log.e(TAG, "TTS stream ${response.code} body=$errBody")
            emit(TtsEvent.Error("TTS ${response.code}: $errBody"))
            response.close()
            return@flow
        }

        response.body?.byteStream()?.bufferedReader()?.use { reader ->
            var currentData = StringBuilder()
            while (true) {
                val line = reader.readLine() ?: break
                if (line.startsWith("data:")) {
                    currentData.append(line.removePrefix("data:").trim())
                } else if (line.isEmpty() && currentData.isNotEmpty()) {
                    val data = currentData.toString()
                    if (data == "[DONE]") {
                        emit(TtsEvent.Done)
                    } else {
                        try {
                            val audioBytes = android.util.Base64.decode(data, android.util.Base64.NO_WRAP)
                            emit(TtsEvent.AudioChunk(audioBytes))
                        } catch (e: Exception) {
                            Log.w(TAG, "TTS chunk 解码失败: ${e.message}")
                        }
                    }
                    currentData = StringBuilder()
                }
            }
        }
        response.close()
    }.flowOn(Dispatchers.IO)

    /**
     * 建立 WebSocket 全双工流式 ASR 会话
     *
     * 协议：
     *  - 上行：二进制 PCM 帧（16k/16bit/mono），每帧 ~200ms
     *  - 上行控制：JSON {"action":"end"} 结束本轮识别
     *  - 下行：JSON {"text":"...", "final":true/false}
     *
     * 失败时返回 null，调用方应 fallback 到 [recognizeSpeech]。
     */
    suspend fun connectStreamingASR(): StreamingVoiceSession? = withContext(Dispatchers.IO) {
        val baseUrl = userPreferences.getBaseUrl()
        val token = userPreferences.getToken()

        // http(s):// -> ws(s)://
        val wsUrl = baseUrl.replaceFirst("http://", "ws://")
            .replaceFirst("https://", "wss://") + "api/ai/voice/ws"

        val events = MutableEventFlow<AsrEvent>()
        var opened = false

        val request = Request.Builder()
            .url(wsUrl)
            .apply {
                if (token != null) addHeader("Authorization", "Bearer $token")
            }
            .build()

        val ws = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                opened = true
                events.tryEmit(AsrEvent.Ready)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val obj = json.parseToJsonElement(text).jsonObject
                    val isFinal = obj["final"]?.jsonPrimitive?.contentOrNull == "true"
                    val content = obj["text"]?.jsonPrimitive?.contentOrNull ?: ""
                    if (isFinal) {
                        events.tryEmit(AsrEvent.Final(content))
                    } else {
                        events.tryEmit(AsrEvent.Interim(content))
                    }
                } catch (e: Exception) {
                    events.tryEmit(AsrEvent.Error("解析 ASR 响应失败: ${e.message}"))
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                val body = try { response?.body?.string()?.take(500) } catch (_: Exception) { null }
                Log.w(TAG, "WebSocket 连接失败: ${t.message} | fallback to HTTP | body=$body")
                events.tryEmit(AsrEvent.FallbackNeeded(t.message ?: "ws failed"))
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                events.close()
            }
        })

        // 等待连接结果（最多 1.5s）
        var waited = 0L
        while (!opened && waited < 1500L) {
            delay(50L)
            waited += 50L
        }
        // 检查是否已收到 FallbackNeeded
        if (events.isClosed()) {
            try { ws.cancel() } catch (_: Exception) {}
            return@withContext null
        }
        if (!opened) {
            try { ws.cancel() } catch (_: Exception) {}
            return@withContext null
        }

        StreamingVoiceSession(ws, events.flow)
    }
}

/**
 * 流式 ASR 会话（WebSocket）
 *
 * 使用：
 *  val session = client.connectStreamingASR() ?: return // fallback
 *  session.sendAudio(pcmChunk)
 *  session.sendEnd()
 *  session.events.collect { event -> ... }
 */
class StreamingVoiceSession(
    private val webSocket: WebSocket,
    val events: Flow<AsrEvent>
) {
    /** 发送一帧 PCM 音频（16k/16bit/mono） */
    fun sendAudio(pcm: ByteArray): Boolean {
        return try {
            webSocket.send(pcm.toByteString(0, pcm.size))
        } catch (e: Exception) {
            false
        }
    }

    /** 结束本轮识别，等服务端返回 Final */
    fun sendEnd(): Boolean {
        return try {
            webSocket.send("""{"action":"end"}""")
        } catch (e: Exception) {
            false
        }
    }

    /** 关闭会话 */
    fun close() {
        try { webSocket.close(1000, "session end") } catch (_: Exception) {}
        try { webSocket.cancel() } catch (_: Exception) {}
    }
}

sealed class AsrEvent {
    /** WebSocket 已就绪，可以开始发送音频 */
    object Ready : AsrEvent()
    /** 中间识别结果（边说边输出） */
    data class Interim(val text: String) : AsrEvent()
    /** 最终识别结果（一句话说完） */
    data class Final(val text: String) : AsrEvent()
    /** 错误 */
    data class Error(val message: String) : AsrEvent()
    /** WebSocket 不可用，需要 fallback 到 HTTP */
    data class FallbackNeeded(val reason: String) : AsrEvent()
}

sealed class TtsEvent {
    data class AudioChunk(val data: ByteArray) : TtsEvent()
    object Done : TtsEvent()
    data class Error(val message: String) : TtsEvent()
}

@kotlinx.serialization.Serializable
data class TtsRequest(
    val text: String,
    val voice: String = "default",
    val stream: Boolean = true
)

/**
 * 内部可变事件流（避免依赖 MutableSharedFlow 的 public API）
 */
private class MutableEventFlow<T> {
    private val subscribers = mutableListOf<(T) -> Unit>()
    private var closed = false
    private val buffer = mutableListOf<T>()

    fun tryEmit(value: T): Boolean {
        if (closed) return false
        val subs = synchronized(subscribers) { subscribers.toList() }
        if (subs.isEmpty()) {
            synchronized(buffer) { buffer.add(value) }
        } else {
            subs.forEach { runCatching { it(value) } }
        }
        return true
    }

    fun close() {
        closed = true
    }

    fun isClosed(): Boolean = closed

    val flow: Flow<T> = callbackFlow {
        val cb: (T) -> Unit = { value -> trySend(value) }
        synchronized(subscribers) {
            // 先回放缓存
            synchronized(buffer) {
                buffer.forEach { trySend(it) }
                buffer.clear()
            }
            subscribers.add(cb)
        }
        awaitClose {
            synchronized(subscribers) { subscribers.remove(cb) }
        }
    }.flowOn(Dispatchers.IO)
}

package com.lynnhub.app.data.remote

import com.lynnhub.app.data.local.UserPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
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
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 语音 API 客户端
 * ASR：上传 WAV → 返回文字
 * TTS：发送文字 → 返回音频
 */
@Singleton
class VoiceApiClient @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val userPreferences: UserPreferences,
    private val json: Json
) {

    /** ASR 语音识别 */
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
            throw Exception("ASR 失败: ${response.code}")
        }

        return@withContext try {
            val obj = json.parseToJsonElement(body).jsonObject
            obj["text"]?.jsonPrimitive?.contentOrNull ?: ""
        } catch (_: Exception) {
            body
        }
    }

    /**
     * 流式 TTS：返回 Flow<ByteArray>，每个 chunk 是音频片段
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
            emit(TtsEvent.Error("TTS 失败: ${response.code}"))
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
                        // 音频 base64 数据
                        try {
                            val audioBytes = android.util.Base64.decode(data, android.util.Base64.NO_WRAP)
                            emit(TtsEvent.AudioChunk(audioBytes))
                        } catch (_: Exception) { }
                    }
                    currentData = StringBuilder()
                }
            }
        }
        response.close()
    }.flowOn(Dispatchers.IO)
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

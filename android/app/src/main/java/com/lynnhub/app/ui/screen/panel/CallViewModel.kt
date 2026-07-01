package com.lynnhub.app.ui.screen.panel

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.VoiceApiClient
import com.lynnhub.app.data.remote.TtsEvent
import com.lynnhub.app.data.remote.dto.ChatMessageRequest
import com.lynnhub.app.data.remote.dto.ChatSendRequest
import com.lynnhub.app.util.AudioRecorder
import com.lynnhub.app.util.VadDetector
import com.lynnhub.app.util.VadEvent
import dagger.hilt.android.qualifiers.ApplicationContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import javax.inject.Inject

/**
 * 语音通话状态
 */
enum class CallState {
    IDLE,       // 空闲/已挂断
    LISTENING,  // 聆听中（录音 + VAD 端点检测）
    THINKING,   // 思考中（ASR + LLM 推理）
    SPEAKING,   // 播报中（流式 TTS + 音频播放）
    ERROR       // 出错（2 秒后自动恢复 LISTENING）
}

data class CallUiState(
    val state: CallState = CallState.IDLE,
    val elapsedSeconds: Int = 0,
    val transcript: String = "",       // 用户最近说的话
    val aiResponse: String = "",       // AI 最近回复
    val error: String? = null
)

/**
 * 全双工语音通话 ViewModel
 *
 * 完整流程（循环）：
 *   LISTENING（AudioRecorder + VadDetector 端点检测）
 *     → THINKING（ASR 识别 + LLM 推理）
 *       → SPEAKING（流式 TTS + MediaPlayer 播放）
 *         → LISTENING（回到聆听）
 *
 * 复用已有组件：AudioRecorder / VadDetector / VoiceApiClient / ApiService.sendChat
 */
@HiltViewModel
class CallViewModel @Inject constructor(
    private val apiService: ApiService,
    private val voiceApiClient: VoiceApiClient,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(CallUiState())
    val uiState: StateFlow<CallUiState> = _uiState.asStateFlow()

    private val audioRecorder = AudioRecorder()
    private val vadDetector = VadDetector(
        energyThreshold = 0.02f,
        silenceDurationMs = 1500,
        maxDurationMs = 30000
    )

    private var callJob: Job? = null
    private var timerJob: Job? = null
    private var mediaPlayer: MediaPlayer? = null

    // 对话历史（保持上下文，避免 token 膨胀）
    private val conversationHistory = mutableListOf<ChatMessageRequest>()

    /** 启动通话 */
    fun startCall() {
        if (_uiState.value.state != CallState.IDLE) return
        conversationHistory.clear()
        _uiState.update {
            it.copy(
                state = CallState.LISTENING,
                elapsedSeconds = 0,
                transcript = "",
                aiResponse = "",
                error = null
            )
        }
        startTimer()
        callJob = viewModelScope.launch { runCallLoop() }
    }

    /** 结束通话 */
    fun endCall() {
        callJob?.cancel()
        callJob = null
        timerJob?.cancel()
        timerJob = null
        if (audioRecorder.isRecording()) {
            audioRecorder.stop()
        }
        mediaPlayer?.let { mp ->
            try { mp.stop() } catch (_: Exception) {}
            mp.release()
        }
        mediaPlayer = null
        _uiState.update { it.copy(state = CallState.IDLE) }
    }

    /** 主通话循环：不断执行单轮对话直到挂断 */
    private suspend fun runCallLoop() {
        while (_uiState.value.state != CallState.IDLE) {
            try {
                runSingleTurn()
            } catch (e: kotlinx.coroutines.CancellationException) {
                // 通话被取消，直接退出
                throw e
            } catch (e: Exception) {
                _uiState.update { it.copy(state = CallState.ERROR, error = e.message ?: "未知错误") }
                delay(2000)
                if (_uiState.value.state != CallState.IDLE) {
                    _uiState.update { it.copy(state = CallState.LISTENING, error = null) }
                }
            }
        }
    }

    /**
     * 单轮对话：聆听 → 思考 → 播报 → 回到聆听
     */
    private suspend fun runSingleTurn() {
        // ====== 1. LISTENING：录音 + VAD 端点检测 ======
        _uiState.update { it.copy(state = CallState.LISTENING) }
        val wavData = recordWithVad() ?: return
        if (_uiState.value.state == CallState.IDLE) return

        // ====== 2. THINKING：ASR 识别 + LLM 推理 ======
        _uiState.update { it.copy(state = CallState.THINKING) }

        val userText = voiceApiClient.recognizeSpeech(wavData)
        if (userText.isBlank()) return // 空输入，回到循环重新聆听

        _uiState.update { it.copy(transcript = userText) }
        conversationHistory.add(ChatMessageRequest(role = "user", content = userText))

        val req = ChatSendRequest(
            messages = conversationHistory.toList(),
            provider = "deepseek",
            assistantMode = true,
            stream = false
        )
        val resp = apiService.sendChat(req)
        val aiText = resp.content.ifBlank { "我没有理解你的意思" }

        _uiState.update { it.copy(aiResponse = aiText) }
        conversationHistory.add(ChatMessageRequest(role = "assistant", content = aiText))

        // 限制历史长度（保留最近 10 轮 = 20 条消息）
        while (conversationHistory.size > 20) {
            conversationHistory.removeAt(0)
        }

        // ====== 3. SPEAKING：流式 TTS + 音频播放 ======
        _uiState.update { it.copy(state = CallState.SPEAKING) }
        playTTS(aiText)

        // ====== 4. 回到 LISTENING（由 runCallLoop 的下一轮处理）======
    }

    /** 录音 + VAD 端点检测，返回 WAV 数据；null 表示未录到有效音频或已挂断 */
    private suspend fun recordWithVad(): ByteArray? {
        try {
            if (!audioRecorder.start()) {
                _uiState.update { it.copy(state = CallState.ERROR, error = "无法启动录音，请检查麦克风权限") }
                return null
            }
        } catch (e: SecurityException) {
            _uiState.update { it.copy(state = CallState.ERROR, error = "缺少录音权限，请在设置中开启") }
            return null
        } catch (e: Exception) {
            _uiState.update { it.copy(state = CallState.ERROR, error = "录音启动失败: ${e.message}") }
            return null
        }
        vadDetector.reset()

        // 用 CompletableDeferred 等待端点检测完成
        val endpointReached = CompletableDeferred<Boolean>()
        val amplitudeJob = viewModelScope.launch {
            audioRecorder.amplitude.collect { amp ->
                val event = vadDetector.processAmplitude(amp)
                if (event == VadEvent.ENDPOINT) {
                    endpointReached.complete(true)
                }
            }
        }

        // 等待端点检测，最多 30 秒
        try {
            withTimeoutOrNull(30_000L) {
                endpointReached.await()
            }
        } finally {
            amplitudeJob.cancel()
        }

        if (_uiState.value.state == CallState.IDLE) {
            try { audioRecorder.stop() } catch (_: Exception) {}
            return null
        }

        val pcmData = try {
            audioRecorder.stop()
        } catch (e: Exception) {
            _uiState.update { it.copy(state = CallState.ERROR, error = "录音停止失败: ${e.message}") }
            return null
        }
        if (pcmData.isEmpty()) return null
        return audioRecorder.pcmToWav(pcmData)
    }

    /** 流式 TTS 收集音频片段并播放 */
    private suspend fun playTTS(text: String) {
        val audioChunks = mutableListOf<ByteArray>()
        voiceApiClient.streamTTS(text).collect { event ->
            when (event) {
                is TtsEvent.AudioChunk -> audioChunks.add(event.data)
                is TtsEvent.Done -> { /* 收集完毕，下方播放 */ }
                is TtsEvent.Error -> {
                    _uiState.update { it.copy(error = event.message) }
                    return@collect
                }
            }
        }

        if (audioChunks.isEmpty()) return

        val allBytes = audioChunks.reduce { acc, bytes -> acc + bytes }
        playAudioBytes(allBytes)
    }

    /** 用 MediaPlayer 播放音频字节（通过临时文件，兼容 MP3/WAV 等格式） */
    private suspend fun playAudioBytes(data: ByteArray) = withContext(Dispatchers.IO) {
        val tempFile = File.createTempFile("tts_${System.currentTimeMillis()}", ".mp3", context.cacheDir)
        try {
            tempFile.writeBytes(data)
            val mp = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                setDataSource(tempFile.absolutePath)
                prepare()
                start()
            }
            mediaPlayer = mp

            // 阻塞等待播放完成或通话结束
            while (mp.isPlaying && _uiState.value.state == CallState.SPEAKING) {
                delay(200)
            }
            try { if (mp.isPlaying) mp.stop() } catch (_: Exception) {}
            mp.release()
            mediaPlayer = null
        } catch (e: Exception) {
            _uiState.update { it.copy(error = "音频播放失败: ${e.message}") }
        } finally {
            tempFile.delete()
        }
    }

    /** 通话计时器 */
    private fun startTimer() {
        timerJob = viewModelScope.launch {
            while (true) {
                delay(1000)
                _uiState.update { it.copy(elapsedSeconds = it.elapsedSeconds + 1) }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        endCall()
    }
}

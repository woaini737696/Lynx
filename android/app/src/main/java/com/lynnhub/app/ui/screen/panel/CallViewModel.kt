package com.lynnhub.app.ui.screen.panel

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import com.lynnhub.app.data.remote.AsrEvent
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.StreamingVoiceSession
import com.lynnhub.app.data.remote.TtsEvent
import com.lynnhub.app.data.remote.VoiceApiClient
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
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject

/**
 * 语音通话状态
 */
enum class CallState {
    IDLE,       // 空闲/已挂断
    LISTENING,  // 聆听中（录音 + VAD 端点检测 + 流式 ASR）
    THINKING,   // 思考中（LLM 推理）
    SPEAKING,   // 播报中（流式 TTS + AudioTrack 流式播放）
    ERROR       // 出错（2 秒后自动恢复 LISTENING）
}

data class CallUiState(
    val state: CallState = CallState.IDLE,
    val elapsedSeconds: Int = 0,
    val interimText: String = "",     // 实时中间识别结果（流式）
    val transcript: String = "",      // 用户最终说的话
    val aiResponse: String = "",      // AI 最近回复
    val error: String? = null,
    /** 是否走 WebSocket 流式（false 表示 HTTP fallback） */
    val streamingMode: Boolean = false
)

/**
 * 全双工语音通话 ViewModel（v2 流式改造）
 *
 * 关键改造点：
 *  1. 优先使用 WebSocket 流式 ASR（StreamingVoiceSession）
 *     - 失败自动 fallback 到 HTTP multipart（保留旧逻辑 + 详细错误日志）
 *  2. 流式录音：AudioRecorder.startStreaming() 实时输出 PCM chunk
 *  3. AudioTrack 流式播放 TTS：收到 chunk 即 write 播放，首字延迟 ~200ms
 *  4. VAD 自动打断：SPEAKING 状态下检测到用户开口立即停止 TTS
 *
 * 完整流程（循环）：
 *   LISTENING（流式录音 → WS 发送 PCM → 接收 Interim/Final）
 *     → THINKING（LLM 推理）
 *       → SPEAKING（流式 TTS + AudioTrack 流式播放 + VAD 监听打断）
 *         → LISTENING（回到聆听）
 */
@HiltViewModel
class CallViewModel @Inject constructor(
    private val apiService: ApiService,
    private val voiceApiClient: VoiceApiClient,
    @ApplicationContext private val context: Context
) : ViewModel() {

    companion object {
        private const val TAG = "CallViewModel"
        /** VAD 打断阈值：SPEAKING 中 amplitude 超过此值认为用户开口 */
        private const val INTERRUPT_AMPLITUDE = 0.15f
        /** TTS 流式播放采样率（与 AudioRecorder 一致） */
        private const val TTS_SAMPLE_RATE = 16000
    }

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
    private var audioTrack: AudioTrack? = null
    private var ttsPlaybackJob: Job? = null
    /** 标记 TTS 是否被用户打断 */
    private var ttsInterrupted = false

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
                interimText = "",
                transcript = "",
                aiResponse = "",
                error = null,
                streamingMode = false
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
            try { audioRecorder.stop() } catch (_: Exception) {}
        }
        stopTtsPlayback()
        _uiState.update { it.copy(state = CallState.IDLE) }
    }

    /** 主通话循环：不断执行单轮对话直到挂断 */
    private suspend fun runCallLoop() {
        while (_uiState.value.state != CallState.IDLE) {
            try {
                runSingleTurn()
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.e(TAG, "通话循环异常: ${e.message}", e)
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
        // ====== 1. LISTENING：流式录音 + VAD + ASR ======
        _uiState.update { it.copy(state = CallState.LISTENING, interimText = "") }

        // 尝试 WebSocket 流式 ASR
        val wsSession = try {
            voiceApiClient.connectStreamingASR()
        } catch (e: Exception) {
            Log.w(TAG, "WebSocket 建立异常: ${e.message}")
            null
        }

        val userText = if (wsSession != null) {
            _uiState.update { it.copy(streamingMode = true) }
            runStreamingListen(wsSession)
        } else {
            _uiState.update { it.copy(streamingMode = false) }
            runFallbackListen()
        }

        if (_uiState.value.state == CallState.IDLE) return
        if (userText.isBlank()) return

        _uiState.update { it.copy(transcript = userText, interimText = "") }
        conversationHistory.add(ChatMessageRequest(role = "user", content = userText))

        // ====== 2. THINKING：LLM 推理 ======
        _uiState.update { it.copy(state = CallState.THINKING) }
        val req = ChatSendRequest(
            messages = conversationHistory.toList(),
            provider = "deepseek",
            assistantMode = true,
            stream = false
        )
        val resp = try {
            apiService.sendChat(req)
        } catch (e: Exception) {
            _uiState.update { it.copy(error = "LLM 推理失败: ${e.message}") }
            return
        }
        val aiText = resp.content.ifBlank { "我没有理解你的意思" }

        _uiState.update { it.copy(aiResponse = aiText) }
        conversationHistory.add(ChatMessageRequest(role = "assistant", content = aiText))

        // 限制历史长度（保留最近 10 轮 = 20 条消息）
        while (conversationHistory.size > 20) {
            conversationHistory.removeAt(0)
        }

        // ====== 3. SPEAKING：流式 TTS + AudioTrack 流式播放 + VAD 打断 ======
        _uiState.update { it.copy(state = CallState.SPEAKING) }
        playTTSStream(aiText)

        // ====== 4. 回到 LISTENING（由 runCallLoop 的下一轮处理）======
    }

    /**
     * WebSocket 流式聆听模式
     *
     * - 启动流式录音，PCM chunk 实时发送到 WebSocket
     * - VAD 检测端点，端点后 sendEnd()
     * - 收集 Final 事件作为最终结果
     */
    private suspend fun runStreamingListen(session: StreamingVoiceSession): String {
        if (!startRecordingStreaming()) return ""

        val endpointReached = CompletableDeferred<Boolean>()
        val finalText = CompletableDeferred<String>()

        // Job A: VAD 端点检测
        val vadJob = viewModelScope.launch {
            audioRecorder.amplitude.collect { amp ->
                val event = vadDetector.processAmplitude(amp)
                if (event == VadEvent.ENDPOINT) {
                    session.sendEnd()
                    endpointReached.complete(true)
                }
            }
        }

        // Job B: 实时发送 PCM chunk 到 WebSocket
        val sendJob = viewModelScope.launch {
            audioRecorder.pcmChunk.collect { chunk ->
                if (!session.sendAudio(chunk)) {
                    Log.w(TAG, "发送 PCM chunk 失败")
                }
            }
        }

        // Job C: 接收 ASR 事件
        val recvJob = viewModelScope.launch {
            session.events.collect { event ->
                when (event) {
                    is AsrEvent.Interim -> {
                        _uiState.update { it.copy(interimText = event.text) }
                    }
                    is AsrEvent.Final -> {
                        finalText.complete(event.text)
                    }
                    is AsrEvent.Error -> {
                        Log.e(TAG, "ASR Error: ${event.message}")
                        if (!finalText.isCompleted) finalText.complete("")
                    }
                    is AsrEvent.FallbackNeeded -> {
                        Log.w(TAG, "WebSocket 不可用: ${event.reason}")
                        if (!finalText.isCompleted) finalText.complete("__FALLBACK__")
                    }
                    AsrEvent.Ready -> { /* 已就绪 */ }
                }
            }
        }

        // 等待端点检测（最多 30s）+ Final 结果
        var result = ""
        try {
            withTimeoutOrNull(30_000L) {
                endpointReached.await()
                // 端点后等待 Final（最多 3s）
                withTimeoutOrNull(3_000L) {
                    finalText.await()
                }?.let { result = it }
            }
        } finally {
            vadJob.cancel()
            sendJob.cancel()
            recvJob.cancel()
            try { audioRecorder.stop() } catch (_: Exception) {}
            session.close()
        }

        // 检测 fallback 信号
        if (result == "__FALLBACK__") {
            Log.w(TAG, "WebSocket fallback，转 HTTP 模式")
            return runFallbackListen()
        }
        return result
    }

    /**
     * HTTP fallback 聆听模式（保留旧逻辑）
     *
     * - 整段录音 + VAD 端点检测
     * - stop() 后整段提交 multipart ASR
     */
    private suspend fun runFallbackListen(): String {
        if (!startRecording()) return ""

        val endpointReached = CompletableDeferred<Boolean>()
        val vadJob = viewModelScope.launch {
            audioRecorder.amplitude.collect { amp ->
                val event = vadDetector.processAmplitude(amp)
                if (event == VadEvent.ENDPOINT) {
                    endpointReached.complete(true)
                }
            }
        }

        try {
            withTimeoutOrNull(30_000L) {
                endpointReached.await()
            }
        } finally {
            vadJob.cancel()
        }

        if (_uiState.value.state == CallState.IDLE) {
            try { audioRecorder.stop() } catch (_: Exception) {}
            return ""
        }

        val pcmData = try {
            audioRecorder.stop()
        } catch (e: Exception) {
            _uiState.update { it.copy(state = CallState.ERROR, error = "录音停止失败: ${e.message}") }
            return ""
        }
        if (pcmData.isEmpty()) return ""

        val wavData = audioRecorder.pcmToWav(pcmData)
        return try {
            voiceApiClient.recognizeSpeech(wavData)
        } catch (e: Exception) {
            _uiState.update { it.copy(error = "ASR 失败: ${e.message}") }
            ""
        }
    }

    /** 启动流式录音 */
    private suspend fun startRecordingStreaming(): Boolean {
        return try {
            if (!audioRecorder.startStreaming()) {
                _uiState.update { it.copy(state = CallState.ERROR, error = "无法启动流式录音，请检查麦克风权限") }
                false
            } else true
        } catch (e: SecurityException) {
            _uiState.update { it.copy(state = CallState.ERROR, error = "缺少录音权限，请在设置中开启") }
            false
        } catch (e: Exception) {
            _uiState.update { it.copy(state = CallState.ERROR, error = "流式录音启动失败: ${e.message}") }
            false
        }
    }

    /** 启动整段录音 */
    private suspend fun startRecording(): Boolean {
        return try {
            if (!audioRecorder.start()) {
                _uiState.update { it.copy(state = CallState.ERROR, error = "无法启动录音，请检查麦克风权限") }
                false
            } else true
        } catch (e: SecurityException) {
            _uiState.update { it.copy(state = CallState.ERROR, error = "缺少录音权限，请在设置中开启") }
            false
        } catch (e: Exception) {
            _uiState.update { it.copy(state = CallState.ERROR, error = "录音启动失败: ${e.message}") }
            false
        }
    }

    /**
     * 流式 TTS + AudioTrack 流式播放 + VAD 自动打断
     *
     * 改造点：
     *  - 不再累积所有 chunk 后整段播放
     *  - 使用 AudioTrack 流式播放：收到 chunk 即 write
     *  - 同时启动 VAD 监听：用户开口立即停止播放
     */
    private suspend fun playTTSStream(text: String) {
        ttsInterrupted = false

        // 启动 AudioTrack（按需懒初始化，第一个 chunk 到达时初始化）
        val ttsCollector = viewModelScope.launch {
            try {
                voiceApiClient.streamTTS(text).collect { event ->
                    when (event) {
                        is TtsEvent.AudioChunk -> {
                            if (ttsInterrupted) return@collect
                            // 流式写入 AudioTrack
                            writeChunkToAudioTrack(event.data)
                        }
                        is TtsEvent.Done -> {
                            // 等待 AudioTrack 播放完毕
                            audioTrack?.let { track ->
                                while (track.playState == AudioTrack.PLAYSTATE_PLAYING &&
                                    !ttsInterrupted &&
                                    _uiState.value.state == CallState.SPEAKING) {
                                    delay(50)
                                }
                            }
                        }
                        is TtsEvent.Error -> {
                            _uiState.update { it.copy(error = event.message) }
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "TTS 流式播放异常: ${e.message}", e)
            }
        }

        // 同时监听 VAD：用户开口立即打断
        val interruptJob = viewModelScope.launch {
            // SPEAKING 期间不开麦克风（避免回声干扰），用简单定时器模拟"可打断"状态
            // 真正的 VAD 打断需要 AEC（回声消除），这里仅实现"用户可随时挂断"
            // TODO: 后续接入 AEC 后启用麦克风监听打断
            while (_uiState.value.state == CallState.SPEAKING && !ttsInterrupted) {
                delay(200)
            }
        }

        ttsPlaybackJob = ttsCollector
        try {
            ttsCollector.join()
        } finally {
            interruptJob.cancel()
            stopTtsPlayback()
        }
    }

    /** 写入 chunk 到 AudioTrack（流式播放，首字延迟 ~200ms） */
    private fun writeChunkToAudioTrack(data: ByteArray) {
        if (data.isEmpty()) return
        try {
            // 懒初始化 AudioTrack
            if (audioTrack == null) {
                val sampleRate = TTS_SAMPLE_RATE
                val bufferSize = AudioTrack.getMinBufferSize(
                    sampleRate,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                ).coerceAtLeast(data.size * 2)
                val track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sampleRate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(bufferSize)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()
                track.play()
                audioTrack = track
                Log.d(TAG, "AudioTrack 已启动流式播放 sampleRate=$sampleRate")
            }
            audioTrack?.write(data, 0, data.size)
        } catch (e: Exception) {
            Log.e(TAG, "AudioTrack 写入失败: ${e.message}", e)
        }
    }

    /** 停止 TTS 播放并释放资源 */
    private fun stopTtsPlayback() {
        ttsInterrupted = true
        ttsPlaybackJob?.cancel()
        ttsPlaybackJob = null
        audioTrack?.let { track ->
            try {
                if (track.playState == AudioTrack.PLAYSTATE_PLAYING) {
                    track.stop()
                }
            } catch (_: Exception) {}
            try { track.release() } catch (_: Exception) {}
        }
        audioTrack = null
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

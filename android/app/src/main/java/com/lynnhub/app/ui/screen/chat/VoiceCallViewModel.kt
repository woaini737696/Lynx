package com.lynnhub.app.ui.screen.chat

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lynnhub.app.data.remote.ApiService
import com.lynnhub.app.data.remote.TtsEvent
import com.lynnhub.app.data.remote.VoiceApiClient
import com.lynnhub.app.data.remote.dto.ChatMessageRequest
import com.lynnhub.app.data.remote.dto.ChatSendRequest
import com.lynnhub.app.util.AudioRecorder
import com.lynnhub.app.util.VadDetector
import com.lynnhub.app.util.VadEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class VoiceCallState {
    IDLE,
    LISTENING,
    PROCESSING,
    SPEAKING,
    ERROR
}

data class VoiceCallUiState(
    val state: VoiceCallState = VoiceCallState.IDLE,
    val transcript: String = "",
    val aiResponse: String = "",
    val error: String? = null,
    val hasPermission: Boolean = false
)

@HiltViewModel
class VoiceCallViewModel @Inject constructor(
    private val voiceApiClient: VoiceApiClient,
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(VoiceCallUiState())
    val uiState: StateFlow<VoiceCallUiState> = _uiState.asStateFlow()

    private var audioRecorder: AudioRecorder? = null
    private var vadDetector: VadDetector? = null
    private var audioTrack: AudioTrack? = null
    private var listenJob: Job? = null
    private var processingJob: Job? = null
    private var isCallActive = false
    private val conversationHistory = mutableListOf<ChatMessageRequest>()

    fun setPermissionGranted(granted: Boolean) {
        _uiState.value = _uiState.value.copy(hasPermission = granted)
    }

    fun startCall() {
        if (_uiState.value.state != VoiceCallState.IDLE) return
        if (!_uiState.value.hasPermission) {
            _uiState.value = _uiState.value.copy(error = "请先授予录音权限")
            return
        }

        isCallActive = true
        conversationHistory.clear()
        _uiState.value = VoiceCallUiState(state = VoiceCallState.LISTENING, hasPermission = true)
        audioRecorder = AudioRecorder()
        vadDetector = VadDetector()

        startListening()
    }

    fun stopCall() {
        isCallActive = false
        listenJob?.cancel()
        listenJob = null
        processingJob?.cancel()
        processingJob = null
        try { audioRecorder?.stop() } catch (_: Exception) {}
        audioRecorder = null
        try {
            audioTrack?.stop()
            audioTrack?.release()
        } catch (_: Exception) {}
        audioTrack = null
        vadDetector?.reset()
        vadDetector = null
        conversationHistory.clear()
        _uiState.value = VoiceCallUiState(hasPermission = _uiState.value.hasPermission)
    }

    fun togglePause() {
        val currentState = _uiState.value.state
        if (currentState == VoiceCallState.LISTENING || currentState == VoiceCallState.PROCESSING || currentState == VoiceCallState.SPEAKING) {
            isCallActive = false
            listenJob?.cancel()
            listenJob = null
            processingJob?.cancel()
            processingJob = null
            try { audioRecorder?.stop() } catch (_: Exception) {}
            audioRecorder = null
            try {
                audioTrack?.stop()
                audioTrack?.release()
            } catch (_: Exception) {}
            audioTrack = null
            _uiState.value = _uiState.value.copy(state = VoiceCallState.IDLE, error = null)
        } else if (currentState == VoiceCallState.IDLE) {
            if (!_uiState.value.hasPermission) {
                _uiState.value = _uiState.value.copy(error = "请先授予录音权限")
                return
            }
            isCallActive = true
            _uiState.value = _uiState.value.copy(state = VoiceCallState.LISTENING, error = null)
            audioRecorder = AudioRecorder()
            vadDetector?.reset()
            startListening()
        }
    }

    private fun startListening() {
        val recorder = audioRecorder ?: return
        val vad = vadDetector ?: return

        val started = recorder.start()
        if (!started) {
            _uiState.value = _uiState.value.copy(
                state = VoiceCallState.ERROR,
                error = "录音初始化失败，请检查麦克风权限"
            )
            return
        }

        listenJob = viewModelScope.launch {
            val amplitudeFlow = recorder.amplitude
            var endpointDetected = false

            amplitudeFlow.collect { amp ->
                if (!isCallActive || !isActive) {
                    return@collect
                }
                val event = vad.processAmplitude(amp)
                if (event == VadEvent.ENDPOINT && !endpointDetected) {
                    endpointDetected = true
                    processingJob?.cancel()
                    processingJob = viewModelScope.launch {
                        processUserSpeech()
                    }
                }
            }
        }
    }

    private suspend fun processUserSpeech() {
        if (!isCallActive || _uiState.value.state != VoiceCallState.LISTENING) return

        _uiState.value = _uiState.value.copy(state = VoiceCallState.PROCESSING)

        listenJob?.cancel()

        val recorder = audioRecorder
        val pcm = try { recorder?.stop() } catch (_: Exception) { null } ?: ByteArray(0)

        if (pcm.isEmpty() || pcm.size < 3200) {
            if (isCallActive) {
                audioRecorder = AudioRecorder()
                vadDetector?.reset()
                _uiState.value = _uiState.value.copy(state = VoiceCallState.LISTENING, error = null)
                startListening()
            }
            return
        }

        val wav = try { recorder?.pcmToWav(pcm) } catch (_: Exception) { null }
        if (wav == null) {
            if (isCallActive) {
                audioRecorder = AudioRecorder()
                vadDetector?.reset()
                _uiState.value = _uiState.value.copy(state = VoiceCallState.LISTENING, error = "音频处理失败")
                startListening()
            }
            return
        }

        try {
            val text = voiceApiClient.recognizeSpeech(wav)
            _uiState.value = _uiState.value.copy(transcript = text)

            if (text.isBlank()) {
                if (isCallActive) {
                    audioRecorder = AudioRecorder()
                    vadDetector?.reset()
                    _uiState.value = _uiState.value.copy(state = VoiceCallState.LISTENING, error = null)
                    startListening()
                }
                return
            }

            conversationHistory.add(ChatMessageRequest(role = "user", content = text))

            _uiState.value = _uiState.value.copy(state = VoiceCallState.SPEAKING, aiResponse = "")

            val response = apiService.sendChat(ChatSendRequest(
                messages = conversationHistory.toList(),
                provider = "deepseek",
                assistantMode = true,
                stream = false
            ))

            val aiText = response.content
            conversationHistory.add(ChatMessageRequest(role = "assistant", content = aiText))
            _uiState.value = _uiState.value.copy(aiResponse = aiText)

            playTTS(aiText)

            if (isCallActive) {
                audioRecorder = AudioRecorder()
                vadDetector?.reset()
                _uiState.value = _uiState.value.copy(state = VoiceCallState.LISTENING, transcript = "", aiResponse = "", error = null)
                startListening()
            }

        } catch (e: Exception) {
            if (isCallActive) {
                audioRecorder = AudioRecorder()
                vadDetector?.reset()
                _uiState.value = _uiState.value.copy(
                    state = VoiceCallState.LISTENING,
                    error = e.message ?: "处理失败"
                )
                startListening()
            }
        }
    }

    private suspend fun playTTS(text: String) {
        if (text.isBlank() || !isCallActive) return

        try {
            initAudioTrack()
        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(error = "音频播放初始化失败")
            return
        }

        try {
            voiceApiClient.streamTTS(text).collect { event ->
                if (!isCallActive) return@collect
                when (event) {
                    is TtsEvent.AudioChunk -> {
                        try {
                            audioTrack?.write(event.data, 0, event.data.size)
                            if (audioTrack?.playState != AudioTrack.PLAYSTATE_PLAYING) {
                                audioTrack?.play()
                            }
                        } catch (_: Exception) {}
                    }
                    TtsEvent.Done -> {
                        try { audioTrack?.stop() } catch (_: Exception) {}
                    }
                    is TtsEvent.Error -> {
                        _uiState.value = _uiState.value.copy(error = event.message)
                    }
                }
            }
        } catch (_: Exception) {}
    }

    private fun initAudioTrack() {
        try { audioTrack?.release() } catch (_: Exception) {}

        val sampleRate = 24000
        val bufferSize = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )
        if (bufferSize == AudioTrack.ERROR || bufferSize == AudioTrack.ERROR_BAD_VALUE) {
            throw IllegalStateException("AudioTrack buffer size calculation failed")
        }

        val track = AudioTrack(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
            AudioFormat.Builder()
                .setSampleRate(sampleRate)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build(),
            bufferSize,
            AudioTrack.MODE_STREAM,
            AudioManager.AUDIO_SESSION_ID_GENERATE
        )

        if (track.state == AudioTrack.STATE_INITIALIZED) {
            audioTrack = track
        } else {
            track.release()
            throw IllegalStateException("AudioTrack initialization failed")
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopCall()
    }
}

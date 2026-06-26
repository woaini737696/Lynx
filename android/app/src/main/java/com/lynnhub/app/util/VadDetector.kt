package com.lynnhub.app.util

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * 语音端点检测（Voice Activity Detection）
 * 基于能量阈值 + 静默时长判断说话结束
 * 替代 H5 的 AudioContext 分析
 */
class VadDetector(
    private val energyThreshold: Float = 0.02f,
    private val silenceDurationMs: Long = 1500,
    private val maxDurationMs: Long = 30000
) {
    enum class VadState {
        IDLE,       // 空闲
        LISTENING,  // 正在说话
        SILENCE     // 说话后的静默期
    }

    private val _state = MutableStateFlow(VadState.IDLE)
    val state: StateFlow<VadState> = _state

    private var speechStartTime: Long = 0
    private var silenceStartTime: Long = 0

    /** 输入当前振幅（0~1），返回是否检测到端点 */
    fun processAmplitude(amplitude: Float): VadEvent {
        val now = System.currentTimeMillis()
        val currentState = _state.value

        return when (currentState) {
            VadState.IDLE -> {
                if (amplitude > energyThreshold) {
                    _state.value = VadState.LISTENING
                    speechStartTime = now
                    VadEvent.SPEECH_START
                } else {
                    VadEvent.NONE
                }
            }
            VadState.LISTENING -> {
                if (amplitude < energyThreshold) {
                    _state.value = VadState.SILENCE
                    silenceStartTime = now
                }
                if (now - speechStartTime > maxDurationMs) {
                    _state.value = VadState.IDLE
                    VadEvent.ENDPOINT
                } else {
                    VadEvent.NONE
                }
            }
            VadState.SILENCE -> {
                if (amplitude > energyThreshold) {
                    _state.value = VadState.LISTENING
                    VadEvent.NONE
                } else if (now - silenceStartTime > silenceDurationMs) {
                    _state.value = VadState.IDLE
                    VadEvent.ENDPOINT
                } else {
                    VadEvent.NONE
                }
            }
        }
    }

    fun reset() {
        _state.value = VadState.IDLE
    }
}

enum class VadEvent {
    NONE,           // 无事件
    SPEECH_START,   // 检测到说话开始
    ENDPOINT        // 检测到端点（说话结束）
}

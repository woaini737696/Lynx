package com.lynnhub.app.util

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.ByteArrayOutputStream

class AudioRecorder {

    companion object {
        const val SAMPLE_RATE = 16000
        const val CHANNEL = AudioFormat.CHANNEL_IN_MONO
        const val ENCODING = AudioFormat.ENCODING_PCM_16BIT
        const val FRAME_SIZE = 320
    }

    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var recordingThread: Thread? = null
    private val pcmBuffer = ByteArrayOutputStream()

    private val _amplitude = MutableStateFlow(0f)
    val amplitude: StateFlow<Float> = _amplitude

    fun start(): Boolean {
        if (isRecording) return true

        val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL, ENCODING)
        if (minBuf == AudioRecord.ERROR || minBuf == AudioRecord.ERROR_BAD_VALUE) {
            return false
        }
        val bufferSize = maxOf(minBuf, FRAME_SIZE * 4)

        val record = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            SAMPLE_RATE,
            CHANNEL,
            ENCODING,
            bufferSize
        )

        if (record.state != AudioRecord.STATE_INITIALIZED) {
            record.release()
            return false
        }

        audioRecord = record
        pcmBuffer.reset()

        return try {
            record.startRecording()
            isRecording = true

            recordingThread = Thread {
                val buffer = ShortArray(FRAME_SIZE)
                while (isRecording) {
                    val read = try {
                        record.read(buffer, 0, FRAME_SIZE)
                    } catch (_: Exception) {
                        -1
                    }
                    if (read > 0) {
                        var sum = 0L
                        for (i in 0 until read) {
                            sum += buffer[i].toLong() * buffer[i]
                        }
                        val rms = Math.sqrt(sum.toDouble() / read).toFloat()
                        _amplitude.value = (rms / Short.MAX_VALUE).coerceIn(0f, 1f)

                        val bytes = ByteArray(read * 2)
                        for (i in 0 until read) {
                            bytes[i * 2] = (buffer[i].toInt() and 0xFF).toByte()
                            bytes[i * 2 + 1] = (buffer[i].toInt() shr 8 and 0xFF).toByte()
                        }
                        synchronized(pcmBuffer) {
                            pcmBuffer.write(bytes)
                        }
                    }
                }
            }.apply { start() }
            true
        } catch (e: Exception) {
            record.release()
            audioRecord = null
            isRecording = false
            false
        }
    }

    fun stop(): ByteArray {
        isRecording = false
        try {
            try {
                audioRecord?.stop()
            } catch (_: Exception) {}
            recordingThread?.interrupt()
            recordingThread = null
        } finally {
            try {
                audioRecord?.release()
            } catch (_: Exception) {}
            audioRecord = null
        }
        synchronized(pcmBuffer) {
            return pcmBuffer.toByteArray()
        }
    }

    fun isRecording(): Boolean = isRecording

    fun pcmToWav(pcm: ByteArray): ByteArray {
        val wav = ByteArray(44 + pcm.size)
        System.arraycopy("RIFF".toByteArray(), 0, wav, 0, 4)
        writeInt(wav, 4, 36 + pcm.size)
        System.arraycopy("WAVE".toByteArray(), 0, wav, 8, 4)
        System.arraycopy("fmt ".toByteArray(), 0, wav, 12, 4)
        writeInt(wav, 16, 16)
        writeShort(wav, 20, 1)
        writeShort(wav, 22, 1)
        writeInt(wav, 24, SAMPLE_RATE)
        writeInt(wav, 28, SAMPLE_RATE * 2)
        writeShort(wav, 32, 2)
        writeShort(wav, 34, 16)
        System.arraycopy("data".toByteArray(), 0, wav, 36, 4)
        writeInt(wav, 40, pcm.size)
        System.arraycopy(pcm, 0, wav, 44, pcm.size)
        return wav
    }

    private fun writeInt(buf: ByteArray, offset: Int, value: Int) {
        buf[offset] = (value and 0xFF).toByte()
        buf[offset + 1] = (value shr 8 and 0xFF).toByte()
        buf[offset + 2] = (value shr 16 and 0xFF).toByte()
        buf[offset + 3] = (value shr 24 and 0xFF).toByte()
    }

    private fun writeShort(buf: ByteArray, offset: Int, value: Int) {
        buf[offset] = (value and 0xFF).toByte()
        buf[offset + 1] = (value shr 8 and 0xFF).toByte()
    }
}

package com.lynnhub.app.data.remote

import com.lynnhub.app.data.local.UserPreferences
import com.lynnhub.app.util.Constants
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

/**
 * WS Gateway 客户端（Android 端）
 *
 * 与桌面端 ws_client.rs 协议对齐：
 * 1. 连接 wss://<host>/api/ws/agent
 * 2. 首条消息发送 register：{ type:"register", token, agentVersion, deviceName, capabilities, authMode }
 * 3. 每 30 秒发送心跳：{ type:"heartbeat" }
 * 4. 接收服务端消息：command-update（PC 回传进度）/ remote-command（PC → Android 反向指令，可选）
 * 5. 提供 sendRemoteCommand(prompt) 方法：调用 POST /dispatch 下发指令到指定 PC
 * 6. 提供 watchCommand(commandId) 方法：订阅某条指令的进度更新
 *
 * 连接状态通过 connectionState StateFlow 暴露给 UI 层。
 * 接收到的消息通过 messages SharedFlow 暴露。
 *
 * 注意：WS URL 由 HTTPS 的 DEFAULT_BASE_URL 转换得到（https → wss）。
 */
@Singleton
class WsGatewayClient @Inject constructor(
    private val userPreferences: UserPreferences,
    private val json: Json
) {

    /** 连接状态 */
    enum class ConnectionState { DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING }

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    /** 接收到的服务端消息（command-update / remote-command / 注册响应 / 错误） */
    private val _messages = MutableSharedFlow<JsonObject>(extraBufferCapacity = 64)
    val messages: SharedFlow<JsonObject> = _messages.asSharedFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var webSocketRef = AtomicReference<WebSocket?>(null)
    private var heartbeatJob = AtomicReference<Job?>(null)
    private var connectJob = AtomicReference<Job?>(null)
    private val isStarted = AtomicBoolean(false)

    /** 启动 WS 连接（幂等，多次调用安全） */
    fun start() {
        if (isStarted.getAndSet(true)) return
        connect()
    }

    /** 停止 WS 连接 */
    fun stop() {
        isStarted.set(false)
        heartbeatJob.getAndSet(null)?.cancel()
        connectJob.getAndSet(null)?.cancel()
        webSocketRef.getAndSet(null)?.close(1000, "client closed")
        _connectionState.value = ConnectionState.DISCONNECTED
    }

    private fun connect() {
        if (!isStarted.get()) return
        _connectionState.value = if (webSocketRef.get() != null) ConnectionState.RECONNECTING else ConnectionState.CONNECTING
        connectJob.set(scope.launch {
            try {
                val baseUrl = userPreferences.getBaseUrl()
                val token = userPreferences.getToken() ?: run {
                    _connectionState.value = ConnectionState.DISCONNECTED
                    return@launch
                }
                // https:// → wss://，http:// → ws://
                val wsUrl = baseUrl.replace("https://", "wss://").replace("http://", "ws://") +
                            "api/ws/agent"

                val client = OkHttpClient.Builder()
                    .pingInterval(30, TimeUnit.SECONDS)
                    .connectTimeout(15, TimeUnit.SECONDS)
                    .readTimeout(0, TimeUnit.SECONDS) // WS 长连接
                    .build()

                val request = Request.Builder()
                    .url(wsUrl)
                    .apply {
                        // IP 直连时加 Host header 让 Nginx 正确路由
                        if (!baseUrl.contains(Constants.API_HOST)) {
                            addHeader("Host", Constants.API_HOST)
                        }
                    }
                    .build()

                client.newWebSocket(request, object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        webSocketRef.set(webSocket)
                        _connectionState.value = ConnectionState.CONNECTED
                        sendRegister(webSocket, token)
                        startHeartbeat(webSocket)
                    }

                    override fun onMessage(webSocket: WebSocket, text: String) {
                        try {
                            val obj = json.parseToJsonElement(text) as? JsonObject
                            if (obj != null) {
                                _messages.tryEmit(obj)
                            }
                        } catch (_: Exception) {
                            // 非 JSON 文本，忽略
                        }
                    }

                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                        webSocketRef.set(null)
                        _connectionState.value = ConnectionState.DISCONNECTED
                        scheduleReconnect()
                    }

                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        webSocketRef.set(null)
                        _connectionState.value = ConnectionState.DISCONNECTED
                        scheduleReconnect()
                    }
                })
            } catch (_: Exception) {
                _connectionState.value = ConnectionState.DISCONNECTED
                scheduleReconnect()
            }
        })
    }

    /** 发送 register 消息（对齐桌面端 ws_client.rs） */
    private fun sendRegister(webSocket: WebSocket, token: String) {
        val registerMsg = buildJsonObject {
            put("type", "register")
            put("token", token)
            put("agentVersion", "android-1.0.0")
            put("deviceName", android.os.Build.MODEL ?: "Lynx-Android")
            putJsonArray("capabilities") {
                // Android 当前不执行 RPA，仅作为控制端订阅进度
                add("command-watch")
            }
            put("authMode", "approve")
        }
        webSocket.send(json.encodeToString(JsonObject.serializer(), registerMsg))
    }

    /** 启动 30 秒心跳 */
    private fun startHeartbeat(webSocket: WebSocket) {
        heartbeatJob.getAndSet(null)?.cancel()
        val job = scope.launch {
            while (isStarted.get() && webSocketRef.get() === webSocket) {
                delay(30_000)
                val heartbeat = buildJsonObject { put("type", "heartbeat") }
                val sent = webSocket.send(json.encodeToString(JsonObject.serializer(), heartbeat))
                if (!sent) break
            }
        }
        heartbeatJob.set(job)
    }

    /** 失败后自动重连（5 秒延迟，避免空转） */
    private fun scheduleReconnect() {
        if (!isStarted.get()) return
        scope.launch {
            delay(5_000)
            if (isStarted.get() && webSocketRef.get() == null) {
                connect()
            }
        }
    }

    /** 订阅指定指令的进度（watch-command） */
    fun watchCommand(commandId: String) {
        val msg = buildJsonObject {
            put("type", "watch-command")
            put("commandId", commandId)
        }
        webSocketRef.get()?.send(json.encodeToString(JsonObject.serializer(), msg))
    }
}

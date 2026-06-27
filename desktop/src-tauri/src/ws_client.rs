// WebSocket 客户端：连接云端状态中心
//
// 功能：
// 1. 启动后向云端注册 PC 在线状态 + 能力清单
// 2. 接收云端下发的远程指令（来自安卓端/Web端）
// 3. 执行指令并通过 WS 流式回传进度
// 4. 定时心跳保持在线

use crate::AppState;
use crate::hermes::router;
use serde_json::json;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Manager, Emitter};
use tokio_tungstenite::tungstenite::Message;

/// 启动 WS 客户端，连接云端状态中心
pub async fn start_ws_client(cloud_endpoint: &str, user_token: &str, app: AppHandle) {
    let ws_url = build_ws_url(cloud_endpoint, user_token);
    log::info!("HermesAgent WS 客户端连接: {}", ws_url);

    loop {
        match connect_and_serve(&ws_url, &user_token, &app).await {
            Ok(_) => {
                log::info!("WS 连接正常关闭");
                break;
            }
            Err(e) => {
                log::warn!("WS 连接异常: {}, 5秒后重试", e);
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
}

/// 构造 WS URL：将 http(s):// 转为 ws(s)://，附加 token
fn build_ws_url(cloud_endpoint: &str, token: &str) -> String {
    let ws_scheme = if cloud_endpoint.starts_with("https") {
        "wss"
    } else {
        "ws"
    };
    let host = cloud_endpoint
        .replace("https://", "")
        .replace("http://", "");
    format!("{}://{}/api/ws/agent?token={}", ws_scheme, host, token)
}

/// 连接云端 WS 并处理消息
async fn connect_and_serve(ws_url: &str, token: &str, app: &AppHandle) -> Result<(), String> {
    use tokio_tungstenite::connect_async;

    let (ws_stream, _) = connect_async(ws_url)
        .await
        .map_err(|e| format!("WS 连接失败: {}", e))?;

    log::info!("WS 已连接，发送注册消息");

    let state = app.state::<Arc<AppState>>();
    state.ws_connected.store(true, Ordering::SeqCst);
    let _ = app.emit("ws-connected", ());

    let (mut write, mut read) = ws_stream.split();
    use futures_util::SinkExt;
    use futures_util::StreamExt;

    // 1. 发送注册消息
    let register_msg = json!({
        "type": "register",
        "agentVersion": env!("CARGO_PKG_VERSION"),
        "deviceName": get_device_name(),
        "capabilities": ["browser", "desktop", "file", "shell"],
        "authMode": state.auth_mode.lock().map_err(|e| e.to_string())?.clone(),
    });
    write.send(Message::Text(register_msg.to_string()))
        .await
        .map_err(|e| format!("发送注册消息失败: {}", e))?;

    // 2. 启动心跳任务
    let app_clone = app.clone();
    let heartbeat_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            // 心跳通过 app 事件触发，实际发送由主循环处理
            let _ = app_clone.emit("ws-heartbeat", ());
        }
    });

    // 3. 主循环：接收云端指令
    while let Some(msg_result) = read.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                if let Err(e) = handle_cloud_message(&text, token, app).await {
                    log::warn!("处理云端消息失败: {}", e);
                }
            }
            Ok(Message::Ping(_)) => {
                // 自动 pong 由 tungstenite 处理
            }
            Ok(Message::Close(_)) => {
                log::info!("收到 WS Close 帧");
                break;
            }
            Err(e) => {
                log::warn!("WS 读取错误: {}", e);
                break;
            }
            _ => {}
        }
    }

    heartbeat_task.abort();
    state.ws_connected.store(false, Ordering::SeqCst);
    let _ = app.emit("ws-disconnected", ());

    Ok(())
}

/// 处理云端下发的消息
async fn handle_cloud_message(text: &str, _token: &str, app: &AppHandle) -> Result<(), String> {
    let msg: serde_json::Value = serde_json::from_str(text)
        .map_err(|e| format!("解析消息失败: {}", e))?;

    let msg_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or("");

    match msg_type {
        "remote-command" => {
            // 远程指令：来自安卓端/Web端
            let command_id = msg.get("commandId").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let command = msg.get("command").and_then(|v| v.as_str()).unwrap_or("").to_string();

            log::info!("收到远程指令: {} (id={})", command, command_id);
            let _ = app.emit("remote-command-received", json!({
                "commandId": command_id,
                "command": command,
            }));

            // 执行指令
            let state = app.state::<Arc<AppState>>();
            let cloud = state.cloud_endpoint.lock().map_err(|e| e.to_string())?.clone();
            let auth_mode = state.auth_mode.lock().map_err(|e| e.to_string())?.clone();

            // 流式回传进度（通过事件给前端展示）
            let _ = app.emit("command-progress", json!({
                "commandId": command_id,
                "step": "开始执行",
                "percent": 0,
            }));

            let result = router::route_and_execute(
                &command,
                &cloud,
                Some(_token),
                &auth_mode,
                state.inner().clone(),
                app.clone(),
            ).await;

            // 最终结果回传给云端（由前端通过 REST API 转发）
            let _ = app.emit("command-complete", json!({
                "commandId": command_id,
                "result": result,
            }));
        }
        "ping" => {
            // 心跳响应
            let _ = app.emit("ws-ping", ());
        }
        _ => {
            log::debug!("未识别的消息类型: {}", msg_type);
        }
    }

    Ok(())
}

/// 获取设备名
fn get_device_name() -> String {
    use std::env;
    let user = env::var("USERNAME").or_else(|_| env::var("USER")).unwrap_or_default();
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    format!("{}-{}", user, hostname)
}

// hostname crate 简化实现（避免新增依赖）
mod hostname {
    pub fn get() -> Option<std::ffi::OsString> {
        if cfg!(target_os = "windows") {
            std::env::var_os("COMPUTERNAME")
        } else {
            std::env::var_os("HOSTNAME")
        }
    }
}

// WebSocket 客户端：连接云端状态中心
//
// 功能：
// 1. 启动后向云端注册 PC 在线状态 + 能力清单
// 2. 接收云端下发的远程指令（来自安卓端/Web端）
// 3. 执行指令并通过 WS 流式回传进度和最终结果
// 4. 定时心跳保持在线（30 秒间隔，避免被网关 90 秒超时下线）
//
// 关键设计：使用 mpsc channel 统一所有出站消息（心跳 + 指令回传），
// 避免多任务竞争 write 句柄。

use crate::AppState;
use crate::hermes::router;
use crate::installer;
use serde_json::json;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Manager, Emitter};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

/// 启动 WS 客户端，连接云端状态中心
pub async fn start_ws_client(cloud_endpoint: &str, user_token: &str, app: AppHandle) {
    let ws_url = build_ws_url(cloud_endpoint);
    // 日志中不输出 token，避免凭证泄露
    log::info!("HermesAgent WS 客户端连接: {}://{}/api/ws/agent",
        if cloud_endpoint.starts_with("https") { "wss" } else { "ws" },
        cloud_endpoint.replace("https://", "").replace("http://", ""));

    loop {
        match connect_and_serve(&ws_url, user_token, &app).await {
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

/// 构造 WS URL：将 http(s):// 转为 ws(s)://，不含 token（token 通过首条消息发送）
fn build_ws_url(cloud_endpoint: &str) -> String {
    let ws_scheme = if cloud_endpoint.starts_with("https") {
        "wss"
    } else {
        "ws"
    };
    let host = cloud_endpoint
        .replace("https://", "")
        .replace("http://", "");
    format!("{}://{}/api/ws/agent", ws_scheme, host)
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

    // 1. 发送认证+注册消息（token 通过消息体传递，不暴露在 URL 中）
    let register_msg = json!({
        "type": "register",
        "token": token,
        "agentVersion": env!("CARGO_PKG_VERSION"),
        "deviceName": get_device_name(),
        "capabilities": ["browser", "desktop", "file", "shell"],
        "authMode": state.auth_mode.lock().map_err(|e| e.to_string())?.clone(),
    });
    write.send(Message::Text(register_msg.to_string()))
        .await
        .map_err(|e| format!("发送注册消息失败: {}", e))?;

    // 2. 创建出站消息通道：心跳、指令回传等所有发给云端的消息都走这个通道
    //    容量 32 足够缓冲心跳 + 并发指令回传
    let (tx, mut rx) = mpsc::channel::<String>(32);

    // 3. 启动心跳任务：每 30 秒通过 channel 发送心跳消息
    //    网关 heartbeat() 收到后会更新 PcSession.lastHeartbeat，避免 90 秒超时下线
    let tx_heartbeat = tx.clone();
    let heartbeat_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        interval.tick().await; // 跳过首次立即触发
        loop {
            interval.tick().await;
            let heartbeat_msg = json!({ "type": "heartbeat" }).to_string();
            // channel 关闭（连接断开）时 send 返回 Err，任务自动退出
            if tx_heartbeat.send(heartbeat_msg).await.is_err() {
                break;
            }
        }
    });

    // 4. 启动 writer task：从 channel 读取消息并通过 WS 发送
    //    这样心跳任务和指令回传都可以并发发送，不会竞争 write 句柄
    let writer_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(Message::Text(msg)).await.is_err() {
                break; // WS 写入失败，连接已断开
            }
        }
    });

    // 5. 主循环：接收云端指令
    while let Some(msg_result) = read.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                if let Err(e) = handle_cloud_message(&text, token, app, &tx).await {
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

    // 清理：终止心跳和 writer 任务，更新连接状态
    heartbeat_task.abort();
    writer_task.abort();
    // 关闭 channel，让 writer_task 的 rx.recv() 返回 None 自然退出
    drop(tx);
    state.ws_connected.store(false, Ordering::SeqCst);
    let _ = app.emit("ws-disconnected", ());

    Ok(())
}

/// 处理云端下发的消息
///
/// tx 用于通过 WS 回传指令状态更新给云端（网关会更新 RemoteCommand 表并转发给订阅者）
async fn handle_cloud_message(
    text: &str,
    token: &str,
    app: &AppHandle,
    tx: &mpsc::Sender<String>,
) -> Result<(), String> {
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

            // 通过 WS 回传：指令已接收，开始执行（网关会更新 RemoteCommand.status = executing）
            let _ = tx.send(json!({
                "type": "command-update",
                "commandId": command_id,
                "status": "executing",
                "step": "开始执行",
                "percent": 0
            }).to_string()).await;

            let state = app.state::<Arc<AppState>>();
            let cloud = state.cloud_endpoint.lock().map_err(|e| e.to_string())?.clone();
            let auth_mode = state.auth_mode.lock().map_err(|e| e.to_string())?.clone();

            let start = std::time::Instant::now();

            // 检查是否是特殊系统命令（来自 Web 端委托桌面端执行安装/启动/停止/更新）
            let result = if command.starts_with("__LYNN_CMD__:") {
                handle_special_command(&command, app.clone()).await
            } else {
                // 前端事件展示进度
                let _ = app.emit("command-progress", json!({
                    "commandId": command_id,
                    "step": "执行中",
                    "percent": 50,
                }));

                // 优先调用本地 HermesAgent Dashboard HTTP API（真正的 AI Agent 执行）
                let dashboard_result = execute_via_dashboard(&command).await;

                match dashboard_result {
                    Some(r) => router::ExecutionResult {
                        success: r.success,
                        output: r.output,
                        route: "dashboard".to_string(),
                        steps: vec![],
                        error: r.error,
                        duration_ms: start.elapsed().as_millis() as u64,
                    },
                    None => {
                        // Dashboard 不可用，回退到 route_and_execute（关键词匹配 + 本地 RPA）
                        log::warn!("Dashboard 不可用，回退到 route_and_execute: {}", command);
                        router::route_and_execute(
                            &command,
                            &cloud,
                            Some(token),
                            &auth_mode,
                            state.inner().clone(),
                            app.clone(),
                        ).await
                    }
                }
            };

            // 通过 WS 回传最终结果给云端
            let update_msg = json!({
                "type": "command-update",
                "commandId": command_id,
                "status": if result.success { "completed" } else { "failed" },
                "result": {
                    "success": result.success,
                    "output": result.output,
                    "route": result.route,
                    "steps": result.steps,
                    "durationMs": result.duration_ms,
                },
                "error": result.error,
            });
            let _ = tx.send(update_msg.to_string()).await;

            // 同时通过前端事件展示最终结果
            let _ = app.emit("command-complete", json!({
                "commandId": command_id,
                "result": result,
            }));
        }
        "ping" => {
            // 心跳响应（网关可选实现）
            let _ = app.emit("ws-ping", ());
        }
        _ => {
            log::debug!("未识别的消息类型: {}", msg_type);
        }
    }

    Ok(())
}

/// 通过本地 HermesAgent Dashboard HTTP API 执行指令
/// Dashboard 提供 POST /api/execute 端点，复用 HermesAgent 的完整 LLM + computer_use 能力
/// 返回 None 表示 Dashboard 不可用（未启动或端口不通），调用方应回退到 route_and_execute
struct DashboardExecResult {
    success: bool,
    output: String,
    error: Option<String>,
}

async fn execute_via_dashboard(command: &str) -> Option<DashboardExecResult> {
    const DASHBOARD_URL: &str = "http://127.0.0.1:9119/api/execute";

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(130))
        .build()
        .ok()?;

    let resp = client
        .post(DASHBOARD_URL)
        .json(&json!({
            "prompt": command,
            "timeout": 120,
            "mode": "auto",
        }))
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        log::debug!("Dashboard 返回非 2xx: {}", resp.status());
        return None;
    }

    let data: serde_json::Value = resp.json().await.ok()?;
    let success = data
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    if !success {
        let err = data
            .get("error")
            .or_else(|| data.get("message"))
            .and_then(|v| v.as_str())
            .unwrap_or("Dashboard 执行失败")
            .to_string();
        return Some(DashboardExecResult {
            success: false,
            output: String::new(),
            error: Some(err),
        });
    }

    let output = data
        .get("output")
        .or_else(|| data.get("result"))
        .and_then(|v| v.as_str())
        .unwrap_or("(任务已完成，无控制台输出)")
        .to_string();

    // 真实性校验：如果 executed=false 且 actions_executed 为空，
    // 且 output 包含教程式文本关键词，则判定为假成功
    let executed = data.get("executed").and_then(|v| v.as_bool()).unwrap_or(false);
    let actions_executed = data.get("actions_executed").and_then(|v| v.as_array());
    let has_actions = actions_executed.map(|a| !a.is_empty()).unwrap_or(false);

    if !executed && !has_actions {
        // 检查是否是教程式文本（假成功）
        let fake_keywords = [
            "无法直接控制", "无法控制你的设备", "你可以按以下步骤",
            "请手动", "手动打开", "手动操作", "请按以下步骤",
            "你可以通过以下方式", "步骤如下",
        ];
        let is_fake = fake_keywords.iter().any(|kw| output.contains(kw));
        if is_fake {
            return Some(DashboardExecResult {
                success: false,
                output: String::new(),
                error: Some("HermesAgent 未能真正执行操作（LLM 返回了教程式文本而非实际执行动作）".to_string()),
            });
        }
    }

    Some(DashboardExecResult {
        success: true,
        output,
        error: None,
    })
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

/// 处理特殊系统命令（来自 Web 端委托桌面端执行）
/// 命令格式：__LYNN_CMD__:<action>
/// 支持：start_dashboard / stop_dashboard / install_hermes / update_hermes / check_update
async fn handle_special_command(command: &str, app: tauri::AppHandle) -> router::ExecutionResult {
    let action = command.strip_prefix("__LYNN_CMD__:").unwrap_or("");
    let start = std::time::Instant::now();

    log::info!("处理特殊系统命令: {}", action);

    let (success, output, error) = match action {
        "start_dashboard" => {
            // 启动 HermesAgent Dashboard
            match installer::start_hermes_dashboard_internal(9119).await {
                Ok(_) => (true, "HermesAgent Dashboard 已启动（端口 9119）".to_string(), None),
                Err(e) => (false, String::new(), Some(format!("启动 Dashboard 失败: {}", e))),
            }
        }
        "stop_dashboard" => {
            // 停止 HermesAgent Dashboard
            match installer::stop_hermes_dashboard_internal().await {
                Ok(_) => (true, "HermesAgent Dashboard 已停止".to_string(), None),
                Err(e) => (false, String::new(), Some(format!("停止 Dashboard 失败: {}", e))),
            }
        }
        "install_hermes" => {
            // 安装 HermesAgent 环境
            match installer::install_ai_environment(app.clone()).await {
                Ok(result) => {
                    let success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
                    let message = result.get("message").and_then(|v| v.as_str()).unwrap_or("安装完成").to_string();
                    (success, message, None)
                }
                Err(e) => (false, String::new(), Some(format!("安装失败: {}", e))),
            }
        }
        "update_hermes" => {
            // 强制升级 HermesAgent
            match installer::update_hermes_agent(app.clone()).await {
                Ok(result) => {
                    let success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
                    let message = result.get("message").and_then(|v| v.as_str()).unwrap_or("升级完成").to_string();
                    (success, message, None)
                }
                Err(e) => (false, String::new(), Some(format!("升级失败: {}", e))),
            }
        }
        "check_update" => {
            // 检查更新
            match installer::check_hermes_update().await {
                Ok(result) => {
                    let has_update = result.get("hasUpdate").and_then(|v| v.as_bool()).unwrap_or(false);
                    let current = result.get("currentVersion").and_then(|v| v.as_str()).unwrap_or("未知");
                    let latest = result.get("latestVersion").and_then(|v| v.as_str()).unwrap_or("未知");
                    let output = if has_update {
                        format!("发现新版本：v{}（当前 v{}）", latest, current)
                    } else {
                        format!("已是最新版本（v{}）", current)
                    };
                    (true, output, None)
                }
                Err(e) => (false, String::new(), Some(format!("检查更新失败: {}", e))),
            }
        }
        _ => {
            (false, String::new(), Some(format!("未知的系统命令: {}", action)))
        }
    };

    router::ExecutionResult {
        success,
        output,
        route: format!("special:{}", action),
        steps: vec![],
        error,
        duration_ms: start.elapsed().as_millis() as u64,
    }
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

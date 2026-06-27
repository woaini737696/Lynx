// 授权模块：三档授权模式 + 弹窗审批
//
// 权限等级：
// L1 低 - 云端数据CRUD：直接执行
// L2 中 - 本地文件读写、浏览器自动化：首次弹窗授权
// L3 高 - 系统命令执行、桌面应用RPA、删除文件：每次审批

use crate::hermes::router::LocalAction;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager, Emitter, Listener};

/// 静态变量：本次会话内 L2 是否已授权
static L2_APPROVED_THIS_SESSION: AtomicBool = AtomicBool::new(false);

/// 检查权限：根据 auth_mode 和 action 等级决定是否需要弹窗
pub async fn check_permission(
    action: &LocalAction,
    auth_mode: &str,
    app: &AppHandle,
    command: &str,
) -> bool {
    let (level, desc) = match action {
        LocalAction::FileRead | LocalAction::FileList => ("L2", "读取本地文件"),
        LocalAction::FileWrite => ("L3", "写入本地文件"),
        LocalAction::BrowserOpen | LocalAction::BrowserExtract => ("L2", "浏览器自动化"),
        LocalAction::DesktopOpenApp => ("L3", "启动本地应用"),
        LocalAction::DesktopScreenshot => ("L2", "屏幕截图"),
        LocalAction::ShellExec => ("L3", "执行系统命令"),
    };

    match auth_mode {
        // 免审批：直接通过
        "free" => true,
        // 一次性授权：L2 已授权过则免；L3 仍需首次确认
        "once" => {
            if level == "L2" {
                if L2_APPROVED_THIS_SESSION.load(Ordering::SeqCst) {
                    return true;
                }
                let approved = request_approval(app, desc, command, level).await;
                if approved {
                    L2_APPROVED_THIS_SESSION.store(true, Ordering::SeqCst);
                }
                approved
            } else {
                // L3 在 once 模式下也仅首次确认（简化）
                request_approval(app, desc, command, level).await
            }
        }
        // 弹窗审批：L2/L3 都需弹窗
        _ => request_approval(app, desc, command, level).await,
    }
}

/// 请求用户审批（通过 Tauri 事件触发前端弹窗）
///
/// 前端监听 "approval-request" 事件后弹出确认框，
/// 用户点击确认/取消后通过 "approval-response" 事件回传结果。
pub async fn request_approval(
    app: &AppHandle,
    action_desc: &str,
    command: &str,
    level: &str,
) -> bool {
    use std::sync::mpsc;
    use std::sync::Mutex;
    use std::sync::Arc;

    // 用 oneshot channel 等待前端响应
    let (tx, rx) = mpsc::channel::<bool>();
    let tx = Arc::new(Mutex::new(Some(tx)));

    let request_id = format!("approval_{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0));

    // 克隆 tx 给事件监听器
    let tx_clone = tx.clone();
    let request_id_clone = request_id.clone();

    // 监听前端响应
    let app_handle = app.clone();
    let _listener = app_handle.listen("approval-response", move |event| {
        let payload = event.payload();
        if let Ok(data) = serde_json::from_str::<serde_json::Value>(payload) {
            if data.get("requestId") == Some(&serde_json::Value::String(request_id_clone.clone())) {
                let approved = data.get("approved")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                if let Ok(mut guard) = tx_clone.lock() {
                    if let Some(sender) = guard.take() {
                        let _ = sender.send(approved);
                    }
                }
            }
        }
    });

    // 发送审批请求事件给前端
    let _ = app.emit("approval-request", serde_json::json!({
        "requestId": request_id,
        "level": level,
        "action": action_desc,
        "command": command,
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    }));

    // 等待响应（超时 60 秒视为拒绝）
    match rx.recv_timeout(Duration::from_secs(60)) {
        Ok(approved) => {
            log::info!("审批结果: {} ({} - {})", approved, level, action_desc);
            approved
        }
        Err(_) => {
            log::warn!("审批超时（60秒），视为拒绝");
            false
        }
    }
}

/// 重置会话授权（用户切换模式或手动重置时调用）
pub fn reset_session_approval() {
    L2_APPROVED_THIS_SESSION.store(false, Ordering::SeqCst);
}

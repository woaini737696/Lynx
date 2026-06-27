// Shell 命令执行
// 三档授权：approve（每次弹窗）/ once（会话内授权）/ free（仅记录）

use crate::AppState;
use crate::EMERGENCY_STOP;
use crate::auth;
use serde_json::{json, Value};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::AppHandle;

/// 执行 shell 命令
///
/// 安全策略：
/// 1. 紧急停止检查（EMERGENCY_STOP=true 时拒绝执行）
/// 2. 统一走 auth::check_permission_by_level 授权（L3 高危操作）
pub async fn execute(
    command: &str,
    cwd: Option<&str>,
    auth_mode: &str,
    state: Arc<AppState>,
    app: AppHandle,
) -> Result<Value, String> {
    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("紧急停止已触发，所有命令执行已暂停".to_string());
    }

    let approved = auth::check_permission_by_level(
        "L3",
        "执行系统命令",
        auth_mode,
        &app,
        command,
    ).await;

    if !approved {
        return Err("用户拒绝执行该命令".to_string());
    }

    let (shell, flag) = if cfg!(target_os = "windows") {
        ("cmd", "/C")
    } else {
        ("bash", "-c")
    };

    let mut cmd = tokio::process::Command::new(shell);
    cmd.arg(flag).arg(command);
    cmd.kill_on_drop(true);

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        cmd.output(),
    )
    .await
    .map_err(|_| format!("命令执行超时（60秒）: {}", command))?
    .map_err(|e| format!("命令执行失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    log::info!("Shell 执行完成: {} (exit={})", command, exit_code);

    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("执行过程中触发紧急停止，已中断".to_string());
    }

    Ok(json!({
        "command": command,
        "exitCode": exit_code,
        "stdout": stdout,
        "stderr": stderr,
        "success": exit_code == 0,
    }))
}

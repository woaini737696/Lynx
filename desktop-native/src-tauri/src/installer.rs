// 一键安装器：傻瓜式 AI 环境部署
//
// 流程：
// 1. 检测环境（Tauri 运行时、Node、agent-browser）
// 2. 创建授权目录 D:\LynnHub\user-data\
// 3. 下载并静默安装 HermesAgent（如未装）
// 4. 配置默认技能缓存
// 5. 启动本地进程并注册到云端
// 6. 全程通过事件向前端报告进度

use serde_json::json;
use tauri::{AppHandle, Emitter};

/// 安装进度事件
fn emit_progress(app: &AppHandle, step: u8, total: u8, message: &str, percent: u32) {
    let _ = app.emit("install-progress", json!({
        "step": step,
        "total": total,
        "message": message,
        "percent": percent,
    }));
}

/// 检测 AI 环境是否已安装
pub async fn detect_installation() -> Result<serde_json::Value, String> {
    let mut status = serde_json::json!({
        "tauri": true,
        "node": false,
        "agentBrowser": false,
        "hermesAgent": false,
        "authorizedDir": false,
        "ready": false,
    });

    // 检测 Node.js
    let node_check = tokio::process::Command::new("node")
        .arg("--version")
        .output()
        .await;
    if let Ok(out) = node_check {
        if out.status.success() {
            status["node"] = json!(true);
            status["nodeVersion"] = json!(String::from_utf8_lossy(&out.stdout).trim().to_string());
        }
    }

    // 检测 agent-browser
    let ab_path = if cfg!(target_os = "windows") {
        "D:\\LynnHub\\npm-global\\agent-browser.cmd"
    } else {
        "agent-browser"
    };
    if std::path::Path::new(ab_path).exists() {
        status["agentBrowser"] = json!(true);
    }

    // 检测 hermes-agent
    let hermes_check = tokio::process::Command::new("hermes")
        .arg("status")
        .output()
        .await;
    if let Ok(out) = hermes_check {
        if out.status.success() {
            status["hermesAgent"] = json!(true);
        }
    }

    // 检测授权目录
    let auth_dir = if cfg!(target_os = "windows") {
        "D:\\LynnHub\\user-data"
    } else {
        "./user-data"
    };
    if std::path::Path::new(auth_dir).exists() {
        status["authorizedDir"] = json!(true);
    }

    // 综合判断
    let ready = status["node"].as_bool().unwrap_or(false)
        && status["agentBrowser"].as_bool().unwrap_or(false)
        && status["authorizedDir"].as_bool().unwrap_or(false);
    status["ready"] = json!(ready);

    Ok(status)
}

/// 一键安装 AI 环境
pub async fn install_ai_environment(app: AppHandle) -> Result<serde_json::Value, String> {
    log::info!("开始一键安装 AI 环境...");
    let total_steps: u8 = 6;

    // Step 1: 检测当前环境
    emit_progress(&app, 1, total_steps, "正在检测系统环境...", 5);
    let detection = detect_installation().await?;

    // Step 2: 创建授权目录
    emit_progress(&app, 2, total_steps, "创建授权目录 D:\\LynnHub\\user-data\\...", 20);
    let auth_dir = if cfg!(target_os = "windows") {
        "D:\\LynnHub\\user-data"
    } else {
        "./user-data"
    };
    std::fs::create_dir_all(auth_dir).map_err(|e| format!("创建授权目录失败: {}", e))?;
    std::fs::create_dir_all(format!("{}/screenshots", auth_dir)).ok();
    std::fs::create_dir_all(format!("{}/downloads", auth_dir)).ok();
    std::fs::create_dir_all(format!("{}/reports", auth_dir)).ok();

    // Step 3: 安装 Node.js（如未装）—— 仅提示，无法自动安装
    if !detection["node"].as_bool().unwrap_or(false) {
        emit_progress(&app, 3, total_steps, "检测到未安装 Node.js，请先安装 Node.js 18+", 40);
        return Err("未检测到 Node.js，请先安装 Node.js 18+ 后再点击一键安装".to_string());
    }
    emit_progress(&app, 3, total_steps, "Node.js 已就绪", 50);

    // Step 4: 安装 agent-browser（如未装）
    if !detection["agentBrowser"].as_bool().unwrap_or(false) {
        emit_progress(&app, 4, total_steps, "正在安装 agent-browser...", 65);
        let npm_cmd = if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" };
        let npm_prefix = if cfg!(target_os = "windows") { "D:\\LynnHub\\npm-global" } else { "" };

        let mut cmd = tokio::process::Command::new(npm_cmd);
        cmd.arg("install").arg("-g").arg("agent-browser");
        if !npm_prefix.is_empty() {
            cmd.env("npm_config_prefix", npm_prefix);
        }
        cmd.kill_on_drop(true);

        let result = tokio::time::timeout(
            std::time::Duration::from_secs(180),
            cmd.output(),
        )
        .await
        .map_err(|_| "agent-browser 安装超时".to_string())?
        .map_err(|e| format!("npm 执行失败: {}", e))?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            log::warn!("agent-browser 安装失败: {}", stderr);
            // 不阻塞，继续后续步骤
        }
    }
    emit_progress(&app, 4, total_steps, "agent-browser 已就绪", 75);

    // Step 5: Hermes Agent 引擎（自研 Rust 引擎，已内置在桌面端，无需 pip 安装）
    // 历史上这里曾尝试 pip install hermes-agent，但 PyPI 上不存在该包；
    // 实际引擎实现位于 desktop-native/src-tauri/src/hermes/ 目录，随安装包一起分发
    emit_progress(&app, 5, total_steps, "Hermes Agent 引擎已内置", 90);

    // Step 6: 完成并验证
    emit_progress(&app, 6, total_steps, "验证安装结果...", 95);
    let final_check = detect_installation().await?;
    let ready = final_check["ready"].as_bool().unwrap_or(false);

    emit_progress(&app, 6, total_steps, if ready { "安装完成！" } else { "部分组件未就绪" }, 100);

    // 通知前端安装完成
    let _ = app.emit("install-complete", json!({
        "success": ready,
        "status": final_check,
    }));

    Ok(json!({
        "success": ready,
        "message": if ready { "AI 环境安装完成，可以开始使用超级助理" } else { "部分组件未就绪，请查看详细状态" },
        "status": final_check,
    }))
}

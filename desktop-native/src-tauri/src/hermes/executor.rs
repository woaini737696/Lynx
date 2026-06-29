// HermesAgent 执行器：执行云端/本地/混合指令

use super::router::{ExecutionStep, LocalAction};
use crate::AppState;
use crate::rpa;
use serde_json::json;
use std::sync::Arc;
use tauri::AppHandle;

/// 执行云端指令：通过 REST API 调用 /api/ai/chat
pub async fn execute_cloud(
    command: &str,
    cloud_endpoint: &str,
    token: Option<&str>,
    steps: &mut Vec<ExecutionStep>,
) -> (bool, String, Option<String>) {
    steps.push(ExecutionStep {
        action: "调用云端 AI 助理 API".to_string(),
        result: format!("POST {}/api/ai/chat", cloud_endpoint),
        timestamp: "".to_string(),
    });

    let client = reqwest::Client::new();
    let url = format!("{}/api/ai/chat", cloud_endpoint);

    let mut req = client.post(&url).json(&json!({
        "messages": [{"role": "user", "content": command}],
        "stream": false,
        "assistantMode": true,
        "source": "desktop",
    }));

    if let Some(t) = token {
        req = req.header("Authorization", format!("Bearer {}", t));
    }

    match req.send().await {
        Ok(resp) => {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            if status.is_success() {
                steps.push(ExecutionStep {
                    action: "云端响应".to_string(),
                    result: format!("HTTP {} ({} bytes)", status.as_u16(), body.len()),
                    timestamp: "".to_string(),
                });
                (true, body, None)
            } else {
                (false, String::new(), Some(format!("HTTP {}: {}", status.as_u16(), body)))
            }
        }
        Err(e) => (false, String::new(), Some(format!("请求失败: {}", e))),
    }
}

/// 执行本地指令：分发到对应 RPA 模块
pub async fn execute_local(
    action: LocalAction,
    command: &str,
    state: Arc<AppState>,
    app: AppHandle,
    steps: &mut Vec<ExecutionStep>,
) -> (bool, String, Option<String>) {
    match action {
        LocalAction::BrowserOpen => {
            let cloud_endpoint = state.cloud_endpoint.lock().map(|g| g.clone()).unwrap_or_else(|_| "https://ai.lynxdo.com".to_string());
            let url = extract_url(command, &cloud_endpoint).unwrap_or_else(|| "about:blank".to_string());
            match rpa::browser::open_url(&url).await {
                Ok(_) => (true, format!("已在默认浏览器打开: {}", url), None),
                Err(e) => (false, String::new(), Some(e)),
            }
        }
        LocalAction::BrowserExtract => {
            let cloud_endpoint = state.cloud_endpoint.lock().map(|g| g.clone()).unwrap_or_else(|_| "https://ai.lynxdo.com".to_string());
            let url = extract_url(command, &cloud_endpoint).unwrap_or_else(|| "about:blank".to_string());
            match rpa::browser::navigate_and_extract(&url, None).await {
                Ok(data) => (true, format!("提取数据: {}", data), None),
                Err(e) => (false, String::new(), Some(e)),
            }
        }
        LocalAction::DesktopOpenApp => {
            let app_name = extract_app_name(command).unwrap_or_else(|| "explorer".to_string());
            match rpa::desktop::open_app(&app_name).await {
                Ok(_) => (true, format!("已启动应用: {}", app_name), None),
                Err(e) => (false, String::new(), Some(e)),
            }
        }
        LocalAction::DesktopScreenshot => {
            match rpa::desktop::take_screenshot(&app).await {
                Ok(path) => (true, format!("截图已保存: {}", path), None),
                Err(e) => (false, String::new(), Some(e)),
            }
        }
        LocalAction::FileRead => {
            let path = extract_path(command).unwrap_or_default();
            let authorized = state.authorized_dirs.lock().unwrap().clone();
            match rpa::file::read_file(&path, &authorized).await {
                Ok(content) => (true, content, None),
                Err(e) => (false, String::new(), Some(e)),
            }
        }
        LocalAction::FileWrite => {
            let path = extract_path(command).unwrap_or_default();
            let content = extract_content(command).unwrap_or_default();
            let authorized = state.authorized_dirs.lock().unwrap().clone();
            match rpa::file::write_file(&path, &content, &authorized).await {
                Ok(_) => (true, format!("已写入: {}", path), None),
                Err(e) => (false, String::new(), Some(e)),
            }
        }
        LocalAction::FileList => {
            let dir = extract_path(command).unwrap_or_default();
            let authorized = state.authorized_dirs.lock().unwrap().clone();
            match rpa::file::list_dir(&dir, &authorized).await {
                Ok(items) => (true, format!("目录内容: {}", items), None),
                Err(e) => (false, String::new(), Some(e)),
            }
        }
        LocalAction::ShellExec => {
            let cmd = match extract_shell_command(command) {
                Some(c) => c,
                None => return (false, String::new(), Some("未能从指令中识别出明确的Shell命令，已拒绝执行".to_string())),
            };
            let auth_mode = state.auth_mode.lock().unwrap().clone();
            match rpa::shell::execute(&cmd, None, &auth_mode, state, app).await {
                Ok(result) => (true, format!("执行结果: {}", result), None),
                Err(e) => (false, String::new(), Some(e)),
            }
        }
    }
}

/// 执行混合指令：云端API + 本地通知
pub async fn execute_hybrid(
    command: &str,
    cloud_endpoint: &str,
    token: Option<&str>,
    steps: &mut Vec<ExecutionStep>,
) -> (bool, String, Option<String>) {
    steps.push(ExecutionStep {
        action: "混合模式: 云端API + 本地通知".to_string(),
        result: "执行中".to_string(),
        timestamp: "".to_string(),
    });

    // 1. 调用云端 API
    let cloud_result = execute_cloud(command, cloud_endpoint, token, steps).await;

    // 2. 本地通知（通过 Tauri 事件，前端监听）
    // 这里简化：仅返回云端结果，本地通知由前端监听后展示
    cloud_result
}

// ============ 指令参数提取（简易实现） ============

fn extract_url(command: &str, cloud_endpoint: &str) -> Option<String> {
    // 从指令中提取 URL（http:// 或 https://）
    let lower = command.to_lowercase();
    if let Some(start) = lower.find("http") {
        let rest = &command[start..];
        let end = rest.find(|c: char| c.is_whitespace()).unwrap_or(rest.len());
        return Some(rest[..end].to_string());
    }
    // 中文关键词映射：使用动态 cloud_endpoint 拼接，避免硬编码 localhost
    if command.contains("后台数据") {
        return Some(format!("{}/admin", cloud_endpoint));
    }
    None
}

fn extract_app_name(command: &str) -> Option<String> {
    let lower = command.to_lowercase();
    if lower.contains("excel") { return Some("excel".to_string()); }
    if lower.contains("微信") || lower.contains("wechat") { return Some("wechat".to_string()); }
    if lower.contains("记事本") || lower.contains("notepad") { return Some("notepad".to_string()); }
    if lower.contains("浏览器") || lower.contains("browser") { return Some("browser".to_string()); }
    None
}

fn extract_path(command: &str) -> Option<String> {
    // Windows 路径：D:\... 或 C:\...
    if let Some(idx) = command.find(|c: char| c.is_ascii_alphabetic() && command.as_bytes().get(command.find(c).unwrap_or(0) + 1) == Some(&b':')) {
        let rest = &command[idx..];
        let end = rest.find(|c: char| c.is_whitespace()).unwrap_or(rest.len());
        return Some(rest[..end].to_string());
    }
    None
}

fn extract_content(command: &str) -> Option<String> {
    // 提取"内容为..."后面的文本
    if let Some(idx) = command.find("内容") {
        let rest = &command[idx..];
        if let Some(colon) = rest.find(':').or_else(|| rest.find('：')) {
            return Some(rest[colon..].trim_start_matches([':', '：', ' ']).to_string());
        }
    }
    None
}

fn extract_shell_command(command: &str) -> Option<String> {
    if let Some(start) = command.find('`') {
        if let Some(end) = command[start + 1..].find('`') {
            let cmd = command[start + 1..start + 1 + end].trim().to_string();
            if !cmd.is_empty() {
                return Some(cmd);
            }
        }
    }
    if let Some(idx) = command.find("命令") {
        let rest = &command[idx..];
        if let Some(colon) = rest.find(':').or_else(|| rest.find('：')) {
            let cmd = rest[colon..].trim_start_matches([':', '：', ' ']).trim().to_string();
            if !cmd.is_empty() {
                return Some(cmd);
            }
        }
    }
    None
}

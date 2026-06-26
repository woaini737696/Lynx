// 浏览器自动化（复用 agent-browser 技能）
// 通过 Tauri shell plugin 调用默认浏览器，复杂抓取走 agent-browser CLI

use serde_json::json;

/// 在默认浏览器中打开 URL
pub async fn open_url(url: &str) -> Result<(), String> {
    // Tauri shell open 走系统默认浏览器
    // 这里通过 reqwest 触发一个本地代理（agent-browser）或者直接调用 open 命令
    let cmd = if cfg!(target_os = "windows") {
        "cmd"
    } else if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };

    let args: Vec<&str> = if cfg!(target_os = "windows") {
        vec!["/C", "start", "", url]
    } else {
        vec![url]
    };

    let status = tokio::process::Command::new(cmd)
        .args(&args)
        .kill_on_drop(true)
        .status()
        .await
        .map_err(|e| format!("启动浏览器失败: {}", e))?;

    if status.success() {
        log::info!("浏览器已打开: {}", url);
        Ok(())
    } else {
        Err(format!("浏览器打开失败，状态码: {}", status))
    }
}

/// 导航到 URL 并提取页面数据
/// 复用项目根目录下已安装的 agent-browser CLI（npm-global）
pub async fn navigate_and_extract(url: &str, selector: Option<&str>) -> Result<serde_json::Value, String> {
    // 优先调用 agent-browser CLI
    let agent_browser_path = if cfg!(target_os = "windows") {
        "D:\\LynnHub\\npm-global\\agent-browser.cmd"
    } else {
        "agent-browser"
    };

    let mut args = vec!["--url".to_string(), url.to_string(), "--extract".to_string()];
    if let Some(s) = selector {
        args.push("--selector".to_string());
        args.push(s.to_string());
    }

    let output = tokio::process::Command::new(agent_browser_path)
        .args(&args)
        .output()
        .await;

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            // 尝试解析为 JSON
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
                Ok(json)
            } else {
                Ok(json!({
                    "url": url,
                    "content": stdout,
                    "extracted": true,
                }))
            }
        }
        Ok(out) => {
            // agent-browser 不可用时降级：仅打开浏览器
            log::warn!("agent-browser 调用失败，降级为仅打开浏览器: {}", String::from_utf8_lossy(&out.stderr));
            let _ = open_url(url).await;
            Ok(json!({
                "url": url,
                "content": "(降级模式：已打开浏览器，未自动提取数据)",
                "extracted": false,
                "fallback": true,
            }))
        }
        Err(e) => {
            log::warn!("agent-browser 不存在: {}, 降级为仅打开浏览器", e);
            let _ = open_url(url).await;
            Ok(json!({
                "url": url,
                "content": "(降级模式：已打开浏览器，未自动提取数据)",
                "extracted": false,
                "fallback": true,
                "error": e.to_string(),
            }))
        }
    }
}

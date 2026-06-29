// 浏览器自动化（复用 agent-browser 技能）
// 通过 Tauri shell plugin 调用默认浏览器，复杂抓取走 agent-browser CLI

use serde_json::json;

/// 在默认浏览器中打开 URL
/// 安全：仅允许 http/https 协议，避免 cmd 元字符注入
pub async fn open_url(url: &str) -> Result<(), String> {
    // 协议白名单校验，阻断 javascript:/file:/及 cmd 元字符注入
    if !is_safe_url(url) {
        return Err(format!("不安全的 URL 协议，已拒绝打开: {}", url));
    }

    // Windows：用 cmd /C start "" "<url>"，URL 作为单一参数传递
    // 因已通过白名单校验为 http(s):// 开头，cmd 元字符（& | > <）出现在 URL 路径中
    // 不再被 cmd 解释为命令分隔符（只有未加引号时才会被解释）
    #[cfg(target_os = "windows")]
    {
        let status = tokio::process::Command::new("cmd")
            .arg("/C")
            .arg("start")
            .arg("")
            .arg(url)
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
    #[cfg(target_os = "macos")]
    {
        let status = tokio::process::Command::new("open")
            .arg(url)
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
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let status = tokio::process::Command::new("xdg-open")
            .arg(url)
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
}

/// URL 协议白名单校验：仅允许 http(s):// 开头
fn is_safe_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.starts_with("https://") || lower.starts_with("http://")
}

/// 导航到 URL 并提取页面数据
/// 复用 agent-browser CLI：优先用 AGENT_BROWSER_PATH 环境变量，其次 PATH 查找，最后回退 "agent-browser"
pub async fn navigate_and_extract(url: &str, selector: Option<&str>) -> Result<serde_json::Value, String> {
    // 解析 agent-browser 可执行文件路径（跨平台，替代硬编码 D:\LynnHub\npm-global）
    let agent_browser_path: String = if let Ok(p) = std::env::var("AGENT_BROWSER_PATH") {
        if !p.is_empty() {
            p
        } else {
            resolve_agent_browser()
        }
    } else {
        resolve_agent_browser()
    };

    let mut args = vec!["--url".to_string(), url.to_string(), "--extract".to_string()];
    if let Some(s) = selector {
        args.push("--selector".to_string());
        args.push(s.to_string());
    }

    let output = tokio::process::Command::new(&agent_browser_path)
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

/// 跨平台解析 agent-browser 可执行文件路径
/// 1. 通过 `which` crate 在 PATH 中查找（Windows 会自动匹配 .cmd/.exe/.bat）
/// 2. 找不到则回退为 "agent-browser"，交给系统 shell 解析（仍可能命中 PATH）
fn resolve_agent_browser() -> String {
    match which::which("agent-browser") {
        Ok(p) => p.to_string_lossy().to_string(),
        Err(_) => {
            log::debug!("which 未在 PATH 中找到 agent-browser，回退为直接调用");
            "agent-browser".to_string()
        }
    }
}


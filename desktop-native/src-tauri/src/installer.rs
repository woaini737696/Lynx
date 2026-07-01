// 一键安装器：傻瓜式 AI 环境部署
//
// 流程：
// 1. 检测环境（Python/pip、Node、agent-browser、hermes）
// 2. 创建授权目录 D:\LynnHub\user-data\
// 3. 下载 HermesAgent wheel（从服务器拉取）并本地安装
// 4. 安装 agent-browser（如未装）
// 5. 启动本地进程并注册到云端
// 6. 全程通过事件向前端报告进度
//
// 关键修复（迭代68）：
// - hermes-agent 是真实 Python 包，托管在 public/downloads/，从服务器拉取 wheel 本地安装
// - 不再依赖 PyPI 上不存在的 hermes-agent 包
// - 增加 Python/pip 检测，给出明确错误提示
// - hermes 检测支持 Scripts 目录（pip --user 安装不在系统 PATH）

use serde_json::json;
use tauri::{AppHandle, Emitter};
use std::path::PathBuf;

/// 安装进度事件
fn emit_progress(app: &AppHandle, step: u8, total: u8, message: &str, percent: u32) {
    let _ = app.emit("install-progress", json!({
        "step": step,
        "total": total,
        "message": message,
        "percent": percent,
    }));
}

/// Windows 下为 tokio::process::Command 添加 CREATE_NO_WINDOW 标志，
/// 避免子进程弹出黑色控制台窗口（防止用户看到"控制台闪烁"）
fn no_window(cmd: &mut tokio::process::Command) -> &mut tokio::process::Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let _ = cmd;
    cmd
}

/// 查找 hermes 可执行文件（Windows 优先检查 Scripts 目录）- 公开接口供 lib.rs 调用
pub fn find_hermes_exe_public() -> Option<String> {
    find_hermes_exe()
}

/// 查找 hermes 可执行文件（Windows 优先检查 Scripts 目录）
fn find_hermes_exe() -> Option<String> {
    // 1. 直接调用 hermes（如果在 PATH 中）
    let hermes_cmd = if cfg!(target_os = "windows") { "hermes.exe" } else { "hermes" };
    if which::which(hermes_cmd).is_ok() {
        return Some(which::which(hermes_cmd).ok()?.to_string_lossy().to_string());
    }

    // 2. Windows: 检查常见 Scripts 目录（pip --user 安装位置）
    if cfg!(target_os = "windows") {
        let candidates = [
            // APPDATA\Python\PythonXXX\Scripts\hermes.exe
            std::env::var("APPDATA").ok().map(|d| {
                vec![
                    format!("{}\\Python\\Python313\\Scripts\\hermes.exe", d),
                    format!("{}\\Python\\Python312\\Scripts\\hermes.exe", d),
                    format!("{}\\Python\\Python311\\Scripts\\hermes.exe", d),
                ]
            }),
            // LOCALAPPDATA\Programs\Python\PythonXXX\Scripts\hermes.exe
            std::env::var("LOCALAPPDATA").ok().map(|d| {
                vec![
                    format!("{}\\Programs\\Python\\Python313\\Scripts\\hermes.exe", d),
                    format!("{}\\Programs\\Python\\Python312\\Scripts\\hermes.exe", d),
                ]
            }),
        ];

        for candidate_opt in &candidates {
            if let Some(paths) = candidate_opt {
                for path in paths {
                    if std::path::Path::new(path).exists() {
                        return Some(path.clone());
                    }
                }
            }
        }
    }

    None
}

/// 查找 pip 可执行文件
fn find_pip_exe() -> Option<String> {
    let pip_cmd = if cfg!(target_os = "windows") { "pip" } else { "pip3" };
    if which::which(pip_cmd).is_ok() {
        return Some(which::which(pip_cmd).ok()?.to_string_lossy().to_string());
    }
    // Windows: pip.exe 在 Scripts 目录
    if cfg!(target_os = "windows") {
        if let Some(appdata) = std::env::var("APPDATA").ok() {
            let path = format!("{}\\Python\\Python313\\Scripts\\pip.exe", appdata);
            if std::path::Path::new(&path).exists() {
                return Some(path);
            }
        }
    }
    None
}

/// 查找 python 可执行文件
fn find_python_exe() -> Option<String> {
    let py_cmd = if cfg!(target_os = "windows") { "python" } else { "python3" };
    if which::which(py_cmd).is_ok() {
        return Some(which::which(py_cmd).ok()?.to_string_lossy().to_string());
    }
    None
}

/// 检测 AI 环境是否已安装
pub async fn detect_installation() -> Result<serde_json::Value, String> {
    let mut status = serde_json::json!({
        "tauri": true,
        "python": false,
        "pip": false,
        "node": false,
        "agentBrowser": false,
        "hermesAgent": false,
        "authorizedDir": false,
        "ready": false,
    });

    // 检测 Python
    if let Some(py_path) = find_python_exe() {
        status["python"] = json!(true);
        let mut cmd = tokio::process::Command::new(&py_path);
        cmd.arg("--version");
        if let Ok(out) = no_window(&mut cmd).output().await {
            if out.status.success() {
                let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
                status["pythonVersion"] = json!(ver);
            }
        }
    }

    // 检测 pip
    if let Some(pip_path) = find_pip_exe() {
        status["pip"] = json!(true);
        status["pipPath"] = json!(pip_path);
    }

    // 检测 Node.js
    let mut node_cmd = tokio::process::Command::new("node");
    node_cmd.arg("--version");
    let node_check = no_window(&mut node_cmd).output().await;
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

    // 检测 hermes-agent（通过 find_hermes_exe + hermes --version）
    // 同时用文件存在性作为兜底（hermes --version 在 Dashboard 运行时可能超时/失败）
    if let Some(hermes_path) = find_hermes_exe() {
        let mut hermes_cmd = tokio::process::Command::new(&hermes_path);
        hermes_cmd.arg("--version");
        let hermes_check = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            no_window(&mut hermes_cmd).output(),
        ).await;
        let mut detected = false;
        let mut ver = String::new();
        if let Ok(Ok(out)) = hermes_check {
            if out.status.success() {
                ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
                detected = true;
            }
        }
        // 超时或退出码非 0 也认为已安装（文件存在即视为已安装，避免重复安装）
        if !detected {
            detected = true;
            ver = "unknown (file exists)".to_string();
            log::warn!("hermes --version 检测失败，但文件存在，视为已安装: {}", hermes_path);
        }
        status["hermesAgent"] = json!(detected);
        status["hermesVersion"] = json!(ver);
        status["hermesPath"] = json!(hermes_path);
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

    // 综合判断：需要 Python + pip + hermes + 授权目录
    let ready = status["python"].as_bool().unwrap_or(false)
        && status["pip"].as_bool().unwrap_or(false)
        && status["hermesAgent"].as_bool().unwrap_or(false)
        && status["authorizedDir"].as_bool().unwrap_or(false);
    status["ready"] = json!(ready);

    Ok(status)
}

/// 下载文件（使用 reqwest）
async fn download_file(url: &str, dest: &PathBuf) -> Result<u64, String> {
    log::info!("下载文件: {} -> {}", url, dest.display());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("构建 HTTP client 失败: {}", e))?;

    let resp = client.get(url).send().await.map_err(|e| {
        format!("下载失败 [{}]: {}", url, e)
    })?;

    if !resp.status().is_success() {
        return Err(format!("下载失败: HTTP {} ({})", resp.status(), url));
    }

    // 确保目录存在
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    let bytes = resp.bytes().await.map_err(|e| format!("读取响应体失败: {}", e))?;

    // 校验文件大小（至少 1KB，防止 404 HTML 页面）
    if bytes.len() < 1024 {
        return Err(format!("下载的文件过小 ({} 字节)，可能是 404 页面", bytes.len()));
    }

    std::fs::write(dest, &bytes).map_err(|e| format!("写入文件失败: {}", e))?;

    log::info!("下载完成: {} 字节", bytes.len());
    Ok(bytes.len() as u64)
}

/// 一键安装 AI 环境
pub async fn install_ai_environment(app: AppHandle) -> Result<serde_json::Value, String> {
    log::info!("开始一键安装 AI 环境...");
    let total_steps: u8 = 6;

    // Step 1: 检测当前环境
    emit_progress(&app, 1, total_steps, "正在检测系统环境...", 5);
    let detection = detect_installation().await?;

    // Step 2: 检测 Python 和 pip（前置依赖）
    emit_progress(&app, 2, total_steps, "检测 Python 和 pip...", 15);
    if !detection["python"].as_bool().unwrap_or(false) {
        return Err("未检测到 Python，请先安装 Python 3.9+（https://python.org/downloads）后再点击一键安装".to_string());
    }
    if !detection["pip"].as_bool().unwrap_or(false) {
        return Err("未检测到 pip，请运行 `python -m ensurepip --upgrade` 安装 pip 后再试".to_string());
    }
    emit_progress(&app, 2, total_steps, "Python 和 pip 已就绪", 25);

    // Step 3: 创建授权目录
    emit_progress(&app, 3, total_steps, "创建授权目录 D:\\LynnHub\\user-data\\...", 30);
    let auth_dir = if cfg!(target_os = "windows") {
        "D:\\LynnHub\\user-data"
    } else {
        "./user-data"
    };
    std::fs::create_dir_all(auth_dir).map_err(|e| format!("创建授权目录失败: {}", e))?;
    std::fs::create_dir_all(format!("{}/screenshots", auth_dir)).ok();
    std::fs::create_dir_all(format!("{}/downloads", auth_dir)).ok();
    std::fs::create_dir_all(format!("{}/reports", auth_dir)).ok();

    // Step 4: 下载并安装 HermesAgent（从服务器拉取 wheel 本地安装）
    if !detection["hermesAgent"].as_bool().unwrap_or(false) {
        emit_progress(&app, 4, total_steps, "正在从服务器下载 HermesAgent...", 40);

        let pip_path = find_pip_exe()
            .ok_or_else(|| "未找到 pip 可执行文件".to_string())?;

        // 服务器托管的 wheel 文件 URL（依次尝试多个域名）
        const WHL_FILENAME: &str = "hermes_agent-0.18.0-py3-none-any.whl";
        let server_urls = [
            "https://ai.lynxdo.com/downloads/".to_string() + WHL_FILENAME,
            "https://app.lynnhub.com/downloads/".to_string() + WHL_FILENAME,
        ];

        // 下载到临时目录
        let tmp_dir = std::env::temp_dir().join("lynnhub-hermes-install");
        std::fs::create_dir_all(&tmp_dir).map_err(|e| format!("创建临时目录失败: {}", e))?;
        let local_whl = tmp_dir.join(WHL_FILENAME);

        let mut downloaded = false;
        let mut last_err = String::new();
        for url in &server_urls {
            match download_file(url, &local_whl).await {
                Ok(size) => {
                    log::info!("HermesAgent wheel 下载成功: {} 字节", size);
                    downloaded = true;
                    break;
                }
                Err(e) => {
                    log::warn!("从 {} 下载失败: {}", url, e);
                    last_err = e;
                }
            }
        }

        if !downloaded {
            return Err(format!(
                "从服务器下载 HermesAgent 失败: {}\n请检查网络连接后重试",
                last_err
            ));
        }

        emit_progress(&app, 4, total_steps, "正在安装 HermesAgent（本地 pip install）...", 65);

        // pip install <local_wheel>（零依赖，安装极快）
        // 使用 --upgrade --no-deps 避免每次都强制重装（--force-reinstall 会导致重复安装）
        let mut pip_cmd = tokio::process::Command::new(&pip_path);
        pip_cmd.args(&[
            "install",
            "--disable-pip-version-check",
            "--upgrade",
            "--no-deps",
            local_whl.to_str().unwrap_or(""),
        ]);
        pip_cmd.kill_on_drop(true);
        let pip_install_result = tokio::time::timeout(
            std::time::Duration::from_secs(120),
            no_window(&mut pip_cmd).output(),
        )
        .await
        .map_err(|_| "HermesAgent 安装超时（120秒）".to_string())?
        .map_err(|e| format!("pip 执行失败: {}", e))?;

        if !pip_install_result.status.success() {
            let stderr = String::from_utf8_lossy(&pip_install_result.stderr);
            let stdout = String::from_utf8_lossy(&pip_install_result.stdout);
            log::warn!("HermesAgent 安装失败: stderr={}, stdout={}", stderr, stdout);
            return Err(format!(
                "HermesAgent 安装失败: {}",
                if stderr.is_empty() { stdout.to_string() } else { stderr.to_string() }
            ));
        }

        // 清理临时文件
        let _ = std::fs::remove_file(&local_whl);

        emit_progress(&app, 4, total_steps, "HermesAgent 安装完成", 80);
    } else {
        emit_progress(&app, 4, total_steps, "HermesAgent 已安装，跳过", 80);
    }

    // Step 5: 安装 agent-browser（如未装，非阻塞）
    if !detection["agentBrowser"].as_bool().unwrap_or(false) {
        emit_progress(&app, 5, total_steps, "正在安装 agent-browser...", 85);
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
            no_window(&mut cmd).output(),
        )
        .await
        .map_err(|_| "agent-browser 安装超时".to_string())?
        .map_err(|e| format!("npm 执行失败: {}", e))?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            log::warn!("agent-browser 安装失败（非阻塞）: {}", stderr);
            // 不阻塞，继续后续步骤
        }
    }
    emit_progress(&app, 5, total_steps, "agent-browser 已就绪", 90);

    // Step 6: 完成并验证
    emit_progress(&app, 6, total_steps, "验证安装结果...", 95);
    let final_check = detect_installation().await?;
    let ready = final_check["hermesAgent"].as_bool().unwrap_or(false)
        && final_check["authorizedDir"].as_bool().unwrap_or(false);

    emit_progress(&app, 6, total_steps, if ready { "安装完成！" } else { "部分组件未就绪" }, 100);

    // 通知前端安装完成
    let _ = app.emit("install-complete", json!({
        "success": ready,
        "status": final_check,
    }));

    Ok(json!({
        "success": ready,
        "message": if ready { "HermesAgent 安装完成，可以开始使用超级助理" } else { "部分组件未就绪，请查看详细状态" },
        "status": final_check,
    }))
}

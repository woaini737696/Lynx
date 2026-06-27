// LynnHub 桌面端核心库
// 集成 HermesAgent 本地超级助理 + 四类RPA能力 + 三档授权模式

pub mod hermes;
pub mod rpa;
pub mod auth;
pub mod installer;
pub mod ws_client;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{Manager, Emitter, Listener};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_updater::UpdaterExt;
use std::thread;

// ============ 全局状态 ============

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

/// 紧急停止标志：true 时立即终止所有正在执行的本地操作
pub static EMERGENCY_STOP: AtomicBool = AtomicBool::new(false);

/// 当前授权模式（运行时可切换）
/// "approve" = 弹窗审批（默认）
/// "once" = 一次性授权
/// "free" = 免审批仅记录
pub struct AppState {
    pub auth_mode: Mutex<String>,
    pub authorized_dirs: Mutex<Vec<String>>,
    pub ws_connected: AtomicBool,
    pub user_token: Mutex<Option<String>>,
    pub cloud_endpoint: Mutex<String>,
}

impl Default for AppState {
    fn default() -> Self {
        // 默认授权目录：跨平台 app data 目录下的 LynnHub/user-data
        // （Windows: %APPDATA%\LynnHub\user-data，macOS: ~/Library/Application Support/LynnHub/user-data，Linux: ~/.local/share/LynnHub/user-data）
        // 在 Tauri setup 阶段可用 app.path().app_data_dir()，但 Default 在 Builder 之前执行，
        // 因此这里用 dirs crate 提供等价路径，避免硬编码 D:\LynnHub
        let default_dir = dirs::data_dir()
            .map(|d| d.join("LynnHub").join("user-data").to_string_lossy().to_string())
            .unwrap_or_else(|| "./user-data".to_string());

        // 确保默认授权目录存在
        let _ = std::fs::create_dir_all(&default_dir);

        Self {
            auth_mode: Mutex::new("approve".to_string()),
            authorized_dirs: Mutex::new(vec![default_dir]),
            ws_connected: AtomicBool::new(false),
            user_token: Mutex::new(None),
            cloud_endpoint: Mutex::new("http://localhost:5176".to_string()),
        }
    }
}

// ============ Tauri Command 定义 ============

/// 设置授权模式
#[derive(Serialize, Deserialize)]
pub struct AuthModePayload {
    pub mode: String, // approve | once | free
}

#[tauri::command]
fn set_auth_mode(state: tauri::State<Arc<AppState>>, payload: AuthModePayload) -> Result<String, String> {
    let mode = match payload.mode.as_str() {
        "approve" | "once" | "free" => payload.mode.clone(),
        _ => return Err("无效的授权模式，必须为 approve/once/free".to_string()),
    };
    *state.auth_mode.lock().map_err(|e| e.to_string())? = mode.clone();
    log::info!("授权模式已切换为: {}", mode);
    Ok(mode)
}

/// 获取当前授权模式
#[tauri::command]
fn get_auth_mode(state: tauri::State<Arc<AppState>>) -> String {
    state.auth_mode.lock().map(|m| m.clone()).unwrap_or_else(|_| "approve".to_string())
}

/// 添加授权目录
#[tauri::command]
fn add_authorized_dir(state: tauri::State<Arc<AppState>>, dir: String) -> Result<Vec<String>, String> {
    let path = std::path::Path::new(&dir);
    if !path.exists() {
        return Err(format!("目录不存在: {}", dir));
    }
    let mut dirs = state.authorized_dirs.lock().map_err(|e| e.to_string())?;
    if !dirs.contains(&dir) {
        dirs.push(dir.clone());
        log::info!("新增授权目录: {}", dir);
    }
    Ok(dirs.clone())
}

/// 获取授权目录列表
#[tauri::command]
fn get_authorized_dirs(state: tauri::State<Arc<AppState>>) -> Vec<String> {
    state.authorized_dirs.lock().map(|d| d.clone()).unwrap_or_default()
}

/// 移除授权目录
#[tauri::command]
fn remove_authorized_dir(state: tauri::State<Arc<AppState>>, dir: String) -> Result<Vec<String>, String> {
    let mut dirs = state.authorized_dirs.lock().map_err(|e| e.to_string())?;
    dirs.retain(|d| d != &dir);
    log::info!("移除授权目录: {}", dir);
    Ok(dirs.clone())
}

/// 紧急停止：立即终止所有本地操作
#[tauri::command]
fn emergency_stop() -> String {
    EMERGENCY_STOP.store(true, Ordering::SeqCst);
    log::warn!("已触发紧急停止，所有本地操作将被终止");
    // 5秒后自动重置（让正在执行的命令检测到停止信号）
    thread::spawn(|| {
        thread::sleep(std::time::Duration::from_secs(5));
        EMERGENCY_STOP.store(false, Ordering::SeqCst);
        log::info!("紧急停止已重置");
    });
    "已触发紧急停止".to_string()
}

/// 检查紧急停止状态
#[tauri::command]
fn is_emergency_stop() -> bool {
    EMERGENCY_STOP.load(Ordering::SeqCst)
}

/// 设置用户 Token（登录后调用）
#[tauri::command]
fn set_user_token(state: tauri::State<Arc<AppState>>, token: String) -> Result<(), String> {
    *state.user_token.lock().map_err(|e| e.to_string())? = Some(token);
    Ok(())
}

/// 设置云端 endpoint
#[tauri::command]
fn set_cloud_endpoint(state: tauri::State<Arc<AppState>>, endpoint: String) -> Result<(), String> {
    *state.cloud_endpoint.lock().map_err(|e| e.to_string())? = endpoint;
    Ok(())
}

/// 获取 HermesAgent 状态（在线/离线/版本/能力清单）
#[tauri::command]
async fn get_agent_status(state: tauri::State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    let cloud = state.cloud_endpoint.lock().map_err(|e| e.to_string())?.clone();
    let token = state.user_token.lock().map_err(|e| e.to_string())?.clone();

    let ws_connected = state.ws_connected.load(Ordering::SeqCst);
    let auth_mode = state.auth_mode.lock().map_err(|e| e.to_string())?.clone();
    let authorized_dirs = state.authorized_dirs.lock().map_err(|e| e.to_string())?.clone();

    Ok(serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "wsConnected": ws_connected,
        "cloudEndpoint": cloud,
        "authMode": auth_mode,
        "authorizedDirs": authorized_dirs,
        "capabilities": ["browser", "desktop", "file", "shell"],
        "hasToken": token.is_some(),
    }))
}

/// 执行 AI 助理指令（核心入口：路由到云端/本地/混合）
#[tauri::command]
async fn execute_assistant_command(
    state: tauri::State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
    command: String,
    target_device: Option<String>,
) -> Result<serde_json::Value, String> {
    let token = state.user_token.lock().map_err(|e| e.to_string())?.clone();
    let cloud = state.cloud_endpoint.lock().map_err(|e| e.to_string())?.clone();
    let auth_mode = state.auth_mode.lock().map_err(|e| e.to_string())?.clone();

    let result = hermes::router::route_and_execute(
        &command,
        &cloud,
        token.as_deref(),
        &auth_mode,
        state.inner().clone(),
        app.clone(),
    ).await;

    Ok(serde_json::to_value(&result).map_err(|e| e.to_string())?)
}

/// 浏览器自动化：打开URL
#[tauri::command]
async fn rpa_browser_open(url: String) -> Result<(), String> {
    rpa::browser::open_url(&url).await
}

/// 浏览器自动化：导航 + 提取数据
#[tauri::command]
async fn rpa_browser_extract(url: String, selector: Option<String>) -> Result<serde_json::Value, String> {
    rpa::browser::navigate_and_extract(&url, selector.as_deref()).await
}

/// 桌面 RPA：启动应用
#[tauri::command]
async fn rpa_desktop_open_app(app_name: String) -> Result<(), String> {
    rpa::desktop::open_app(&app_name).await
}

/// 桌面 RPA：截图
#[tauri::command]
async fn rpa_desktop_screenshot(app: tauri::AppHandle) -> Result<String, String> {
    rpa::desktop::take_screenshot(&app).await
}

/// 文件操作：读取授权目录内文件
#[tauri::command]
async fn rpa_file_read(state: tauri::State<'_, Arc<AppState>>, path: String) -> Result<String, String> {
    let authorized = state.authorized_dirs.lock().map_err(|e| e.to_string())?.clone();
    rpa::file::read_file(&path, &authorized).await
}

/// 文件操作：写入授权目录
#[tauri::command]
async fn rpa_file_write(state: tauri::State<'_, Arc<AppState>>, path: String, content: String) -> Result<(), String> {
    let authorized = state.authorized_dirs.lock().map_err(|e| e.to_string())?.clone();
    rpa::file::write_file(&path, &content, &authorized).await
}

/// 文件操作：列目录
#[tauri::command]
async fn rpa_file_list(state: tauri::State<'_, Arc<AppState>>, dir: String) -> Result<serde_json::Value, String> {
    let authorized = state.authorized_dirs.lock().map_err(|e| e.to_string())?.clone();
    rpa::file::list_dir(&dir, &authorized).await
}

/// Shell 命令执行
#[tauri::command]
async fn rpa_shell_exec(
    state: tauri::State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
    command: String,
    cwd: Option<String>,
) -> Result<serde_json::Value, String> {
    let auth_mode = state.auth_mode.lock().map_err(|e| e.to_string())?.clone();
    rpa::shell::execute(&command, cwd.as_deref(), &auth_mode, state.inner().clone(), app.clone()).await
}

/// 一键安装 AI 环境
#[tauri::command]
async fn install_ai_env(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    installer::install_ai_environment(app).await
}

/// 检测 AI 环境是否已安装
#[tauri::command]
async fn detect_ai_env() -> Result<serde_json::Value, String> {
    installer::detect_installation().await
}

/// 启动 HermesAgent 本地进程（连接云端WS）
#[tauri::command]
async fn start_hermes_agent(
    state: tauri::State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let cloud = state.cloud_endpoint.lock().map_err(|e| e.to_string())?.clone();
    let token = state.user_token.lock().map_err(|e| e.to_string())?.clone();

    if token.is_none() {
        return Err("未登录，请先登录后再启动 HermesAgent".to_string());
    }

    let app_handle = app.clone();
    let cloud_url = cloud.clone();
    let user_token = token.unwrap();

    // 后台线程维护 WS 连接
    thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("创建 tokio runtime 失败");
        rt.block_on(async {
            ws_client::start_ws_client(&cloud_url, &user_token, app_handle).await;
        });
    });

    Ok(())
}

/// 打开外部链接（默认浏览器）
#[tauri::command]
async fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.shell().open(url, None).map_err(|e| e.to_string())
}

/// 导航当前窗口到指定 URL（用于加载本地 Web 端）
#[tauri::command]
async fn navigate_to_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    log::info!("导航到: {}", url);
    if let Some(window) = app.get_webview_window("main") {
        // Tauri 2.x WebviewWindow 没有 set_url，使用 eval 执行 JS 导航
        let js = format!("window.location.href = '{}';", url.replace('\'', "\\'"));
        window.eval(&js).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("找不到主窗口".to_string())
    }
}

/// 检查本地服务器是否在线（TCP 连接检测）
#[tauri::command]
async fn check_local_server(host: String, port: u16) -> Result<bool, String> {
    let addr = format!("{}:{}", host, port);
    log::info!("检测本地服务器: {}", addr);

    // 使用 std::net::TcpStream 检测端口是否可连接
    let result = tokio::task::spawn_blocking(move || {
        use std::net::TcpStream;
        use std::time::Duration;
        match addr.parse() {
            Ok(socket_addr) => {
                TcpStream::connect_timeout(&socket_addr, Duration::from_secs(2)).is_ok()
            }
            Err(_) => false,
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(result)
}

/// 检查桌面端更新（通过 tauri-plugin-updater 查询配置的 endpoint）
/// 返回 true 表示有可用更新，false 表示已是最新
#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<bool, String> {
    log::info!("开始检查桌面端更新...");
    let updater = app
        .updater()
        .map_err(|e| format!("初始化 updater 失败: {}", e))?;
    match updater.check().await {
        Ok(Some(update)) => {
            log::info!(
                "发现新版本: {} (当前 {}), 更新说明: {}",
                update.version,
                update.current_version,
                update.body.as_deref().unwrap_or("(无)")
            );
            // 通知前端有更新可用，前端可弹窗引导用户下载
            let date_str = update
                .date
                .map(|d| d.to_string())
                .unwrap_or_default();
            let _ = app.emit(
                "update-available",
                serde_json::json!({
                    "version": update.version,
                    "currentVersion": update.current_version,
                    "notes": update.body,
                    "date": date_str,
                }),
            );
            Ok(true)
        }
        Ok(None) => {
            log::info!("已是最新版本，无需更新");
            Ok(false)
        }
        Err(e) => {
            log::warn!("检查更新失败: {}", e);
            // 检查失败不阻断流程，返回 false 并记录日志
            Ok(false)
        }
    }
}

// ============ 应用主入口 ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_secs()
        .init();

    log::info!("LynnHub 桌面端启动中...");

    let app_state = Arc::new(AppState::default());

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 关闭按钮最小化到托盘而非退出
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_auth_mode,
            get_auth_mode,
            add_authorized_dir,
            get_authorized_dirs,
            remove_authorized_dir,
            emergency_stop,
            is_emergency_stop,
            set_user_token,
            set_cloud_endpoint,
            get_agent_status,
            execute_assistant_command,
            rpa_browser_open,
            rpa_browser_extract,
            rpa_desktop_open_app,
            rpa_desktop_screenshot,
            rpa_file_read,
            rpa_file_write,
            rpa_file_list,
            rpa_shell_exec,
            install_ai_env,
            detect_ai_env,
            start_hermes_agent,
            open_external,
            navigate_to_url,
            check_local_server,
            check_for_updates,
        ])
        .setup(|app| {
            log::info!("LynnHub 桌面端启动完成");

            // ============ 系统托盘（Tauri 2.x API） ============
            let app_handle = app.handle().clone();
            let quit_item = MenuItem::with_id(&app_handle, "quit", "退出 LynnHub", true, None::<&str>)?;
            let emergency_item = MenuItem::with_id(&app_handle, "emergency", "🛑 紧急停止", true, None::<&str>)?;
            let show_item = MenuItem::with_id(&app_handle, "show", "显示主窗口", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(&app_handle)?;

            let tray_menu = Menu::with_items(&app_handle, &[&show_item, &emergency_item, &separator, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .menu(&tray_menu)
                .tooltip("LynnHub HermesAgent")
                .icon(app.default_window_icon().cloned().unwrap())
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "quit" => {
                            log::info!("用户通过托盘退出");
                            app.exit(0);
                        }
                        "emergency" => {
                            EMERGENCY_STOP.store(true, Ordering::SeqCst);
                            log::warn!("托盘触发紧急停止");
                            let app_clone = app.clone();
                            thread::spawn(move || {
                                thread::sleep(std::time::Duration::from_secs(5));
                                EMERGENCY_STOP.store(false, Ordering::SeqCst);
                                let _ = app_clone.emit("emergency-reset", ());
                            });
                            let _ = app.emit("emergency-stop", ());
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 启动时自动检查更新（延迟 5 秒，避免与启动流程竞争）
            let app_handle2 = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                log::info!("开始检查更新...");
                let _ = app_handle2.emit("app-started", ());
                // 实际调用 updater 检查（失败不阻断，结果通过 update-available 事件下发）
                match app_handle2.updater() {
                    Ok(updater) => match updater.check().await {
                        Ok(Some(update)) => {
                            log::info!(
                                "发现新版本: {} (当前 {})",
                                update.version,
                                update.current_version
                            );
                            let date_str = update
                                .date
                                .map(|d| d.to_string())
                                .unwrap_or_default();
                            let _ = app_handle2.emit(
                                "update-available",
                                serde_json::json!({
                                    "version": update.version,
                                    "currentVersion": update.current_version,
                                    "notes": update.body,
                                    "date": date_str,
                                }),
                            );
                        }
                        Ok(None) => log::info!("已是最新版本"),
                        Err(e) => log::warn!("启动检查更新失败: {}", e),
                    },
                    Err(e) => log::warn!("updater 初始化失败: {}", e),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

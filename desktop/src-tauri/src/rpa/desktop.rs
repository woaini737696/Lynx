// 桌面应用 RPA 操作（启动应用、截图、模拟键鼠）
// 集成 enigo（键鼠模拟）+ screenshots（截图）

use tauri::Manager;
use crate::EMERGENCY_STOP;
use std::sync::atomic::Ordering;

/// 启动本地应用
///
/// 安全策略：执行前检查紧急停止标志，若已触发则拒绝执行。
pub async fn open_app(app_name: &str) -> Result<(), String> {
    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("紧急停止已触发，桌面应用启动已暂停".to_string());
    }

    let (cmd, args) = match app_name.to_lowercase().as_str() {
        "excel" => ("cmd", vec!["/C", "start", "excel"]),
        "wechat" | "微信" => ("cmd", vec!["/C", "start", "WeChat"]),
        "notepad" | "记事本" => ("cmd", vec!["/C", "start", "notepad"]),
        "browser" | "浏览器" => ("cmd", vec!["/C", "start", "chrome"]),
        "explorer" | "文件管理器" => ("cmd", vec!["/C", "start", "explorer"]),
        "calculator" | "计算器" => ("cmd", vec!["/C", "start", "calc"]),
        _ => {
            // 通用：尝试直接 start app_name
            ("cmd", vec!["/C", "start", app_name])
        }
    };

    let status = tokio::process::Command::new(cmd)
        .args(&args)
        .kill_on_drop(true)
        .status()
        .await
        .map_err(|e| format!("启动应用失败: {}", e))?;

    if status.success() {
        log::info!("应用已启动: {}", app_name);
        Ok(())
    } else {
        Err(format!("应用启动失败，状态码: {}", status))
    }
}

/// PowerShell 单引号字符串转义
/// 
/// PowerShell 单引号字符串中，仅单引号需要转义（用 '' 表示一个单引号）
fn escape_powershell_single_quote(s: &str) -> String {
    s.replace('\'', "''")
}

/// 截屏：保存到 app_data_dir()/screenshots/（跨平台，替代硬编码 D:\LynnHub）
///
/// 安全策略：执行前检查紧急停止标志，若已触发则拒绝执行。
pub async fn take_screenshot(app_handle: &tauri::AppHandle) -> Result<String, String> {
    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("紧急停止已触发，屏幕截图已暂停".to_string());
    }

    let app_data = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("user-data"));
    let save_dir = app_data.join("screenshots");

    // 确保目录存在
    let _ = std::fs::create_dir_all(&save_dir);

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_path = save_dir.join(format!("screenshot_{}.png", timestamp));
    let file_path_str = file_path.to_string_lossy().to_string();

    // 执行截图前再次检查紧急停止（目录创建等耗时操作后状态可能变化）
    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("紧急停止已触发，屏幕截图已中断".to_string());
    }

    // 使用 PowerShell 截图命令（Windows）
    #[cfg(target_os = "windows")]
    {
        let escaped_path = escape_powershell_single_quote(&file_path_str);
        let ps_script = format!(
            r#"Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); $bmp.Save('{}'); $g.Dispose(); $bmp.Dispose()"#,
            escaped_path
        );

        let status = tokio::process::Command::new("powershell")
            .args(&["-NoProfile", "-Command", &ps_script])
            .kill_on_drop(true)
            .status()
            .await
            .map_err(|e| format!("PowerShell 截图失败: {}", e))?;

        if status.success() && file_path.exists() {
            log::info!("截图已保存: {}", file_path_str);
            return Ok(file_path_str);
        }
    }

    Err("截图失败：当前平台不支持".to_string())
}

/// 模拟键盘输入（使用 enigo 0.2 API）
pub fn type_text(text: &str) -> Result<(), String> {
    use enigo::{Enigo, Keyboard, Settings};
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Enigo初始化失败: {}", e))?;
    enigo.text(text)
        .map_err(|e| format!("键盘输入失败: {}", e))?;
    Ok(())
}

/// 模拟鼠标点击（使用 enigo 0.2 API）
pub fn mouse_click(x: i32, y: i32) -> Result<(), String> {
    use enigo::{Enigo, Mouse, Button, Coordinate, Direction, Settings};
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Enigo初始化失败: {}", e))?;
    enigo.move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| format!("鼠标移动失败: {}", e))?;
    enigo.button(Button::Left, Direction::Click)
        .map_err(|e| format!("鼠标点击失败: {}", e))?;
    Ok(())
}

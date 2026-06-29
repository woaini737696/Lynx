// 桌面应用 RPA 操作（启动应用、截图、模拟键鼠）
// 集成 enigo（键鼠模拟）+ screenshots（截图）

use tauri::Manager;

/// 启动本地应用
/// 安全：仅允许白名单应用名，未知应用名拒绝执行（防命令注入）
pub async fn open_app(app_name: &str) -> Result<(), String> {
    let args: Vec<&str> = match app_name.to_lowercase().as_str() {
        "excel" => vec!["/C", "start", "excel"],
        "wechat" | "微信" => vec!["/C", "start", "WeChat"],
        "notepad" | "记事本" => vec!["/C", "start", "notepad"],
        "browser" | "浏览器" => vec!["/C", "start", "chrome"],
        "explorer" | "文件管理器" => vec!["/C", "start", "explorer"],
        "calculator" | "计算器" => vec!["/C", "start", "calc"],
        _ => {
            // 未知应用名拒绝执行，避免命令注入
            return Err(format!("不支持的应用: {}（仅支持白名单应用）", app_name));
        }
    };

    let status = tokio::process::Command::new("cmd")
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
pub async fn take_screenshot(app_handle: &tauri::AppHandle) -> Result<String, String> {
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

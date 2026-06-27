// 桌面应用 RPA 操作（启动应用、截图、模拟键鼠）
// 集成 enigo（键鼠模拟）+ screenshots（截图）

/// 启动本地应用
pub async fn open_app(app_name: &str) -> Result<(), String> {
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

/// 截屏：保存到 D:\LynnHub\user-data\screenshots\
pub async fn take_screenshot() -> Result<String, String> {
    let save_dir = if cfg!(target_os = "windows") {
        "D:\\LynnHub\\user-data\\screenshots"
    } else {
        "./user-data/screenshots"
    };

    // 确保目录存在
    let _ = std::fs::create_dir_all(save_dir);

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let file_path = format!("{}/screenshot_{}.png", save_dir, timestamp);

    // 使用 PowerShell 截图命令（Windows）
    #[cfg(target_os = "windows")]
    {
        let ps_script = format!(
            r#"Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); $bmp.Save('{}'); $g.Dispose(); $bmp.Dispose()"#,
            file_path.replace('\\', "\\\\")
        );

        let status = tokio::process::Command::new("powershell")
            .args(&["-NoProfile", "-Command", &ps_script])
            .kill_on_drop(true)
            .status()
            .await
            .map_err(|e| format!("PowerShell 截图失败: {}", e))?;

        if status.success() && std::path::Path::new(&file_path).exists() {
            log::info!("截图已保存: {}", file_path);
            return Ok(file_path);
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

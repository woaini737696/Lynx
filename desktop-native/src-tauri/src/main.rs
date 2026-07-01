// Lynx 桌面端主入口
// 防止 Windows 发布构建时出现额外的控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    lynx_desktop_lib::run()
}

// build.rs - Lynx 桌面端构建脚本
// MSVC 工具链下 tauri_build 自动处理 Windows 资源文件

fn main() {
    tauri_build::build();
}

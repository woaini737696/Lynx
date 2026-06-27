// build.rs - LynnHub 桌面端构建脚本
// 处理 tauri-winres 在中文路径下 windres 编译失败的问题
// 方案：先尝试正常 tauri_build，若因 windres 失败则手动编译资源文件（图标复制到临时 ASCII 路径）

fn main() {
    // 先尝试正常的 tauri_build
    let result = std::panic::catch_unwind(|| {
        tauri_build::build();
    });

    if result.is_err() {
        // tauri_build 失败（通常是 windres 无法处理中文路径）
        // 手动编译资源文件，将图标复制到临时目录（纯 ASCII 路径）
        compile_resource_with_ascii_icon();
    }
}

/// 手动编译 Windows 资源文件，绕过 windres 的中文路径问题
fn compile_resource_with_ascii_icon() {
    use std::env;
    use std::fs;
    use std::process::Command;

    let manifest_dir = env::var("CARGO_MANIFEST_DIR")
        .expect("CARGO_MANIFEST_DIR not set");
    let out_dir = env::var("OUT_DIR")
        .expect("OUT_DIR not set");

    // 1. 将图标复制到系统临时目录（纯 ASCII 路径）
    let icon_src = format!("{}/icons/icon.ico", manifest_dir);
    let temp_dir = env::temp_dir();
    let icon_dst = temp_dir.join("lynnhub_icon.ico");
    fs::copy(&icon_src, &icon_dst)
        .expect("复制图标到临时目录失败");

    // 将临时路径转换为 .rc 文件格式（双反斜杠）
    let icon_dst_escaped = icon_dst
        .to_str()
        .expect("临时图标路径包含非 ASCII 字符")
        .replace('\\', "\\\\");

    // 2. 读取 tauri_build 已生成的 resource.rc（panic 前已生成）
    let rc_path = format!("{}/resource.rc", out_dir);
    let rc_content = fs::read_to_string(&rc_path)
        .unwrap_or_else(|_| {
            // 如果 resource.rc 不存在，创建一个最小化的版本
            format!(
                r#"#pragma code_page(65001)
1 VERSIONINFO
FILEVERSION 1, 0, 0, 0
PRODUCTVERSION 1, 0, 0, 0
FILEOS 0x40004
FILETYPE 0x1
FILESUBTYPE 0x0
FILEFLAGSMASK 0x3f
FILEFLAGS 0x0
{{
BLOCK "StringFileInfo"
{{
BLOCK "000004b0"
{{
VALUE "CompanyName", "lynnhub"
VALUE "FileDescription", "LynnHub"
VALUE "FileVersion", "1.0.0"
VALUE "ProductName", "LynnHub"
VALUE "ProductVersion", "1.0.0"
}}
}}
BLOCK "VarFileInfo" {{
VALUE "Translation", 0x0, 0x04b0
}}
}}
32512 ICON "{}"
"#,
                icon_dst_escaped
            )
        });

    // 3. 替换 ICON 行中的路径为临时路径
    let patched_rc: String = rc_content
        .lines()
        .map(|line| {
            // 匹配包含 ICON 和 .ico 的行
            if line.contains("ICON") && line.contains(".ico") {
                // 找到第一个引号和最后一个引号
                if let (Some(start), Some(end)) = (line.find('"'), line.rfind('"')) {
                    if start < end {
                        let prefix = &line[..=start];
                        let suffix = &line[end..];
                        return format!("{}{}{}", prefix, icon_dst_escaped, suffix);
                    }
                }
                line.to_string()
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    // 4. 写入修补后的 resource.rc
    let patched_rc_path = format!("{}/resource_patched.rc", out_dir);
    fs::write(&patched_rc_path, &patched_rc)
        .expect("写入修补后的 resource.rc 失败");

    // 5. 用 windres 编译为 COFF object 文件（.o）
    let obj_path = format!("{}/resource.o", out_dir);
    let status = Command::new("windres")
        .args(["-J", "rc", "-O", "coff", "-c", "65001"])
        .arg("-i")
        .arg(&patched_rc_path)
        .arg("-o")
        .arg(&obj_path)
        .status()
        .expect("无法启动 windres");

    if !status.success() {
        panic!("windres 编译资源文件失败");
    }

    // 6. 用 ar 工具打包成静态库 .a（rustc 期望 archive 格式而非裸 object）
    let lib_path = format!("{}/libresource.a", out_dir);
    let _ = fs::remove_file(&lib_path);
    let ar_status = Command::new("ar")
        .args(["rcs"])
        .arg(&lib_path)
        .arg(&obj_path)
        .status()
        .expect("无法启动 ar 工具，请确认 MinGW 在 PATH 中");

    if !ar_status.success() {
        panic!("ar 打包资源文件失败");
    }

    // 7. 告诉 cargo 链接资源
    println!("cargo:rustc-link-search=native={}", out_dir);
    println!("cargo:rustc-link-lib=static=resource");

    // 8. 打印 rerun-if-changed 指令
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=build.rs");

    eprintln!("[build.rs] 使用临时图标路径手动编译资源文件成功");
}

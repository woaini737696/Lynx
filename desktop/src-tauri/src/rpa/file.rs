// 文件操作（限制在授权目录白名单内）
// 所有路径必须先通过 is_path_authorized 校验

use serde_json::{json, Value};
use std::path::Path;
use crate::EMERGENCY_STOP;
use std::sync::atomic::Ordering;

/// 校验路径是否在授权目录白名单内
///
/// 安全策略：
/// - 对已存在的路径：直接 canonicalize 后比较
/// - 对不存在的路径（如新写入文件）：取父目录 canonicalize 后比较，防止 ../ 路径遍历
///
/// # 参数
/// - `path`: 待校验的文件/目录路径
/// - `authorized_dirs`: 授权目录白名单（已 canonicalize 的绝对路径）
///
/// # 返回
/// `true` 表示路径在授权目录内，`false` 表示越权或路径无法解析。
pub fn is_path_authorized(path: &str, authorized_dirs: &[String]) -> bool {
    let path = Path::new(path);

    let abs_path = if path.exists() {
        match path.canonicalize() {
            Ok(p) => p,
            Err(_) => return false,
        }
    } else {
        let parent = match path.parent() {
            Some(p) if !p.as_os_str().is_empty() => p,
            _ => return false,
        };
        let file_name = match path.file_name() {
            Some(name) => name,
            None => return false,
        };
        let canon_parent = match parent.canonicalize() {
            Ok(p) => p,
            Err(_) => return false,
        };
        canon_parent.join(file_name)
    };

    if abs_path.components().any(|c| c.as_os_str() == "..") {
        return false;
    }

    for dir in authorized_dirs {
        let abs_dir = match Path::new(dir).canonicalize() {
            Ok(p) => p,
            Err(_) => continue,
        };
        if abs_path.starts_with(&abs_dir) {
            return true;
        }
    }
    false
}

/// 读取文件内容
///
/// 安全策略：
/// 1. 紧急停止检查（EMERGENCY_STOP=true 时拒绝执行）
/// 2. 路径必须在授权目录白名单内
pub async fn read_file(path: &str, authorized_dirs: &[String]) -> Result<String, String> {
    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("紧急停止已触发，文件读取已暂停".to_string());
    }
    if !is_path_authorized(path, authorized_dirs) {
        return Err(format!("路径不在授权目录内: {}", path));
    }

    tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("读取文件失败: {}", e))
}

/// 写入文件
///
/// 安全策略：
/// 1. 紧急停止检查（EMERGENCY_STOP=true 时拒绝执行）
/// 2. 路径必须在授权目录白名单内
pub async fn write_file(path: &str, content: &str, authorized_dirs: &[String]) -> Result<(), String> {
    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("紧急停止已触发，文件写入已暂停".to_string());
    }
    if !is_path_authorized(path, authorized_dirs) {
        return Err(format!("路径不在授权目录内: {}", path));
    }

    // 确保父目录存在
    if let Some(parent) = Path::new(path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("创建父目录失败: {}", e))?;
    }

    // 写入前再次检查紧急停止（目录创建等耗时操作后状态可能变化）
    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("紧急停止已触发，文件写入已中断".to_string());
    }

    tokio::fs::write(path, content)
        .await
        .map_err(|e| format!("写入文件失败: {}", e))?;

    log::info!("文件已写入: {}", path);
    Ok(())
}

/// 列出目录内容
///
/// 安全策略：
/// 1. 紧急停止检查（EMERGENCY_STOP=true 时拒绝执行）
/// 2. 路径必须在授权目录白名单内
pub async fn list_dir(dir: &str, authorized_dirs: &[String]) -> Result<Value, String> {
    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("紧急停止已触发，目录列举已暂停".to_string());
    }
    if !is_path_authorized(dir, authorized_dirs) {
        return Err(format!("路径不在授权目录内: {}", dir));
    }

    let mut entries = Vec::new();
    let mut reader = tokio::fs::read_dir(dir)
        .await
        .map_err(|e| format!("读取目录失败: {}", e))?;

    while let Ok(Some(entry)) = reader.next_entry().await {
        let name = entry.file_name().to_string_lossy().to_string();
        let file_type = entry.file_type().await.ok();
        let is_dir = file_type.map(|t| t.is_dir()).unwrap_or(false);
        let size = entry.metadata().await.map(|m| m.len()).unwrap_or(0);

        entries.push(json!({
            "name": name,
            "isDir": is_dir,
            "size": size,
        }));
    }

    Ok(json!({
        "dir": dir,
        "entries": entries,
        "count": entries.len(),
    }))
}

/// 删除文件（仅授权目录内）
///
/// 安全策略：
/// 1. 紧急停止检查（EMERGENCY_STOP=true 时拒绝执行）
/// 2. 路径必须在授权目录白名单内
pub async fn delete_file(path: &str, authorized_dirs: &[String]) -> Result<(), String> {
    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("紧急停止已触发，文件删除已暂停".to_string());
    }
    if !is_path_authorized(path, authorized_dirs) {
        return Err(format!("路径不在授权目录内: {}", path));
    }
    tokio::fs::remove_file(path)
        .await
        .map_err(|e| format!("删除文件失败: {}", e))
}

/// 创建目录
///
/// 安全策略：
/// 1. 紧急停止检查（EMERGENCY_STOP=true 时拒绝执行）
/// 2. 路径必须在授权目录白名单内
pub async fn create_dir(path: &str, authorized_dirs: &[String]) -> Result<(), String> {
    if EMERGENCY_STOP.load(Ordering::SeqCst) {
        return Err("紧急停止已触发，目录创建已暂停".to_string());
    }
    if !is_path_authorized(path, authorized_dirs) {
        return Err(format!("路径不在授权目录内: {}", path));
    }
    tokio::fs::create_dir_all(path)
        .await
        .map_err(|e| format!("创建目录失败: {}", e))
}

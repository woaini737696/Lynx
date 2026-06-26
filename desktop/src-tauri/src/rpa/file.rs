// 文件操作（限制在授权目录白名单内）
// 所有路径必须先通过 is_path_authorized 校验

use serde_json::{json, Value};
use std::path::Path;

/// 校验路径是否在授权目录白名单内
pub fn is_path_authorized(path: &str, authorized_dirs: &[String]) -> bool {
    let abs_path = match Path::new(path).canonicalize() {
        Ok(p) => p,
        Err(_) => return false,
    };

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
pub async fn read_file(path: &str, authorized_dirs: &[String]) -> Result<String, String> {
    if !is_path_authorized(path, authorized_dirs) {
        return Err(format!("路径不在授权目录内: {}", path));
    }

    tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("读取文件失败: {}", e))
}

/// 写入文件
pub async fn write_file(path: &str, content: &str, authorized_dirs: &[String]) -> Result<(), String> {
    if !is_path_authorized(path, authorized_dirs) {
        return Err(format!("路径不在授权目录内: {}", path));
    }

    // 确保父目录存在
    if let Some(parent) = Path::new(path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("创建父目录失败: {}", e))?;
    }

    tokio::fs::write(path, content)
        .await
        .map_err(|e| format!("写入文件失败: {}", e))?;

    log::info!("文件已写入: {}", path);
    Ok(())
}

/// 列出目录内容
pub async fn list_dir(dir: &str, authorized_dirs: &[String]) -> Result<Value, String> {
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
pub async fn delete_file(path: &str, authorized_dirs: &[String]) -> Result<(), String> {
    if !is_path_authorized(path, authorized_dirs) {
        return Err(format!("路径不在授权目录内: {}", path));
    }
    tokio::fs::remove_file(path)
        .await
        .map_err(|e| format!("删除文件失败: {}", e))
}

/// 创建目录
pub async fn create_dir(path: &str, authorized_dirs: &[String]) -> Result<(), String> {
    if !is_path_authorized(path, authorized_dirs) {
        return Err(format!("路径不在授权目录内: {}", path));
    }
    tokio::fs::create_dir_all(path)
        .await
        .map_err(|e| format!("创建目录失败: {}", e))
}

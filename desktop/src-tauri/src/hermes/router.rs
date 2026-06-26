// HermesAgent 路由决策核心
// 判断指令属于云端/本地/混合能力，并分发到对应执行器

use crate::AppState;
use crate::rpa;
use crate::auth;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::AppHandle;

/// 指令路由结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RouteTarget {
    /// 云端能力：通过REST API操作RDS数据
    Cloud,
    /// 本地能力：浏览器自动化/桌面RPA/文件/Shell
    Local(LocalAction),
    /// 混合能力：云端API + 本地执行
    Hybrid,
}

/// 本地操作类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LocalAction {
    BrowserOpen,
    BrowserExtract,
    DesktopOpenApp,
    DesktopScreenshot,
    FileRead,
    FileWrite,
    FileList,
    ShellExec,
}

/// 执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub output: String,
    pub route: String,
    pub steps: Vec<ExecutionStep>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionStep {
    pub action: String,
    pub result: String,
    pub timestamp: String,
}

/// 路由决策：根据指令内容判断属于云端/本地/混合
///
/// 决策规则（关键词匹配）：
/// - 包含"打开浏览器/查看后台数据/抓取网页" → 本地 BrowserExtract
/// - 包含"打开Excel/微信/记事本/启动应用" → 本地 DesktopOpenApp
/// - 包含"截图/截屏" → 本地 DesktopScreenshot
/// - 包含"读取文件/写文件/整理文件夹" → 本地 FileRead/Write/List
/// - 包含"运行命令/执行cmd/powershell/git" → 本地 ShellExec
/// - 包含"创建灵感/任务/记忆/Skill/看板" → 云端
/// - 包含"飞书任务" → 混合（云端API + 本地通知）
/// - 其他 → 云端（默认走AI助理对话）
pub fn route_command(command: &str) -> RouteTarget {
    let lower = command.to_lowercase();
    let contains_any = |keywords: &[&str]| keywords.iter().any(|k| lower.contains(k));

    // 本地：浏览器自动化
    if contains_any(&["打开浏览器", "查看后台数据", "抓取网页", "打开网址", "访问网站", "navigate"]) {
        return RouteTarget::Local(LocalAction::BrowserExtract);
    }
    if contains_any(&["打开网页", "访问url"]) {
        return RouteTarget::Local(LocalAction::BrowserOpen);
    }

    // 本地：桌面RPA
    if contains_any(&["打开excel", "打开微信", "打开记事本", "启动应用", "打开应用", "切换窗口"]) {
        return RouteTarget::Local(LocalAction::DesktopOpenApp);
    }
    if contains_any(&["截图", "截屏", "screenshot"]) {
        return RouteTarget::Local(LocalAction::DesktopScreenshot);
    }

    // 本地：文件操作
    if contains_any(&["读取文件", "读文件", "read file"]) {
        return RouteTarget::Local(LocalAction::FileRead);
    }
    if contains_any(&["写文件", "写入文件", "保存文件", "write file", "生成文档"]) {
        return RouteTarget::Local(LocalAction::FileWrite);
    }
    if contains_any(&["列目录", "查看目录", "整理文件夹", "list dir"]) {
        return RouteTarget::Local(LocalAction::FileList);
    }

    // 本地：Shell 命令
    if contains_any(&["运行命令", "执行命令", "cmd", "powershell", "terminal", "git ", "npm ", "python "]) {
        return RouteTarget::Local(LocalAction::ShellExec);
    }

    // 混合：飞书任务（云API + 本地通知）
    if contains_any(&["飞书任务", "跟进飞书", "lark task"]) {
        return RouteTarget::Hybrid;
    }

    // 默认：云端（创建灵感/任务/记忆/Skill/看板/对话等）
    RouteTarget::Cloud
}

/// 路由并执行指令
pub async fn route_and_execute(
    command: &str,
    cloud_endpoint: &str,
    token: Option<&str>,
    auth_mode: &str,
    state: Arc<AppState>,
    app: AppHandle,
) -> ExecutionResult {
    let start = std::time::Instant::now();
    let target = route_command(command);
    let mut steps = Vec::new();

    let route_name = match &target {
        RouteTarget::Cloud => "cloud",
        RouteTarget::Local(action) => match action {
            LocalAction::BrowserOpen => "local:browser_open",
            LocalAction::BrowserExtract => "local:browser_extract",
            LocalAction::DesktopOpenApp => "local:desktop_open_app",
            LocalAction::DesktopScreenshot => "local:desktop_screenshot",
            LocalAction::FileRead => "local:file_read",
            LocalAction::FileWrite => "local:file_write",
            LocalAction::FileList => "local:file_list",
            LocalAction::ShellExec => "local:shell_exec",
        },
        RouteTarget::Hybrid => "hybrid",
    };

    steps.push(ExecutionStep {
        action: format!("路由决策: {}", route_name),
        result: "指令已分类".to_string(),
        timestamp: chrono_now(),
    });

    let result = match target {
        RouteTarget::Cloud => {
            executor::execute_cloud(command, cloud_endpoint, token, &mut steps).await
        }
        RouteTarget::Local(action) => {
            // 本地操作需先通过授权检查
            let approved = auth::check_permission(&action, auth_mode, &app, command).await;
            if !approved {
                steps.push(ExecutionStep {
                    action: "授权检查".to_string(),
                    result: "用户拒绝授权".to_string(),
                    timestamp: chrono_now(),
                });
                return ExecutionResult {
                    success: false,
                    output: String::new(),
                    route: route_name.to_string(),
                    steps,
                    error: Some("用户拒绝授权该本地操作".to_string()),
                    duration_ms: start.elapsed().as_millis() as u64,
                };
            }
            steps.push(ExecutionStep {
                action: "授权检查".to_string(),
                result: "已通过".to_string(),
                timestamp: chrono_now(),
            });
            executor::execute_local(action, command, state, app, &mut steps).await
        }
        RouteTarget::Hybrid => {
            executor::execute_hybrid(command, cloud_endpoint, token, &mut steps).await
        }
    };

    ExecutionResult {
        success: result.0,
        output: result.1,
        route: route_name.to_string(),
        steps,
        error: result.2,
        duration_ms: start.elapsed().as_millis() as u64,
    }
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("ts:{}", secs)
}

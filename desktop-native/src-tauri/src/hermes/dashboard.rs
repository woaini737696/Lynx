// HermesAgent Dashboard HTTP API 客户端
//
// 所有指令执行统一走 Dashboard HTTP API（POST /api/execute），
// 复用 HermesAgent 的完整 LLM + computer_use 能力。
//
// 设计原则：单一路径，无回退。Dashboard 不可用时直接返回错误，
// 避免双轨制（Dashboard + 关键词匹配）带来的行为不一致和维护成本。

use crate::installer;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::AppHandle;

/// 指令执行结果（统一返回类型）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecResult {
    pub success: bool,
    pub output: String,
    /// 执行路径标识：dashboard / special:<action>
    pub route: String,
    pub steps: Vec<ExecStep>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecStep {
    pub action: String,
    pub result: String,
    pub timestamp: String,
}

impl ExecResult {
    pub fn ok(output: String, route: &str, duration_ms: u64) -> Self {
        Self {
            success: true,
            output,
            route: route.to_string(),
            steps: vec![],
            error: None,
            duration_ms,
        }
    }

    pub fn err(error: String, route: &str, duration_ms: u64) -> Self {
        Self {
            success: false,
            output: String::new(),
            route: route.to_string(),
            steps: vec![],
            error: Some(error),
            duration_ms,
        }
    }
}

/// 通过本地 HermesAgent Dashboard HTTP API 执行指令
///
/// Dashboard 提供 POST /api/execute 端点，复用 HermesAgent 的完整 LLM + computer_use 能力。
///
/// 返回 `Err` 表示 Dashboard 不可用（未启动或端口不通），调用方应提示用户启动 Dashboard。
/// 返回 `Ok(ExecResult)` 表示 Dashboard 已响应（包含成功/失败）。
pub async fn execute_via_dashboard(command: &str) -> Result<ExecResult, String> {
    const DASHBOARD_URL: &str = "http://127.0.0.1:9119/api/execute";
    let start = std::time::Instant::now();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(130))
        .build()
        .map_err(|e| format!("构建 HTTP client 失败: {}", e))?;

    let resp = client
        .post(DASHBOARD_URL)
        .json(&json!({
            "prompt": command,
            "timeout": 120,
            "mode": "auto",
        }))
        .send()
        .await
        .map_err(|e| format!("Dashboard 不可用: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Dashboard 返回非 2xx: {}", resp.status()));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Dashboard 响应解析失败: {}", e))?;

    let success = data
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    if !success {
        let err = data
            .get("error")
            .or_else(|| data.get("message"))
            .and_then(|v| v.as_str())
            .unwrap_or("Dashboard 执行失败")
            .to_string();
        return Ok(ExecResult::err(err, "dashboard", start.elapsed().as_millis() as u64));
    }

    let output = data
        .get("output")
        .or_else(|| data.get("result"))
        .and_then(|v| v.as_str())
        .unwrap_or("(任务已完成，无控制台输出)")
        .to_string();

    // 真实性校验：如果 executed=false 且 actions_executed 为空，
    // 且 output 包含教程式文本关键词，则判定为假成功
    let executed = data
        .get("executed")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let actions_executed = data.get("actions_executed").and_then(|v| v.as_array());
    let has_actions = actions_executed.map(|a| !a.is_empty()).unwrap_or(false);

    if !executed && !has_actions {
        let fake_keywords = [
            "无法直接控制",
            "无法控制你的设备",
            "你可以按以下步骤",
            "请手动",
            "手动打开",
            "手动操作",
            "请按以下步骤",
            "你可以通过以下方式",
            "步骤如下",
        ];
        let is_fake = fake_keywords.iter().any(|kw| output.contains(kw));
        if is_fake {
            return Ok(ExecResult::err(
                "HermesAgent 未能真正执行操作（LLM 返回了教程式文本而非实际执行动作）".to_string(),
                "dashboard",
                start.elapsed().as_millis() as u64,
            ));
        }
    }

    Ok(ExecResult::ok(
        output,
        "dashboard",
        start.elapsed().as_millis() as u64,
    ))
}

/// 处理特殊系统命令（来自 Web 端委托桌面端执行）
///
/// 命令格式：`__LYNN_CMD__:<action>`
/// 支持：start_dashboard / stop_dashboard / install_hermes / update_hermes / check_update
pub async fn handle_special_command(command: &str, app: AppHandle) -> ExecResult {
    let action = command.strip_prefix("__LYNN_CMD__:").unwrap_or("");
    let start = std::time::Instant::now();

    log::info!("处理特殊系统命令: {}", action);

    let (success, output, error) = match action {
        "start_dashboard" => {
            match installer::start_hermes_dashboard_internal(9119).await {
                Ok(_) => (
                    true,
                    "HermesAgent Dashboard 已启动（端口 9119）".to_string(),
                    None,
                ),
                Err(e) => (false, String::new(), Some(format!("启动 Dashboard 失败: {}", e))),
            }
        }
        "stop_dashboard" => {
            match installer::stop_hermes_dashboard_internal().await {
                Ok(_) => (true, "HermesAgent Dashboard 已停止".to_string(), None),
                Err(e) => (false, String::new(), Some(format!("停止 Dashboard 失败: {}", e))),
            }
        }
        "install_hermes" => {
            match installer::install_ai_environment(app.clone()).await {
                Ok(result) => {
                    let success = result
                        .get("success")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let message = result
                        .get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("安装完成")
                        .to_string();
                    (success, message, None)
                }
                Err(e) => (false, String::new(), Some(format!("安装失败: {}", e))),
            }
        }
        "update_hermes" => {
            match installer::update_hermes_agent(app.clone()).await {
                Ok(result) => {
                    let success = result
                        .get("success")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let message = result
                        .get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("升级完成")
                        .to_string();
                    (success, message, None)
                }
                Err(e) => (false, String::new(), Some(format!("升级失败: {}", e))),
            }
        }
        "check_update" => {
            match installer::check_hermes_update().await {
                Ok(result) => {
                    let has_update = result
                        .get("hasUpdate")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let current = result
                        .get("currentVersion")
                        .and_then(|v| v.as_str())
                        .unwrap_or("未知");
                    let latest = result
                        .get("latestVersion")
                        .and_then(|v| v.as_str())
                        .unwrap_or("未知");
                    let output = if has_update {
                        format!("发现新版本：v{}（当前 v{}）", latest, current)
                    } else {
                        format!("已是最新版本（v{}）", current)
                    };
                    (true, output, None)
                }
                Err(e) => (false, String::new(), Some(format!("检查更新失败: {}", e))),
            }
        }
        _ => (
            false,
            String::new(),
            Some(format!("未知的系统命令: {}", action)),
        ),
    };

    ExecResult {
        success,
        output,
        route: format!("special:{}", action),
        steps: vec![],
        error,
        duration_ms: start.elapsed().as_millis() as u64,
    }
}
